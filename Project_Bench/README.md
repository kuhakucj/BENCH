# Project_Bench — ESCAPE

Two phases, one Arduino Mega, two inputs:

1. **RECALL** — the board lights a sequence across a **4×4 button matrix (2PH132524A)**.
   Watch it, repeat it back. Clear 3 rounds and phase 2 unlocks. Get a button wrong and
   you're back at round 1.
2. **RUNOUT** — an endless runner driven by a **joystick module's click (SW)**. Click to jump
   hurdles; stay grounded to duck under overhead beams. One hit ends the run; your survival
   time is the score.

Open `index.html` in Chrome or Edge. No build, no install, no server required for keyboard
testing.

## Test it right now, with no hardware

The page boots in **keyboard test mode** for both phases.

**Phase 1 (RECALL)** maps the 4×4 matrix onto the keyboard 1:1 — that block sits on your
keyboard in the same shape as the real matrix:

```
1 2 3 4
Q W E R
A S D F
Z X C V
```

`SPACE` also starts/advances. Turn on **SIMULATE CHATTER** to inject 2–4 rapid duplicate
presses per key (real matrix keypads bounce) and confirm the 140ms debounce window swallows
them — watch the serial log for `K:<n> debounced (chatter)`.

**Phase 2 (RUNOUT)** unlocks automatically once round 3 is cleared. `SPACE` fires the exact
same debounced click handler a real `J:1` line will — holding it down won't spam jumps (it
ignores OS key-repeat, same as a real momentary switch would), and only a genuine new press
after release counts. Turn on **SIMULATE CHATTER** here too to fake a bouncy click (a real
switch can briefly double-fire) and confirm the 220ms debounce swallows it as one jump.

## Wiring and firmware

Both live in `firmware/`:

- **[`firmware/WIRING.md`](firmware/WIRING.md)** — pin table for the joystick and the 4×4
  matrix, power notes, and how to verify each one *on its own*, in the Arduino IDE's Serial
  Monitor, before ever opening the page (much faster debug loop than debugging through the
  browser).
- **[`firmware/escape/escape.ino`](firmware/escape/escape.ino)** — the Mega sketch. No
  libraries required; the matrix is scanned by hand rather than with the common `Keypad`
  library, on purpose (that library's "no key" sentinel collides with button index 0 if you
  map keys straight to `0`–`15` — an easy, real bug to ship).
- **[`firmware/joystick_test/joystick_test.ino`](firmware/joystick_test/joystick_test.ino)** —
  a tiny standalone sketch, just the click switch, plain-English output.

Only the joystick's click switch is wired — the X/Y analog axes aren't used by this game and
are left unconnected. One serial connection at **115200 baud** carries both phases' protocols;
the page reads whichever lines matter for the phase currently active, and logs anything else
verbatim:

```
K:<0-15>   matrix button press, row-major index (row × 4 + col)   — phase 1
J:1        joystick clicked (jump trigger)                          — phase 2
READY      handshake reply — sent on boot and on "PING"
```

That's the whole contract for phase 2 — a momentary click *is* the jump trigger, no distance
math or state to track on either end.

## Connecting the Mega

Hit **CONNECT ARDUINO** and pick the port. Uses the Web Serial API — Chrome or Edge only
(Firefox/Safari don't implement it; keyboard mode still works everywhere). Close the Arduino
IDE's Serial Monitor first — only one process can hold the port. The connection carries over
across the phase transition; switching from RECALL to RUNOUT won't drop it.

## Tuning

Constants live in one `CFG` block near the top of the `<script>`: matrix debounce window,
playback flash timing, and the joystick click's debounce/cooldown window.

## History

This folder has gone through several concepts as the real hardware got clarified:
**SLIPSTREAM** (HC-SR04 flying a craft continuously, assumed 2PH132524A was a stepper motor) →
**RUNOUT** (memory-preview obstacle runner, same wrong stepper assumption) → **RECALL** (pure
4×4 matrix Simon-Says, after 2PH132524A was corrected to a button matrix, HC-SR04 dropped) →
**ESCAPE** (HC-SR04 back in as the phase-2 trigger, chained: crack RECALL to unlock RUNOUT) →
**this version** (HC-SR04 swapped for a joystick's click switch — simpler wiring, and no
distance smoothing/threshold logic needed since a click is already a clean discrete signal).
