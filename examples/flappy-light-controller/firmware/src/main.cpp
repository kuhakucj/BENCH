#include <Arduino.h>

const int LIGHT_SENSOR_PIN = 34;
const int THRESHOLD = 1800;
bool lastJump = false;

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("BENCH_FLAPPY_READY");
}

void loop() {
  int lightValue = analogRead(LIGHT_SENSOR_PIN);
  bool covered = lightValue < THRESHOLD;

  if (covered != lastJump) {
    Serial.print("JUMP:");
    Serial.println(covered ? 1 : 0);
    lastJump = covered;
  }

  Serial.print("LIGHT:");
  Serial.println(lightValue);
  delay(40);
}
