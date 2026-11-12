# BLACKGATE

A network-intrusion simulation game set inside a Windows-style desktop.

You are a freelance operator. A broker hands you jobs; you find the target machine, route your
connection through relays, break in, do the work, wipe your tracks and get paid. Every action leaves
a log somewhere, and logs are what get people caught. If a trace reaches you while you are
connected, or the heat from the evidence you leave behind reaches 100, the run is over.

**BLACKGATE** is a DOM + Tailwind CSS interface built with Vite (no framework), wrapped in
Electron for the Windows app. The game rules are plain JavaScript (ES modules) and all content
(companies, people, jobs, tools, hardware, cities, news) is JSON you can read and edit.

### ⬇ [Download the installer (Blackgate_Installer.exe)](https://github.com/JagerWayne/blackgate/releases/latest/download/Blackgate_Installer.exe)

Windows 10/11. Run it once: it installs the game, adds a desktop shortcut and keeps the game up to
date. All releases are on the [releases page](https://github.com/JagerWayne/blackgate/releases).

> **The manual is in the game.** Open the **Info** app (desktop icon or Start menu) for a detailed,
> searchable guide to every window, every tool, the Command Prompt and the rules. This README covers
> what the game is, how to run and build it, how it is put together and the reference tables.

---

## Contents

- [The game in one minute](#the-game-in-one-minute)
- [Running the game](#running-the-game)
- [Where your files live](#where-your-files-live)
- [The applications](#the-applications)
- [Controls](#controls)
- [Jobs, traces and heat](#jobs-traces-and-heat)
- [Your machine: the gateway](#your-machine-the-gateway)
- [Software](#software)
- [Rating and unlocks](#rating-and-unlocks)
- [What each software level does](#what-each-software-level-does)
- [Modding the content](#modding-the-content)
- [Images](#images)
- [Building from source](#building-from-source)
- [Tests](#tests)
- [Project layout](#project-layout)
- [Tools](#tools)
- [Credits and licences](#credits-and-licences)

---

## The game in one minute

1. **Boot and log in.** The login screen holds up to **four profiles**. A new profile builds its own
   world from a seed, shown on a setup screen: **40 companies** and **2,000 citizens** (about 900
   staff and 1,100 civilians), each with a full dossier and a portrait.
2. **The tutorial.** A card in the bottom-right corner walks you through installing the four basic
   tools from the App Store, then five lessons on a practice server that is destroyed when they end.
3. **Take a job** on **DSNET** in Internet XPlorer: read the brief, haggle if you like, **ACCEPT**.
4. **Find the target** on the **Nexus Map** and plan a route of relay hops. More hops slow the trace.
5. **Link** to the machine in **Bl@ckG@te**, open its locks, bypass its firewall, monitor and proxy,
   and do the work: copy a file, delete it, change a record, move money.
6. **Clean up.** Delete or scrub the logs your visit left, then disconnect before the trace finishes.
7. **Submit the work** in MY JOBS. The fee goes to your account and your rating rises.
8. **Upgrade** your machine (Device Manager, eForest) and your tools (App Store) for harder jobs.

The game saves by itself every 45 seconds. Press **Space** to pause the world clock at any time.

---

## Running the game

### Windows app (Blackgate_Installer.exe)

[Download `Blackgate_Installer.exe`](https://github.com/JagerWayne/blackgate/releases/latest/download/Blackgate_Installer.exe)
and run it. It is a small launcher (about 60 KB): the game itself comes from GitHub. It needs no
installer and no administrator rights.

- **First run:** the launcher copies itself to `Documents\Games\Blackgate`, puts a **BLACKGATE**
  shortcut on the desktop and downloads the game file by file (about 290 MB the first time). The
  window lists every file with its own percent bar. Each file is checked against its SHA-256 before
  it is installed to `Documents\Games\Blackgate\app`, and then the game starts.
- **Later runs:** it asks GitHub for the latest release. If the installed build is current the game
  starts at once; otherwise only the files that changed are downloaded (an ordinary update is a few
  MB, because the 200 MB `BLACKGATE.exe` is reused while Electron stays the same version), and the
  login screen says which version you came from.
- **Forced clean install:** tick *Force remove the previous version first* in the launcher window, or
  start `Blackgate_Installer.exe --clean`. Every file is downloaded again, a running game is closed and the old
  `app\` is deleted before the new one is put in place. Saves and data files stay.
- **Offline**, or when GitHub cannot be reached, the installed game starts as it is.
- The game starts **full screen**; **F11** toggles it. **Alt + F4** quits.
- An update only replaces `app\`, and only once the new copy is downloaded, checked and unpacked: a
  failed update leaves the installed game working. Your saves and edited content files are never
  touched.
- Every build has its own **build id**, the version plus the build time (for example
  `0.1.0+20261111T154430896Z`). The login screen shows both.

### In a browser (development)

```bash
npm install
npm run ui
```

`npm run ui` starts the Vite dev server with live reload (default http://localhost:5173/).
`runv2.bat` does the same and opens your browser. In the browser, saves live in the browser's local
storage and the game reads its content from `v2/data/`.

### From the menu

`build.bat` in the project root shows a menu of the npm commands (start, ui, ui:build, test, dist,
release, install) and runs the one you pick.

---

## Where your files live

The Windows app keeps everything for your Windows account in **`Documents\Games\Blackgate`**:

| Path | What it is |
|---|---|
| `app\` | The installed game. Replaced by each new build. |
| `app\version.json` | The version and build id of the installed copy. |
| `saves\<OPERATOR>.json` | One save per profile (four at most): the whole world, your dossiers and your run. |
| `hosts\<OPERATOR>.json` | The machines that operator has connected to, written on every save. |
| `*.json`, `hints\`, `sessionActions\`, `images\socialmedia\*.json` | Your copy of the game's content files. Edit these to change the world. |
| `data-version.json` | The build that last checked your content files, and a hash of each file as the game copied it. |
| `blackgate.log` | Warnings, for example about content files that differ from the game's. |

- **First run:** every content JSON file the game ships is copied in.
- **After an update:** a content file you never edited is replaced with the new build's copy. A file
  you **did** edit is kept and a warning is written to `blackgate.log`. To take the new version of an
  edited file, delete your copy; it is copied again on the next launch.
- **Broken files:** if a content file is missing or is not valid JSON, the game uses its built-in
  copy and shows a message naming the file.
- The portrait list (`images/people/index.json`) and `assets/` are never overridden by your copy:
  portraits are whatever is in the built-in `images/people/male` and `/female` folders.

---

## The applications

All are opened from the desktop (double-click) or the Start menu, and appear on the taskbar while
open. Windows can be dragged by their title bar (10 px always stays on screen so you can grab one
back), resized from their edges and minimised, maximised or closed.

| Application | What it does |
|---|---|
| **Internet XPlorer** | The browser, and the only window open when a run starts. Tabs, a circuit of relays and one address / search bar. **DSNET** (the hidden job market: listings, haggling, MY JOBS, LEAKBASE, the undernet board), **SleekPages** (the social network), the **Business Directory** and every company's website, **whois.nx** and **eForest** (the hardware store), plus LinkedUp (people and employers), nslookup.nx, the Bazaar, PasteDump and archive.nx. |
| **My Computer** | Your gateway's drive: `apps`, `downloads` and `logs` (one file a day), with C: and D: usage cards. |
| **Bl@ckG@te** | The hacking client. Tabs: **Nexus Map** (hosts, route, saved routes), **Live Link** (ACCESS, STORAGE, RECORDS, PEOPLE, CLI), **Company Map** and **Dossiers**. Every action on a live link is a right click on its target. |
| **Money** | Account, savings (0.4% a day), one loan at a time (2% a day) and a crypto wallet (STBL, BLUE, GHST). |
| **Outlook** | Inbox (job offers, replies) and News. |
| **Device Manager** | Your machine: case, motherboard, processors, drives, internet and security, with SLOT, STOCK and BUILD tabs. |
| **App Store** | The tools you hack with, with upgrade tracks. |
| **Control Panel** | Profile (rating, rank, record, rivals) and Settings (effects, sound, autosave, CLI links, 8x fast-forward, switches for each kind of notification, save and quit). |
| **Notepad** | Up to 12 notepads with line numbers and word wrap. |
| **Command Prompt** | Drives every other app by typing commands (`mail read new`, `ct accept 12`, `bg crack`...), plus shell commands: `ping`, `nmap`, `traceroute`, `ls` / `dir`, `cd`, `cat`, `ps`, `cls`. A host that answers `ping` appears on the map. Open it with the backtick key. |
| **Calculator** | A pocket calculator; `calc eval 12*(3+4)` works a sum out in the Command Prompt. |
| **Info** | The in-game manual: how to play and what every window does, with a search box. |

Two more windows are not on the desktop: **Debug** (click the BLACKGATE logo in the header: the PLAYER, WORLD and SWITCHES cheats, and a SETTINGS editor for `mainsettings.json`) and
**Mission Builder** (opened from the Debug menu), which builds a job to order.

---

## Controls

| Input | Action |
|---|---|
| `` ` `` (backtick) | Open the Command Prompt with the cursor in it |
| `Space` | Pause or resume the world clock |
| `Esc` | Leave a text field, close the Start menu or an open dropdown |
| `Tab` / `Shift+Tab` | Move between text fields |
| `Enter` | Press the highlighted button / run a Command Prompt line |
| `F11` | Full screen on and off (Windows app) |
| `Alt + F4` | Quit the Windows app |

The backtick and Space only act while a run is on and you are not typing in a field. Hover almost
anything for a moment for a tooltip. On the Nexus Map the wheel zooms (1x to 8x), dragging pans, and
hovering or clicking a city or pin shows or selects its machines.

---

## Jobs, traces and heat

Jobs come from clients through the broker, each with a target, an objective, a payout and a deadline.
The kinds, with the market's names:

| Kind | The job |
|---|---|
| **DATA HEISTS** | Copy a file off the host and bring it home |
| **SCRUBBERS** | Erase one file from the host |
| **BURN BOOK** | Wipe the host: every file and every log |
| **PAPERWORK** | Rewrite one detail in a person's record |
| **MONEY MOVES** | Move funds out of an account on a bank host |
| **MIND THEFT** | Steal a trained AI model off a lab host |
| Story | Missions that are part of the story |

- **The trace.** While you are connected the target traces you back along your bounce route; more
  hops slow it. If it completes the connection is seized and the run is over.
- **Logs and heat.** Every link writes logs on the target and on each hop. Logs left behind become
  **heat** when you disconnect (2 each on the target, 1.1 each on a hop). At **100 heat you are
  raided**; security parts can save you. With the Intruder Alarm Sensors fitted, BREACH is a
  15-second countdown before the raid lands.
- **Defences.** Firewalls, monitors and proxies (levels 1 to 5), password locks, MFA (app,
  session-bound, hardware token), voice locks and encrypted files each need a tool of at least their
  level. The last host of a company is an internal segment, reachable only from another of its hosts.
- **People.** Every person has public and private details; public ones go into your dossier when
  clicked. OSINT, calls, phishing and inbox attacks open locks without cracking them.
- **Haggling.** Ask for +10%, +25%, +50% or an exact amount on a listing; the client says yes,
  counters, says no or, if you ask for more than double, pulls the listing.

The **Info** app explains each of these in detail, with the numbers.

---

## Your machine: the gateway

Your gateway is built in three layers: a **case**, a **motherboard** inside it,
and **parts** on the board.

- The **case** sets the size of board it takes, how many **drive bays** it has
  and how many **security slots**. A case takes a board of its own size or a
  smaller one: an ATX case takes a Micro-ATX board but not an E-ATX one. The
  Micro PC has its board built in and takes no other.
- The **motherboard** sets the **processor sockets** (and the best processor
  tier it can run), the **drive bays** it can drive (and the best drive tier),
  the **add-in card slots** and the **network slots**. A drive needs both a
  board port and a case bay, so you get the lower of the two.
- The **parts** go on the board. All processors on a board must be the same
  model. The Micro PC's network card is **soldered on**: it cannot be taken
  out or replaced until you move to a bigger case and a new board.

Changing the case only goes up. Changing the board takes back 35% of the old
board's price. Anything the new case or board cannot hold (too many parts, or a
part above the best tier the board takes) goes to your **stock**; the **BOARD**
tab and the **CASE** tab say so before you confirm.

Cases:

| Case | Price | Size | Drive bays | Security slots | Trait |
|---|---|---|---|---|---|
| Micro PC | free | MICRO PC | 2 | 0 | easy to find |
| Rented Overseas Server | 6,500 | MINI-ITX | 2 | 0 | rented abroad |
| Hidden Mini Server | 14,000 | MICRO-ATX | 3 | 1 | hidden away |
| Soundproof Server Rack | 32,000 | ATX | 4 | 2 | soundproof room |
| Big Storage Rack | 48,000 | E-ATX | 8 | 2 | huge storage |
| Super Computer Cluster | 75,000 | SERVER RACK | 8 | 2 | power hungry |
| Mobile Hideout Van | 120,000 | SERVER RACK | 8 | 3 | home on wheels |

Motherboards:

| Board | Price | Size | CPU sockets (best tier) | Drive bays (biggest drive) | Booster | Unlock chip | Key reader | Network |
|---|---|---|---|---|---|---|---|---|
| Built-in Micro Board | built in | MICRO PC | 1 (T1) | 2 (up to 64 GB) | 0 | 0 | 0 | 1 |
| Mini-ITX Board | 1,800 | MINI-ITX | 1 (T2) | 2 (up to 512 GB) | 1 | 0 | 0 | 1 |
| Micro-ATX Board | 4,500 | MICRO-ATX | 2 (T2) | 3 (up to 1 TB) | 1 | 0 | 1 | 1 |
| ATX Board | 9,500 | ATX | 2 (T3) | 4 (up to 2 TB) | 1 | 1 | 1 | 1 |
| E-ATX Workstation Board | 21,000 | E-ATX | 4 (T4) | 6 (up to 4 TB) | 2 | 1 | 1 | 1 |
| Server Rack Board | 52,000 | SERVER RACK | 8 (T5) | 8 (up to 12 TB) | 2 | 2 | 1 | 2 |

The parts:

- **Compute:** each socket gives thread slots, which is how many tasks can
  run at once. All compute parts in a machine must be the same model.
  Basic Processor // 32 cores (1,200 cr); Fast Processor // 64 cores (3,500 cr); Ultra Processor // 128 cores (7,000 cr); Server Processor // 192 cores (16,000 cr); Datacentre Processor // 384 cores (34,000 cr).
- **Accelerator:** one add-in card, which speeds up password cracking, file
  decrypting and voice synthesis (not a recorded call, which runs in real
  time). The best card fitted counts.
  Booster Card x1 (4,500 cr, 1.5x); Booster Card x2 (9,000 cr, 2.5x); Booster Card x3 (15,000 cr, 3.5x); Booster Card x4 (24,000 cr, 5x).
- **FPGA:** custom silicon that decrypts and shakes hands 3x faster, and a
  decryption on it takes no thread slot. Boards from ATX up have a slot.
  Unlock Speed Chip (35,000 cr).
- **HSM:** a card that emulates smartcards and hardware tokens, needed for the
  token locks of the big banks and defence servers. Boards from Micro-ATX up have a slot.
  Security Key Reader (11,000 cr).
- **Storage:** how much you can download and install. The Micro PC has a
  64 GB eMMC chip soldered to its board, which runs the system and holds the
  apps (it cannot be removed, replaced or moved: it is small, so the Micro PC
  is limited in installing and upgrading apps), and one bay with a 64 GB M.2
  SSD for the downloads. There are seven kinds of drive. A board has a
  connector for some of them and takes drives up to a size (see the board
  table); the Device Manager says what is missing when a drive does not fit.

  | Drive | Sizes | Downloads at | Apps at (as system drive) |
  |---|---|---|---|
  | M.2 SSD | 32 GB, 64 GB, 128 GB, 256 GB, 512 GB, 1 TB, 2 TB | full | full |
  | 1.8" HDD, 5200 rpm | 32 GB, 64 GB, 128 GB | 25% | 63% |
  | 2.5" SSD | 256 GB, 512 GB, 1 TB, 2 TB | full | full |
  | 2.5" HDD, 5200 rpm | 512 GB, 1 TB, 2 TB | 25% | 63% |
  | 3.5" HDD, 5200 rpm | 1 TB, 2 TB, 4 TB, 12 TB | 25% | 63% |
  | 3.5" HDD, 7200 rpm | 512 GB, 1 TB, 2 TB, 4 TB | 50% | 75% |
  | 3.5" HDD, 10000 rpm | 512 GB, 1 TB, 2 TB, 4 TB, 12 TB | 75% | 88% |

  Price follows speed and size: an SSD costs about 2 to 2.4 cr a GB, a 10000
  rpm disk about 1.5, a 7200 rpm disk about 0.85, a 5200 rpm 2.5 inch disk
  about 0.75 and a 3.5 inch 5200 rpm disk about 0.55, plus a small base price.

  M.2 SSD 32 GB (130 cr); M.2 SSD 64 GB (210 cr); M.2 SSD 128 GB (350 cr); M.2 SSD 256 GB (650 cr); M.2 SSD 512 GB (1,240 cr); M.2 SSD 1 TB (2,420 cr); M.2 SSD 2 TB (4,770 cr); 1.8" HDD 32 GB (5200 rpm) (80 cr); 1.8" HDD 64 GB (5200 rpm) (120 cr); 1.8" HDD 128 GB (5200 rpm) (190 cr); 2.5" SSD 256 GB (560 cr); 2.5" SSD 512 GB (1,040 cr); 2.5" SSD 1 TB (2,020 cr); 2.5" SSD 2 TB (3,960 cr); 2.5" HDD 512 GB (5200 rpm) (430 cr); 2.5" HDD 1 TB (5200 rpm) (820 cr); 2.5" HDD 2 TB (5200 rpm) (1,590 cr); 3.5" HDD 1 TB (5200 rpm) (620 cr); 3.5" HDD 2 TB (5200 rpm) (1,180 cr); 3.5" HDD 4 TB (5200 rpm) (2,310 cr); 3.5" HDD 12 TB (5200 rpm) (6,140 cr); 3.5" HDD 512 GB (7200 rpm) (500 cr); 3.5" HDD 1 TB (7200 rpm) (940 cr); 3.5" HDD 2 TB (7200 rpm) (1,810 cr); 3.5" HDD 4 TB (7200 rpm) (3,550 cr); 3.5" HDD 512 GB (10000 rpm) (860 cr); 3.5" HDD 1 TB (10000 rpm) (1,630 cr); 3.5" HDD 2 TB (10000 rpm) (3,160 cr); 3.5" HDD 4 TB (10000 rpm) (6,230 cr); 3.5" HDD 12 TB (10000 rpm) (16,680 cr).
- **Modem:** download speed (every card adds up), and how many hops your route
  can take cleanly. Hops add up too: a card for 2 and a card for 4 carry 6. A
  route may have 8 hops, or as many as your cards carry when that is more
  (two satellite dishes carry 20). It also sets how easily the line is traced: the home fibre
  lines are followed 15% faster, the business fibre 10% slower, and the
  satellite dish 20% slower, but a dish is found from orbit after 120 seconds
  of activity (the trace starts and runs three times faster). The line that
  comes with the Micro PC changes nothing.
  Home Fibre 1 Gbps (800 cr); Home Fibre 2.5 Gbps (2,200 cr); Business Fibre 10 Gbps (7,500 cr); Satellite Dish 25 Gbps (18,000 cr).
- **Security:** sensors and failsafes against traces and raids. They work
  together: the earliest warning, the best shield and any failsafe count. A
  case with no security slot cannot fit them.
  Intruder Alarm Sensors (3,000 cr); Self-Destruct Charge (8,500 cr); Radio Jammer (12,000 cr).

**Money.** The economy is tuned so that the whole software catalogue, a
top-end rig and the running costs come to about what a 15 hour run earns
(about 12 jobs an hour). A job pays its kind's base plus a share for the
host's guard, times (1 + rating / 100), so the pay doubles by rating 100 and
a late job is worth several of the first ones. The tool ladders (bypasses,
the DDoS cannon, the decrypter) start near 1,000 cr and roughly double with
every version. **Running costs** start once the tutorial is done: every game
day the operator pays 60 cr plus 2% of what the rig is worth, so a bigger
machine costs more to keep. What the balance cannot cover waits as **arrears**
and is taken from the next credits that come in. `node v2/tools/economy.mjs`
prints the pay by rating, the kit against the income at each unlock and the
whole run; `v2/tests/economy.test.mjs` keeps those figures in range.

**Thread slots.** Every running task takes one thread slot; cracking,
decrypting and voice work take two. Any number of tasks can be started (the
queue holds eight), but only as many as the slots hold are processing; the
rest show **WAITING** in the tasks window and start, in the order they were
given, as slots free up. A task that does not fit waits while a lighter one
behind it may still run.

**The Live Link.** The link has no side panel: the services, files and logs
use the full width, and every action is a **right click** on its target.
Right-click a **file** for Copy to my computer, Delete the file and (when it is
encrypted) Decrypt; a **locked service** for Crack the password, Hijack the
session or the voice steps, with the lock's version beside yours; a **log** for
Delete all logs or Scrub my own logs; the **host's name** in the header for the
bypasses (firewall, monitor, proxy), DDoS, the network tools and the log wipes.
Only the apps you have installed are listed, and one that cannot run now is
greyed with the reason. The notes under the header carry what the host is known
for. Running tasks have their own draggable window.

**Drive bays.** Bay 1 holds the **system drive (C:)**: the apps live on it.
Bay 2 and up are **storage drives (D:)** and take the downloads. Every machine has
both. The role follows the bay, so it cannot be
moved; the Device Manager names them **SYS Drive** (C:) and **STR Drive 1, 2, ...** (D:), and My Computer shows a C: and a D: card.

- A hard disk (HDD) as the system drive runs every task at **60%** speed (a
  copy is paced by the download drive instead).
- Downloads run at the average speed of the download drives, weighted by size
  (HDD Slim and Archive 50%, 1 TB and 2 TB HDD 75%, SSD 100%).
- The apps must fit the system drive and the files the download drives. Any
  change that would leave them without room (taking a drive out, replacing it,
  fitting a smaller board) is refused and says why. The SYS Drive in bay 1
  cannot just be taken out: buy its replacement first, then fit it from stock
  in bay 1. The data (the apps) is copied over, which takes the machine offline
  for 30 minutes plus 1 minute per GB of apps.
- The machine always keeps one processor, a SYS Drive plus at least one STR Drive (every board has two or more drive bays) and one network card; the
  Micro PC's soldered network card cannot be removed.

Parts you take out go to your **stock**. Selling a part from stock pays 30%
to 55% of its price.

### Building a new system

The **BUILD** tab of the Device Manager makes a second machine while the live
one keeps working, **only from items you already own**: everything comes out of
STOCK (buy it on eForest first). A step bar (CASE, BOARD, PARTS, ASSEMBLE,
MIGRATE) shows where the build is. Start with a case from stock, fit a board,
then pick parts; the kit follows the same slot rules as the live machine, and
the list says what is still missing (a board, a processor, a network card, a
drive). Picked items are reserved, and go back to stock exactly as they were
if you take them out or **SCRAP** the build. **ASSEMBLE** works once the kit is
complete and starts one timer for the whole kit (a board 120 minutes, cards 20,
processors and drives 30, security 25, one after the other); the kit is locked
while it runs.

When the assembly is done, **MIGRATE** lists the live parts: tick the ones that
move to the new machine. The new machine needs a processor, a network card and
a drive; its first drive (the build's own, if it has one) becomes the SYS Drive
and the apps are copied over, so the machine is offline for the new case's
migration time plus 30 minutes and 1 minute per GB of apps. The rest of the old
machine, with its case and board, goes to stock to refit or sell. The IP, credits,
tools and heat stay. The Micro PC's soldered eMMC stays with its board. The link
must be closed first.

Runs saved by an older build cannot be played with this hardware: they are
deleted the first time the game starts.

---

## Software

The tools, each with several versions to buy:

Password Breaker, Relay Cleaner, Firewall Breaker, Alarm Silencer,
Overload Attack, Trace Alert, File Downloader, File Shredder,
File Unlocker, Quiet Log Cleaner, Log Wiper, People Finder,
Email Login Tester, Voice Copier, Fake Identity Kit, Two-Step Login Bypass,
Network Mapper, Key Finder, Staff Pass Forger, Admin Takeover and the HUD programs
(Target Overview, Route Viewer, Company Map).

The shop only sells a tool once the game has a task that uses it.

**Size.** Every tool takes room on the SYS Drive: its cpu cost times 6.5 GB for
version 1, and each later version adds 1.3 times that again (a Decrypter v7 is
57 GB). An upgrade replaces the old version, so only the difference has to fit.
All tools at their top version come to 500 GB, so a 512 GB SYS Drive holds the
whole catalogue.

---

## Rating and unlocks

Your rating rises as you finish jobs, up to 150. It unlocks harder, better
paid work:

| Level | Rating needed |
|---|---|
| 1 | 0 |
| 2 | 6 |
| 3 | 16 |
| 4 | 30 |
| 5 | 48 |
| 6 | 70 |
| 7 | 100 |

---

## What each software level does

A tool has exactly as many versions as it has things to do: a version is only
sold if it does something the one below it does not, so the top version of a
tool beats the hardest target in the game. Tools with one job have one version.
A target needs a version at least as strong as its own rating (lock, firewall,
proxy, monitor strength, encryption, voice lock).

The world is built to match: locks run from 1 to 3 and voice locks are 1,
while the firewall, the monitor and the proxy each go up to 5 and encryption
up to 7. The last host of a company is its crown jewel, one step harder than
the rest. The job board only offers guards the versions your rating has
unlocked can beat (none below rating 6), and pay grows with both the target
(difficulty is the three guards added, up to 15) and your rating (x1.5 at
rating 100). Each version has its own price.

| Tool | Version | What it does |
|---|---|---|
| **CRACKER** | V1 Basic | beats locks up to v1 |
|  | V2 Advanced | beats locks up to v2 |
|  | V3 Master | beats locks up to v3 |
| **AITM** | V1 Basic | beats app MFA |
|  | V2 Advanced | beats app MFA and session-bound MFA |
| **PIVOT** | V1 Basic | scrubs proxies up to PX 1 |
|  | V2 Standard | scrubs proxies up to PX 2 |
|  | V3 Advanced | scrubs proxies up to PX 3 |
|  | V4 Expert | scrubs proxies up to PX 4 |
|  | V5 Master | scrubs proxies up to PX 5 |
| **WAF** | V1 Basic | gets past firewalls up to FW 1 |
|  | V2 Standard | gets past firewalls up to FW 2 |
|  | V3 Advanced | gets past firewalls up to FW 3 |
|  | V4 Expert | gets past firewalls up to FW 4 |
|  | V5 Master | gets past firewalls up to FW 5 |
| **EDR** | V1 Basic | blinds monitors up to strength 1 |
|  | V2 Standard | blinds monitors up to strength 2 |
|  | V3 Advanced | blinds monitors up to strength 3 |
|  | V4 Expert | blinds monitors up to strength 4 |
|  | V5 Master | blinds monitors up to strength 5 |
| **DDOS** | V1 Basic | drops firewalls up to FW 1 and proxies up to PX 1 at once, loudly |
|  | V2 Standard | drops firewalls up to FW 2 and proxies up to PX 2 at once, loudly |
|  | V3 Advanced | drops firewalls up to FW 3 and proxies up to PX 3 at once, loudly |
|  | V4 Expert | drops firewalls up to FW 4 and proxies up to PX 4 at once, loudly |
|  | V5 Master | drops firewalls up to FW 5 and proxies up to PX 5 at once, loudly |
| **SOC** | V1 Basic | warns of a trace 5% earlier |
|  | V2 Standard | warns of a trace 10% earlier |
|  | V3 Advanced | warns of a trace 15% earlier |
|  | V4 Expert | warns of a trace 20% earlier |
| **EXFIL** | V1 Standard | does the whole job |
| **SHRED** | V1 Standard | does the whole job |
| **RANSOM** | V1 Basic | opens files encrypted up to v1 |
|  | V2 Standard | opens files encrypted up to v2 |
|  | V3 Advanced | opens files encrypted up to v3 |
|  | V4 Expert | opens files encrypted up to v4 |
|  | V5 Elite | opens files encrypted up to v5 |
|  | V6 Master | opens files encrypted up to v6 |
|  | V7 Ultimate | opens files encrypted up to v7 |
| **FABRICATE** | V1 Standard | does the whole job |
| **STOMPER** | V1 Standard | does the whole job |
| **CRAWLER** | V1 Basic | PROFILE finds email and role |
|  | V2 Standard | PROFILE finds the phone too |
|  | V3 Advanced | PROFILE finds the social handle too |
|  | V4 Expert | PROFILE finds leaked passwords too |
| **STUFFER** | V1 Standard | opens an inbox with its owner's leaked password |
| **CLONER** | V1 Standard | records voices and matches voice locks up to v1 |
| **SPOOF** | V1 Basic | spoofed calls, phishing and spam; taps need v2 |
|  | V2 Advanced | spoofed calls, phishing, spam and phone taps |
| **MAPPER** | V1 Basic | maps hosts of a company up to difficulty 6 |
|  | V2 Advanced | maps hosts of a company up to difficulty 10 |
|  | V3 Master | maps hosts of a company up to difficulty 15 |
| **IAM** | V1 Basic | opens a locked password service with a stolen key |
|  | V2 Advanced | also opens app MFA services |
|  | V3 Master | also opens session-bound MFA services |
| **KERB** | V1 Basic | forges tickets to hosts of a company up to difficulty 6 |
|  | V2 Advanced | forges tickets to hosts of a company up to difficulty 10 |
|  | V3 Master | forges tickets to hosts of a company up to difficulty 15 |
| **PRIVESC** | V1 Basic | roots the host: opens every password lock, and always raises the alert |
|  | V2 Advanced | also opens app MFA services, and always raises the alert |
|  | V3 Master | also opens session-bound MFA services, and always raises the alert |
| **SURFACE** | V1 Standard | shows the target's whole attack surface in the link panel |
| **HOPS** | V1 Standard | draws the route of the link hop by hop |
| **GRAPH** | V1 Standard | opens the Company Map of the company's segments |

A saved run that owns a version that no longer exists is cut back to the tool's
last version when it loads, and the price of the levels above it is paid back.
A tool that is no longer in the shop (IP PROBE, HUD CONNECTION ANALYSIS and LAN
SCANNER, which no task ever used) is dropped from the run.

---

## Modding the content

Everything the world is made of is JSON in `v2/data/`. In the Windows app, edit your copies in
`Documents\Games\Blackgate`; in the browser, edit `v2/data/` directly. Restart to see changes.
The **Debug** window's SETTINGS tab edits `mainsettings.json` and picks the language file.

| File | Contents |
|---|---|
| `briefs.json` | Job brief texts by kind. Values in `{braces}` are filled in and highlighted. |
| `cities.json` | The cities: country code, name, and `x` / `y` as fractions of the world map. |
| `clients.json` | The clients who post jobs. |
| `companies.json` | Company name prefixes and endings by kind of company. |
| `countries.json` | Country outlines for the map (built by `v2/tools/countries.mjs`). |
| `darknet.json` | DSNET: the brokers, categories, rumours and 404 pages. |
| `files.json` | File names found on machines. |
| `hardware.json` | Cases and parts: slots, tiers, figures and prices. |
| `mainsettings.json` | The main game numbers: profiles, companies, people, relays, starting cash, route / job / notepad / tab limits, bank rates, and the `language`. A missing or out-of-range value falls back to the built-in one. World numbers only shape a new world. |
| `language/<code>.json` | Every fixed string of the interface (`en.json`); `index.json` lists the languages. To translate, copy `en.json`, translate the values, add the code to `index.json` and pick it in Debug. Text inside the larger HTML templates is not moved yet. |
| `missions.json` | Story missions. |
| `pastes.json` | The texts that PasteDump shows. |
| `news.json` | News stories. |
| `people.json` | First names (with sex), surnames and job roles. |
| `rivals.json` | Rival operators. |
| `software.json` | The tools, their versions and prices. |
| `unlocks.json` | The rating needed for each level. |
| `hints/*.json`, `sessionActions/*.json` | One file per in-game hint / per action in the link's action menu. |
| `images/socialmedia/images.json`, `text.json` | SleekPages photos and captions (built by `populate.bat`). |

City positions use plain longitude and latitude: `x = (lon + 180) / 360`, `y = (90 - lat) / 180`.
Changing `cities.json`, `people.json` or `companies.json` changes the worlds that new runs build from a
seed. **World generation is deterministic from the seed**; do not add random draws to it.

---

## Images

All images live in `v2/data/images/`. Each folder has a `WHAT-TO-PUT-HERE.txt` with the file names and
the ideal size in pixels (a folder you have filled in may have dropped it). **A missing image shows a
grey rectangle**, so you can add them one at a time.

| Folder | What |
|---|---|
| `apps/` | One icon per application (128x128) |
| `software/` | One icon per tool (128x128) |
| `brokers/`, `categories/` | DSNET broker banners and category art |
| `eforest/departments/`, `eforest/products/` | eForest department and product art |
| `people/male/`, `people/female/` | Portraits: whatever is in these folders is used, there is no list file |
| `socialmedia/<topic>/` | SleekPages photos; captions in `text.txt`; run `populate.bat` after changing them |

---

## Building from source

Requirements: **Node.js** (a recent LTS release), and **Windows** to build the `.exe`.

```bash
npm install
```

| Command | What it does |
|---|---|
| `npm run ui` | The Vite dev server with live reload (`runv2.bat` also opens the browser). |
| `npm run ui:build` | A production build into `v2/dist`. |
| `npm start` | Builds `v2/dist` and runs it in Electron. |
| `npm test` | Runs the test suite (`node --test v2/tests/*.mjs`). |
| `npm run dist` | Builds v2, then the app files, `latest.json` and the launcher in `dist/`. No upload. |
| `npm run release` | Does the same, then uploads them to the GitHub release `v<version>`. |

`build.bat` shows these in a menu.

**How a build works** (`electron/release.js`):

1. `npm run ui:build` builds the game into `v2/dist`.
2. `electron-builder --win dir` packages it with Electron into `dist/win-unpacked` (English language
   pack only).
3. A new build id is written to `resources/build.json`.
4. Every file of `dist/win-unpacked` is hashed; `dist/latest.json` lists each one (path, SHA-256, size
   and the release that holds it) with the version and build id. There is no zip. A file an earlier
   release already holds is not uploaded again, and `BLACKGATE.exe` is reused while Electron's
   version is unchanged. On the release page the files are assets named by their hash.
5. `electron/launcher.nsi` is compiled with NSIS into `dist/Blackgate_Installer.exe`, which carries only
   `electron/launcher.ps1`, the updater.
6. `npm run release` uploads `Blackgate_Installer.exe` and `latest.json` to the release `v<version>`, and the new app files to a separate pre-release `app-files` (so the version's release page shows only two files), with the GitHub CLI
   (`gh`, logged in). A new version makes a new release; running it again at the same version replaces
   that release's files, which ships a new build to every launcher.

**To release:** raise `version` in `package.json` **and** `VERSION` in `v2/game/version.js` (a test
fails if they differ), commit and push, then run `npm run release`.

**How the Electron shell works** (`electron/main.js`):

- `v2/dist` is served over a private `app://blackgate/` address, so `fetch()` and ES modules work as on
  a web server. Only files inside it can be served.
- Requests for content JSON are answered from your copy in `Documents\Games\Blackgate` first, then
  from the built-in copy.
- Saves go through a small bridge (`electron/preload.js`) that gives the game the same calls as
  browser local storage but writes files, atomically (a temporary file, then a rename), so a crash
  cannot destroy the previous save. Save names are plain names, never paths.
- The page runs with context isolation on and Node.js access off.
- `electron/files.js` has no Electron code, so the test suite loads it.

---

## Tests

```bash
npm test
```

The suite uses Node's built-in test runner and covers the simulation, the economy, contracts,
records, saves, the windows, the map and the Electron file helpers. World generation is deterministic:
the same seed always builds the same world, and the tests check this. `v2/tests/docs.test.mjs` checks
that this README lists every case, board, part and tool with its price, so the tables above must be
kept in step with `v2/data/*.json`. Tests for the old canvas windows draw onto a recording stand-in
(`v2/tests/stubCanvas.mjs`); the DOM apps themselves have no tests yet.

---

## Project layout

```
build.bat            menu of npm commands
runv2.bat            starts the dev server and opens it
package.json         scripts and Electron build settings
v2/
  index.html         the page the game runs in
  app/               the DOM shell: main loop, windows, header, login, screens, tutorial,
                     keys, tooltips, effects
    apps/            one file per application (info.js + infoText.js are the manual)
  game/              the rules and world: core, data, state, systems (never imports app/)
  pages/             canvas-era builders the DOM still reads (to be ported away)
  data/              the content JSON and the images
  tools/             content scripts
  tests/             the test suite
  vite.config.mjs    Vite + Tailwind config
electron/            the Windows app: main, preload, file helpers, launcher and release script
build/               the app icon
```

---

## Tools

| Tool | Use |
|---|---|
| `node v2/tools/countries.mjs <ne_50m_admin_0_countries.geojson>` | Rebuilds `countries.json` from Natural Earth's countries file. Antarctica is left out. |
| `node v2/tools/socialmedia.mjs` (or `v2/data/images/socialmedia/populate.bat`) | Rebuilds the SleekPages lists: `images.json` and `text.json`. |
| `node v2/tools/economy.mjs` | Prints the pay by rating, the kit against income at each unlock and the whole run. |
| `npm run release` | Builds the launcher, app files and `latest.json` and uploads them to a GitHub release. |

---

## Credits and licences

- **Map data:** country outlines from [Natural Earth](https://www.naturalearthdata.com/) (1:50m Admin 0
  countries), which is in the public domain.
- **Electron** and **electron-builder** build the Windows app. Their licences ship inside the build
  (`LICENSE.electron.txt`, `LICENSES.chromium.html`).
