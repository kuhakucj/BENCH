import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";
import { createNosanaClient, NosanaNetwork, validateJobDefinition } from "@nosana/kit";

const root = process.cwd();
const envPath = path.join(root, ".env.local");
dotenv.config({ path: envPath, quiet: true });

const command = process.argv[2] || "check";
const market = process.env.NOSANA_MARKET || "CA5pMpqkYFKtme7K31pNB1s62X2SdhEv1nN9RdxKCpuQ";
const timeout = Number(process.env.NOSANA_TIMEOUT_MINUTES || 120);
const controlKey = process.env.NOSANA_CONTROL_API_KEY || process.env.NOSANA_API_KEY;
const jobPath = path.join(root, "nosana", "qwen3-vllm.job.json");

if (!controlKey) {
  throw new Error("Set NOSANA_CONTROL_API_KEY in .env.local.");
}

const client = createNosanaClient(NosanaNetwork.MAINNET, {
  api: { apiKey: controlKey }
});

if (!client.api) {
  throw new Error("Nosana API client could not be initialized.");
}

async function setLocalEnv(values) {
  let content = "";
  try {
    content = await readFile(envPath, "utf8");
  } catch {
    // The file is created below.
  }

  const lines = content ? content.split(/\r?\n/) : [];
  for (const [key, value] of Object.entries(values)) {
    const index = lines.findIndex((line) => line.startsWith(`${key}=`));
    if (index >= 0) lines[index] = `${key}=${value}`;
    else lines.push(`${key}=${value}`);
  }

  await writeFile(envPath, `${lines.filter(Boolean).join("\n")}\n`, "utf8");
}

async function getBalance() {
  const balance = await client.api.credits.balance();
  return {
    ...balance,
    availableCredits: balance.assignedCredits - balance.reservedCredits - balance.settledCredits
  };
}

async function loadJobDefinition() {
  const job = JSON.parse(await readFile(jobPath, "utf8"));
  const validation = validateJobDefinition(job);
  if (!validation.success) {
    throw new Error(`Invalid Nosana job definition: ${JSON.stringify(validation.errors)}`);
  }
  return job;
}

async function requireDeployment() {
  const id = process.env.NOSANA_DEPLOYMENT_ID;
  if (!id) throw new Error("NOSANA_DEPLOYMENT_ID is not set. Run pnpm nosana:create first.");
  return client.api.deployments.get(id);
}

function endpointFor(deployment) {
  const endpoint = deployment.endpoints.find((item) => Number(item.port) === 8000);
  return endpoint ? `${endpoint.url.replace(/\/$/, "")}/v1/chat/completions` : undefined;
}

