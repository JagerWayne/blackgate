# BLACKGATE

A network-intrusion simulation wrapped in a Windows-XP shell. You are a
freelance operator: the broker hands you jobs, you crack a way into the
target, do the work, wipe your tail and get paid. Every action writes a log
somewhere, and logs are what get people caught.

BLACKGATE runs in the browser. It is data-oriented: plain objects and pure
systems, no classes with hidden state, no build step.

## Run it

`run.bat` serves the folder on **http://localhost:8001/** and opens it. Any
static file server works (`python -m http.server 8001`, `npx serve`); the
batch file picks the first one it finds. The game must be served — not opened
as a `file://` URL — because it fetches the content folder.

## Playing

* The **boot screen** types itself out, then the **welcome screen** takes an
  operator handle and a world seed. The same seed always builds the same
  network.
* **CONTRACTS** lists the work. **ACCEPT** takes a job; read the brief, then
  press **SHOW TARGET** to put the machine on the **NEXUS MAP**, pick it and
  **LINK** to it.
* Inside **Bl@ckG@te**, break the password, copy the file, then **SUBMIT WORK**
  on the contract board. The fee clears into your account.
* The left panel of **Bl@ckG@te** holds the actions that work on the host
  itself: **BYPASS FIREWALL**, **BLIND MONITOR**, **SCRUB PROXY** and
  **WIPE LOGS**. One that cannot run says why. A button that would only fail
  after the click is greyed out with its reason under it.
* The first jobs are handed out on soft machines — no firewall, no monitor, no
  proxy. The hardened hosts open up as the rating grows.
* The trace is a clock, not a warning: finish the job and disconnect before it
  lands, or the evidence becomes heat, and heat becomes a raid.
* **GATEWAY** buys the chassis and the parts that make the machine faster,
  quieter and harder to find. **SOFTWARE** buys the tools the jobs need.
* `D` swaps the light and dark skins.
* **TURN OFF COMPUTER** (and **Turn off the PC** in the Start menu) powers the
  machine down; any key turns it back on.

Every list names its columns, and the run is saved in the browser's local
store; a saved operator shows up as a user on the welcome screen, and
**DELETE SAVE** on that screen throws the save away. The interface is set at
14 points and up, so it reads on a big screen.

## The code

* `src/main.js` — the bootstrap: the canvas, the content folder, the screens.
* `src/core/` — engine services with no game knowledge: the loop, the
  deterministic PCG32 generator, the clock, the text and the skin.
* `src/data/` — the content tables and the world generation.
* `src/state/` — the game state shapes.
* `src/systems/` — the simulation, one system per file.
* `src/render/` — the shell chrome and the screens.
* `src/ui/` — the form toolkit the twelve applications share.
* `src/windows/` — one file per application.

`ARCHITECTURE.md` maps every file. The tests run with `node --test tests/*.mjs`.
