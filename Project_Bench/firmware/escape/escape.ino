/*
  ESCAPE — Arduino Mega firmware

  Two inputs, one board: a 4x4 button matrix (2PH132524A) and a
  joystick module's click switch (SW). Talks to Project_Bench/index.html
  over Serial at 115200 baud using the contract from the README:

    K:<0-15>   matrix button press, row-major index (row*4 + col)
    J:1        joystick clicked (a momentary switch — no state to track)
    READY      handshake reply — sent on boot, and again on "PING"

  No external libraries. The matrix is scanned by hand (not the Keypad
  library) on purpose: that library's NO_KEY sentinel is the char value
  0, which collides with button index 0 if you map keys directly to
  0-15 — a real, easy-to-miss bug. Scanning it manually sidesteps that
  entirely and keeps the row-major index in your control.

  Only the joystick's click (SW) is wired here — the X/Y analog axes
  (VRx/VRy) aren't used by this game and are left unconnected. Say the
  word if you want tilt to do something too; it's a real addition, not
  assumed here.
*/

// ---------------- 4x4 MATRIX (2PH132524A) ----------------
// See WIRING.md for the pin table and photos-in-words. If the grid
// reads transposed or mirrored once you test it, you almost certainly
// have rows/columns swapped — swap these two arrays, don't rewire.
const byte ROWS = 4;
const byte COLS = 4;
const byte ROW_PINS[ROWS] = {22, 23, 24, 25};
const byte COL_PINS[COLS] = {26, 27, 28, 29};

bool keyDown[16] = { false }; // per-button latch so a held key fires once, not every scan

// ---------------- JOYSTICK CLICK (SW) ----------------
const int SW_PIN = 6;
bool swDown = false;
unsigned long swChangedAt = 0;
const unsigned long SW_DEBOUNCE_MS = 40; // mechanical switches bounce on both press and release

void setup() {
  Serial.begin(115200);

  for (byte r = 0; r < ROWS; r++) {
    pinMode(ROW_PINS[r], OUTPUT);
    digitalWrite(ROW_PINS[r], HIGH); // idle high; each row pulses LOW to scan
  }
  for (byte c = 0; c < COLS; c++) {
    pinMode(COL_PINS[c], INPUT_PULLUP); // reads LOW only when the active row's key is pressed
  }

  pinMode(SW_PIN, INPUT_PULLUP); // most joystick modules just short SW to GND on click,
                                   // with no onboard pull-up — the Mega supplies one instead

  Serial.println("READY");
}

void matrixScan() {
  for (byte r = 0; r < ROWS; r++) {
    digitalWrite(ROW_PINS[r], LOW);
    delayMicroseconds(30); // let the line settle before reading columns

    for (byte c = 0; c < COLS; c++) {
      bool pressed = (digitalRead(COL_PINS[c]) == LOW);
      byte idx = r * COLS + c; // matches the page's row-major K:<0-15>

      if (pressed && !keyDown[idx]) {
        keyDown[idx] = true;
        Serial.print("K:");
        Serial.println(idx);
      } else if (!pressed) {
        keyDown[idx] = false;
      }
    }

    digitalWrite(ROW_PINS[r], HIGH);
  }
}

void joystickScan() {
  bool rawPressed = (digitalRead(SW_PIN) == LOW);
  unsigned long now = millis();

  if (rawPressed != swDown && (now - swChangedAt) > SW_DEBOUNCE_MS) {
    swChangedAt = now;
    swDown = rawPressed;
    if (swDown) Serial.println("J:1"); // only the press edge is a trigger — release sends nothing
  }
}

void loop() {
  matrixScan();
  joystickScan();

  if (Serial.available()) {
    String line = Serial.readStringUntil('\n');
    line.trim();
    if (line == "PING") Serial.println("READY");
  }
}
