# ESCAPE — wiring

Arduino Mega 2560, two inputs, one Serial connection back to the browser page.

## Joystick module — click only (3 pins used)

| Joystick pin | Mega pin |
|---|---|
| GND | GND |
| +5V | 5V |
| SW | 6 |

Only the click switch (SW) is used — `VRx` and `VRy` (the X/Y analog axes) are left
unconnected. This game only needs a jump trigger, and a click is exactly that: a plain digital
signal, no analog reading or calibration involved. If you want tilt to do something later
(steer, duck, whatever), that's a real addition on top of this, not assumed here — say the
word.

Most of these modules just short SW straight to GND on click, with no pull-up resistor of their
own, so the firmware enables the Mega's internal pull-up on that pin (`INPUT_PULLUP`) — nothing
extra to wire for it.

## 2PH132524A — 4×4 button matrix (8 pins)

| Matrix pin | Mega pin |
|---|---|
| Row 1 | 22 |
| Row 2 | 23 |
| Row 3 | 24 |
| Row 4 | 25 |
| Col 1 | 26 |
| Col 2 | 27 |
| Col 3 | 28 |
| Col 4 | 29 |

**One honest caveat:** I couldn't find a datasheet for this exact part number, so this table
assumes the standard convention most 4×4 matrix keypads use — 8 pins in a single row, the first
4 are rows and the next 4 are columns, left to right. If your module's silkscreen prints
different labels, follow those instead. And if you wire it exactly as printed but the on-screen
grid comes out **transposed or mirrored** once you test it (pressing a button lights up the
wrong tile in a consistent, patterned way), that's almost always rows and columns swapped —
fix it in software by swapping `ROW_PINS` and `COL_PINS` in `escape/escape.ino`, no rewiring
needed.

**If your module has no labels at all**, find rows vs. columns with a multimeter on continuity
mode: press and hold one button, then touch the probes to pairs of pins until you get
continuity. The two pins that beep are one row pin and one column pin for that button. Repeat
with a button in a different row and a different column to sort all 8 into two groups of 4.

## Power

Both run off the Mega's onboard 5V — no external supply needed for a desktop test. Nothing else
on this board draws meaningful current.

## Flashing

Open `escape/escape.ino` in the Arduino IDE, select **Arduino Mega 2560** as the board, pick the
right port, upload. No libraries to install — the sketch only uses built-in `digitalRead` /
`digitalWrite`, deliberately, to avoid a real bug the common `Keypad` library invites here (its
"no key pressed" sentinel is the same value as button index 0).

## Test the joystick click on its own first

`joystick_test/joystick_test.ino` is a second, tiny sketch — just the click switch, nothing
else. Upload it before `escape.ino` and open the Serial Monitor at 115200 baud. Click the
joystick straight down a few times (like pressing a button, not tilting it) and you should see:

```
=== JOYSTICK CLICK TEST ===
Press the joystick straight down (click it like a button).

CLICK  (1 total)
CLICK  (2 total)
CLICK  (3 total)
```

One line per click, count going up, no interpretation needed. If nothing prints no matter how
hard you click, double check `SW` actually landed on pin 6 and that `GND`/`+5V` are seated —
and if a SINGLE click prints two or three `CLICK` lines in a row, that's normal switch bounce;
the real sketch already debounces it (40ms), so it won't double-trigger a jump in the actual
game — this test sketch debounces too, so if you're still seeing doubles here, the debounce
window may need lengthening for your specific module.

Once this looks right, move on to `escape.ino` — you already know the click itself is good, so
if jumps still don't work after that, the problem is elsewhere (the page, the `J:` framing),
not the switch.

## Verifying `escape.ino` before touching the page

Open the Arduino IDE's Serial Monitor at **115200 baud** after flashing. You should see:

```
READY
```
on boot, then nothing until you actually do something — that's correct, unlike the old
continuous-sensor version of this project, a matrix press or a joystick click only prints when
it happens:

```
K:5
J:1
K:9
```

Press a matrix button and you should see a `K:<n>` line, `0`–`15`, with no two buttons
producing the same number and no button producing nothing. Click the joystick and you should
see exactly one `J:1` line per click, not two or three.

Fix all of this here, in the Serial Monitor, before ever opening `index.html` — it's a much
faster loop than debugging through the browser.

Once that looks right, close the Serial Monitor (only one program can hold the port at a time),
open `index.html`, hit **CONNECT ARDUINO**, and pick the port.