async function endpointIsHealthy(endpoint) {
  const modelsUrl = endpoint.replace(/\/v1\/chat\/completions$/, "/v1/models");
  try {
    const response = await fetch(modelsUrl, { signal: AbortSignal.timeout(15_000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function check() {
  const [balance, selectedMarket] = await Promise.all([
    getBalance(),
    client.api.markets.get(market)
  ]);
  const job = await loadJobDefinition();
  console.log(JSON.stringify({
    authenticated: true,
    balance,
    market: {
      name: selectedMarket.name,
      address: selectedMarket.address,
      type: selectedMarket.type,
      usdRewardPerHour: selectedMarket.usd_reward_per_hour
    },
    image: job.ops[0].args.image,
    model: "Qwen/Qwen3-8B",
    jobDefinitionValid: true
  }, null, 2));
}

async function create() {
  if (process.env.NOSANA_DEPLOYMENT_ID) {
    const existing = await requireDeployment();
    console.log(`Using existing deployment ${existing.id} (${existing.status}).`);
    return existing;
  }

  const deployment = await client.api.deployments.create({
    name: `bench-qwen3-${Date.now()}`,
    market,
    timeout,
    replicas: 1,
    strategy: "SIMPLE-EXTEND",
    autostart: false,
    job_definition: await loadJobDefinition()
  });
  await setLocalEnv({ NOSANA_DEPLOYMENT_ID: deployment.id });
  process.env.NOSANA_DEPLOYMENT_ID = deployment.id;
  console.log(`Created Nosana deployment ${deployment.id} in DRAFT state.`);
  return deployment;
}

async function update() {
  const deployment = await requireDeployment();
  await deployment.createRevision(await loadJobDefinition());
  const revisions = await deployment.getRevisions({ limit: 100, sort_order: "desc" });
  const latest = Math.max(...revisions.revisions.map((revision) => revision.revision));
  await deployment.updateActiveRevision(latest);
  console.log(`Updated Nosana deployment ${deployment.id} to revision ${latest}.`);
  return client.api.deployments.get(deployment.id);
}

async function failureDetails(deployment) {
  const jobs = await deployment.getJobs({ limit: 20, sort_order: "desc" });
  const latest = jobs.jobs[0];
  if (!latest) return { status: deployment.status };
  const job = await deployment.getJob(latest.job);
  const failedOperation = job.jobResult?.opStates?.find((operation) => operation.status === "failed");
  return {
    status: deployment.status,
    job: latest.job,
    jobStatus: job.jobStatus,
    resultStatus: job.jobResult?.status,
    errors: job.jobResult?.errors,
    logs: failedOperation?.logs?.slice(-20).map((entry) => entry.log.trim()).filter(Boolean)
  };
}

async function waitForEndpoint(id, maxWaitMs = 20 * 60_000) {
  const startedAt = Date.now();
  let lastStatus = "";
  while (Date.now() - startedAt < maxWaitMs) {
    const deployment = await client.api.deployments.get(id);
    if (deployment.status !== lastStatus) {
      console.log(`Nosana deployment status: ${deployment.status}`);
      lastStatus = deployment.status;
    }
    if (["ERROR", "INSUFFICIENT_FUNDS", "STOPPED"].includes(deployment.status)) {
      throw new Error(`Nosana deployment failed: ${JSON.stringify(await failureDetails(deployment))}`);
    }
    const endpoint = endpointFor(deployment);
    if (deployment.status === "RUNNING" && endpoint && await endpointIsHealthy(endpoint)) {
      return { deployment, endpoint };
    }
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
  throw new Error("Timed out waiting for the Nosana inference endpoint.");
}

async function start() {
  let deployment = await requireDeployment();
  if (deployment.status === "DRAFT" || deployment.status === "STOPPED") {
    await deployment.start();
    console.log(`Starting Nosana deployment ${deployment.id}.`);
  } else {
    console.log(`Nosana deployment ${deployment.id} is ${deployment.status}.`);
  }

  const ready = await waitForEndpoint(deployment.id);
  await setLocalEnv({
    MODEL_PROVIDER: "nosana",
    NOSANA_INFERENCE_ENDPOINT: ready.endpoint,
    MODEL_NAME: "Qwen/Qwen3-8B"
  });
  console.log(`Inference endpoint ready: ${ready.endpoint}`);
  console.log("Restart the Next.js server so it loads the endpoint.");
  return ready.deployment;
}

async function status() {
  const deployment = await requireDeployment();
  const endpoint = endpointFor(deployment);
  const inferenceHealthy = endpoint ? await endpointIsHealthy(endpoint) : false;
  console.log(JSON.stringify({
    id: deployment.id,
    status: deployment.status,
    activeJobs: deployment.active_jobs,
    endpoint,
    inferenceHealthy,
    latestJob: await failureDetails(deployment),
    balance: await getBalance()
  }, null, 2));
}

async function stop() {
  const deployment = await requireDeployment();
  if (deployment.status === "RUNNING" || deployment.status === "STARTING") {
    await deployment.stop();
    console.log(`Stopping Nosana deployment ${deployment.id}.`);
  } else {
    console.log(`Nosana deployment ${deployment.id} is already ${deployment.status}.`);
  }
  await setLocalEnv({ MODEL_PROVIDER: "mock" });
  console.log("Local MODEL_PROVIDER set to mock until the Nosana deployment is started again.");
}

switch (command) {
  case "check": await check(); break;
  case "create": await create(); break;
  case "update": await update(); break;
  case "start": await start(); break;
  case "deploy": await create(); await start(); break;
  case "status": await status(); break;
  case "stop": await stop(); break;
  default: throw new Error(`Unknown command: ${command}`);
}
