export type ModelProviderName = "nosana" | "mock";

export type ModelConfig = {
  provider: ModelProviderName;
  endpoint?: string;
  apiKey?: string;
  model: string;
};

export function getModelConfig(): ModelConfig {
  const endpoint = process.env.NOSANA_INFERENCE_ENDPOINT || process.env.NOSANA_QWEN_ENDPOINT;
  const apiKey = process.env.NOSANA_INFERENCE_API_KEY;
  const provider = process.env.MODEL_PROVIDER === "nosana" && endpoint ? "nosana" : "mock";
  return {
    provider,
    endpoint,
    apiKey,
    model: process.env.MODEL_NAME || "Qwen/Qwen3-8B"
  };
}
