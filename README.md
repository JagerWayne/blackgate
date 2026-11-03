# BLACKGATE

A network-intrusion simulation game set inside a Windows-XP-style desktop.

You are a freelance operator. A broker hands you jobs; you find the target
machine, route your connection through relays, break in, do the work, wipe
your tracks and get paid. Every action leaves a log somewhere, and logs are
what get people caught. If a trace reaches you while you are connected, or
the heat from the evidence you leave behind reaches 100, the run is over.

The game is written in plain JavaScript (ES modules) and draws everything on
one HTML canvas. There is no framework and no build step for the game
itself. All content (companies, people, jobs, tools, hardware, cities, news)
lives in JSON files you can read and edit.

### ⬇ [Download the installer (blackgate.exe)](https://github.com/JagerWayne/blackgate/releases/latest/download/blackgate.exe)

Windows 10/11. Run it once: it installs the game, adds a desktop shortcut and
keeps the game up to date. All releases are on the
[releases page](https://github.com/JagerWayne/blackgate/releases).

---

## Contents

- [Running the game](#running-the-game)
  - [Windows app (blackgate.exe)](#windows-app-blackgateexe)
  - [In a browser](#in-a-browser)
- [Where your files live](#where-your-files-live)
- [How to play](#how-to-play)
- [Controls](#controls)
- [The applications](#the-applications)
- [Command Prompt](#command-prompt)
- [Jobs](#jobs)
- [People and OSINT](#people-and-osint)
- [Internet XPlorer](#internet-xplorer)
  - [DSNET](#dsnet)
  - [SleekPages](#sleekpages)
  - [Company websites](#company-websites)
- [Traces, heat and raids](#traces-heat-and-raids)
- [Your machine: the gateway](#your-machine-the-gateway)
- [Software](#software)
- [Rating and unlocks](#rating-and-unlocks)
- [Cheat menu](#cheat-menu)
- [Modding the content](#modding-the-content)
- [Building from source](#building-from-source)
- [Tests](#tests)
- [Project layout](#project-layout)
- [Tools](#tools)
- [Credits and licences](#credits-and-licences)

---

## Running the game

### Windows app (blackgate.exe)

[Download `blackgate.exe`](https://github.com/JagerWayne/blackgate/releases/latest/download/blackgate.exe)
(or pick it from the
[latest release](https://github.com/JagerWayne/blackgate/releases/latest))
and run it. It is a small launcher (about 60 KB): the game itself comes from
GitHub. It needs no installer and no administrator rights.

- **First run:** the launcher copies itself to `Documents\Games\Blackgate`,
  puts a **BLACKGATE** shortcut on the desktop, downloads the game (about
  125 MB) with a progress bar, checks it against the SHA-256 published with
  the release, installs it to `Documents\Games\Blackgate\app`, and starts it.
- **Later runs:** it asks GitHub for the latest release. If the installed
  build is the latest, the game starts straight away. If a newer build is
  out, it is downloaded and installed first, and a small window shows it:
  `Updating to version 0.9.0... 37%`, then `checking the download`,
  `installing`, and `Updated to version 0.9.0. Starting...`. The login
  screen then says which version you came from.
- The login screen shows the installed version and build.
- **Offline**, or when GitHub cannot be reached, the installed game starts
  as it is. With nothing installed yet, the launcher says it could not
  download the game.
- The shortcut is made again if you delete it. Moving or deleting the
  downloaded `blackgate.exe` does no harm: the shortcut points to the copy in
  `Documents\Games\Blackgate`.
- Every build has its own **build id**: the version plus the build time, for
  example `0.2.0+20261101T174943713Z`.
- The game starts **full screen**. **F11** switches it on and off. The
  window has no menu bar.
- **Turn off computer** shows "Press Alt + F4 to exit or any key to
  reboot": **Alt + F4** closes the game.

An update only replaces `app\`, and only once the new copy is downloaded,
checked and unpacked: a failed update leaves the installed game working.
Your saves and your edited content files sit beside `app\` and are never
touched by an update.

### In a browser

The game must be served over HTTP. Opening `index.html` directly as a
`file://` page does not work, because the game loads its content with
`fetch()`.

- On Windows, run **`run.bat`**. It serves the folder on
  **http://localhost:8001/** and opens your browser. It uses the first of
  these it finds: Python 3 (`python` or `py`), or Node.js (`npx serve`).
- Any static file server works, for example:

  ```bash
  python -m http.server 8001
  ```

  then open http://localhost:8001/.

In the browser, saves are kept in the browser's local storage, and the game
reads its content straight from the `data/` folder.

---

## Where your files live

The Windows app keeps everything for your Windows account in
**`Documents\Games\Blackgate`**:

| Path | What it is |
|---|---|
| `app\` | The installed game. Replaced by each new build. |
| `app\version.json` | The version and build id of the installed copy. |
| `saves\<OPERATOR>.json` | One save file per profile (four at most). It holds the whole world (40 companies, 2,000 people), your dossiers and your run: about 0.7 MB. |
| `hosts\<OPERATOR>.json` | The machines that operator has connected to, written on every save: security, services, logs (yours marked) and files (copied, deleted, decrypted). |
| `*.json`, `hints\`, `sessionActions\`, `images\people\index.json`, `images\socialmedia\*.json` | Your copy of the game's content files. |
| `data-version.json` | The build that last checked your content files, and a hash of each file as the game copied it (to tell a file you edited from one you never touched). |
| `blackgate.log` | Warnings, for example about content files that differ from the game's. |

**First run:** the folder and `saves\` are created, and every content JSON
file the game ships is copied in.

**After an update:** a content file you never edited is replaced with the new
build's copy. A file you **did** edit is never overwritten: it is kept as it
is and a warning is written to `blackgate.log`. To take the new version of an
edited file, delete your copy; it is copied again on the next launch. A copy
made by a build from before this rule has no recorded hash, so it counts as
edited until you delete it once.

**Broken files:** if one of your content files is missing or is not valid
JSON, the game uses its built-in copy instead and shows a message naming the
file it could not read.

---

## How to play

1. **Boot.** The machine boots and types out its start-up log.
2. **Log in.** The login screen lists up to **four profiles**. Pick one to
   carry on its run, or choose **NEW SESSION** and type a handle.
   - Each profile has one save. Starting a new session under a handle that
     already has a save replaces it; the login screen warns you in red first.
   - With four profiles in use, a new handle is refused: **DELETE SAVE** one
     first (press it twice to confirm).
3. **Watch your world being made.** A new profile gets its own random world.
   The setup screen registers the **40 companies** (name, website, industry,
   city), then creates the **2,000 citizens** (about 900 staff and 1,100
   civilians, each with a full dossier), with counters, progress bars, a
   running log and their portraits. Any key or click speeds it up. This pool
   is everyone in the game; most of them never matter.
4. **Take a job.** **Internet XPlorer** opens on its start page: go to
   **DSNET**, pick a listing, read the brief and press **ACCEPT** (or haggle
   first).
4. **Find the target.** **SHOW TARGET** reveals the machine on the
   **NEXUS MAP** and selects it, and the map glides to it.
5. **Plan a route.** Add relay hops to your bounce route on the map. More hops
   slow the trace down.
6. **Connect.** Press **LINK** to open the connection in **Bl@ckG@te**, your
   hacking client.
7. **Do the work.** Break the password, deal with the firewall, monitor and
   proxy as needed, and carry out the job: copy a file, delete it, change a
   record, and so on.
8. **Clean up.** Delete or edit the logs your visit left, then disconnect
   before the trace reaches you.
9. **Get paid.** Press **SUBMIT WORK** in **MY JOBS** on DSNET. The fee goes to
   your bank account, and your rating rises.
10. **Upgrade.** Spend the money in **GATEWAY** (hardware) and **SOFTWARE**
    (tools) to take on harder jobs.

The first jobs are on soft machines with no firewall, monitor or proxy.
Hardened machines appear as your rating grows.

The game saves automatically every 45 seconds (this can be switched off in
**SYSTEM**). If a save fails, a message tells you.

---

## Controls

| Input | Action |
|---|---|
| Mouse | Everything: windows, buttons, lists, the map |
| `` ` `` (backtick) | Open the **Command Prompt** with the typing in it |
| `Space` | Pause or resume the clock |
| `D` | Switch between the light and dark skins |
| `Tab` / `Shift+Tab` | Move between text fields |
| `Enter` | Press the highlighted (default) button |
| `Esc` | Leave a text field, close the Start menu, or close an open dropdown |
| `F11` | Full screen on and off (Windows app; it starts full screen) |
| `Alt + F4` | Quit the game |
| Any key | Turn the machine back on after **Turn off the PC** (Alt, Ctrl, Shift and Windows do not count) |

**In Notepad:** the arrow keys, `Home` and `End` move the caret, a click puts
it where you click, and typing, `Backspace`, `Delete` and paste work at the
caret.

The backtick, `Space` and `D` only act when you are not typing in a field.

**On the NEXUS MAP:**

| Input | Action |
|---|---|
| Mouse wheel | Zoom in and out around the pointer (1× to 8×) |
| Drag | Pan the map |
| Hover a city | Highlight it, light up the other cities of its country, and list the machines found there |
| Click a city | Select its first machine |
| Hover or click a pin | Show or select that machine |
| Pick a machine in the list | The map glides to it and zooms in |

**Windows** can be moved by their title bar, resized from their edges, and
minimised, maximised or closed with the title-bar buttons. Each open window
has a button on the taskbar.

---

## The applications

All are opened from the Start menu and appear on the taskbar while open.

| Application | What it does |
|---|---|
| **Bl@ckG@te** | The hacking client. Shows the live connection and, once the link is up, the target's services, files, logs, records and staff (PEOPLE), and the actions you can run on the host, such as **BYPASS FIREWALL**, **BLIND MONITOR**, **SCRUB PROXY** and **WIPE LOGS**. An action that cannot run says why. |
| **MAIL** | Messages from the broker, clients and contacts. **MARK ALL READ** clears the unread count. It no longer opens at the start of a run; the welcome mail waits in it. |
| **Internet XPlorer** | The web browser, and the only window open when a run starts. Its start page links to **DSNET** (the job market), **SleekPages** (the social network) and the **Business Directory** (every company's website). See [Internet XPlorer](#internet-xplorer). |
| **NEXUS MAP** | The world map with every machine you have discovered, a search and a **KIND** dropdown (All, Relay, Public…). Beside it, three tabs: **HOSTS** (the list, with **+HOP** / **-HOP** and **LINK** on every row, and the picked host's card), **ROUTE** (your hops as a chain from your gateway to the target, each with **UP**, **DOWN**, **SHOW** and **REMOVE**, green while your gateway hides it cleanly and red when it slows the link) and **SAVED** (kept routes with **USE** and **DELETE**). **SHOW ON MAP** anywhere selects the host on the map *and* in the HOSTS list. |
| **GATEWAY** | Your own computer: the chassis and the parts in it, a shop for new parts, and a stock of parts you have taken out. |
| **SOFTWARE** | The tool shop: tool cards coloured by family (break-in, bypass, stealth, data, recon, social) with **ALL / INSTALLED / SHOP** filters, and a spec sheet with an upgrade track (one step per version the tool has), one big **BUY / UPGRADE** button and the RAM the tool takes while running. |
| **STORAGE** | The files you have downloaded, against your drive space. |
| **BANKING** | Your money and transactions. |
| **DOSSIERS** | Everyone you have on file: what you know about them and what you have done to their phone and inbox. See [People and OSINT](#people-and-osint). |
| **NEWSWIRE** | The news, including stories about the work you have done. |
| **OPERATOR** | Your rating, rank and statistics. |
| **SYSTEM** | The light (LUNA) or dark (NOIR) skin, autosave every 45 seconds, an 8× fast-forward for the world clock, **SAVE NOW** and **SAVE + QUIT**. |
| **Notepad** | Notes kept with your run: up to 12 notepads as tabs (**+ NEW** makes an UNTITLED one, **×** pressed twice deletes), line numbers, word wrap, scroll bars and a caret you move with the arrow keys. || **Command Prompt** | Type commands to drive every other application. See [Command Prompt](#command-prompt). |

Two more windows are not in the Start menu: **CHEATS** and
**MISSION BUILDER** (see [Cheat menu](#cheat-menu)).

---

## Command Prompt

Open it from the Start menu or with the **backtick** key (`` ` ``). Commands
take the form **`<app> <action> [what]`**, for example `mail read new` or
`ct accept 12`. A command that changes the game does exactly what the
matching button does, with the same costs, checks and messages.

- **Pointing at things:** after a list, `#n` picks its n-th row
  (`ct list`, then `ct accept #2`). Hosts can also be named by IP or name,
  contracts by id, files by name.
- **Spaces:** put text with spaces in quotes: `bg alter "Ana Diaz" status deceased`.
- **Keys:** `Enter` runs the line, `Tab` completes it (commands, actions,
  file names, IPs, contract ids, tools), `Up`/`Down` recall earlier lines,
  `Esc` clears the line, and the mouse wheel scrolls back.
- **Safety:** commands that take a part out of your machine or wipe the
  notepad need `--yes`.
- Typing an app's name alone lists its commands.

**General**

| Command | Does |
|---|---|
| `help [app]` | The apps, or one app's commands |
| `apps` | The applications and which are open |
| `open <app>` / `close <app>` | Open or close an application's window |
| `clear` | Clear the screen |
| `history` | The commands typed this session |
| `whoami` | Handle, rank, rating, money and heat |
| `time` | Game time, clock speed, paused or not |
| `pause` / `resume` | Stop or start the clock |
| `save` | Save now |
| `exit` | Close the command prompt |

**mail**

| Command | Does |
|---|---|
| `mail list [new\|all]` | The messages, newest first (`*` = unread) |
| `mail read <#\|new>` | Show a message and mark it read; `new` reads the oldest unread one |
| `mail readall` | Mark every message read |
| `mail accept <#>` / `mail decline <#>` | Answer the job a message offers |
| `mail target <#>` | Show the offered job's target on the map |

**contracts** (`ct`)

| Command | Does |
|---|---|
| `ct list [offered\|accepted\|ready\|done\|all]` | Jobs with id, kind, payout and deadline |
| `ct show <id>` | The full brief and objective |
| `ct accept <id>` / `ct decline <id>` | Take or turn down an offered job |
| `ct drop <id>` | Abandon an accepted job |
| `ct target <id>` | Reveal and select the target on the map |
| `ct link <id>` | Connect to the target through your route |
| `ct submit <id>` | Hand in finished work and get paid |

**map**

| Command | Does |
|---|---|
| `map hosts [kind] [text]` | Found hosts, filtered by kind (`relay`, `bank`, `gov`, `fav`, …) or text |
| `map show <host>` | IP, owner, kind, security, services and the records it keeps |
| `map select <host>` | Select it; the map glides to it |
| `map fav <host>` | Mark or unmark a favourite |
| `map route` | Show the bounce route |
| `map route add <host>` / `map route remove <host>` | Add or remove a hop |
| `map route clear` / `map route save` | Empty or keep the route |
| `map routes` | The saved routes |
| `map route load <#>` / `map route delete <#>` | Use or delete a saved route |
| `map link <host>` | Connect through the current route |

**blackgate** (`bg`)

| Command | Does |
|---|---|
| `bg connect <host>` / `bg disconnect` | Open or close the live link |
| `bg status` | Heat, the trace and the running tasks |
| `bg services` / `bg files` | What the host offers |
| `bg logs [wipe\|scrub]` | Show the logs; `wipe` deletes them, `scrub` quietly removes only yours |
| `bg records [text]` | The people on the host, with search |
| `bg crack [service #]` | Break a password (the first locked password service by default) |
| `bg record [service #]` | Call a voice lock's admin and record their voice (needs the NEURAL VOICE CLONER) |
| `bg voiceprint [service #]` | Play the admin's recording to open a voice lock |
| `bg hijack [service #]` | Capture a session behind MFA (the token lasts 40 s) |
| `bg netmap` / `bg forge <host>` | Map the company's hidden segments / move the link to another host of the company |
| `bg probe` / `bg root` | Open a lock with a service-account key / escalate to root (always raises the alert) |
| `bg bypass firewall\|monitor\|proxy\|ddos` | Bypass a defence (`ddos` drops the firewall and the proxy together, but starts the trace at once and three times as fast) |
| `bg copy <file>` / `bg delete <file>` / `bg decrypt <file>` | File tasks |
| `bg alter <person> <field> <value>` | Change a record |
| `bg osint` | Run an OSINT sweep |

**gateway** (`gw`)

| Command | Does |
|---|---|
| `gw specs` | The fitted parts, by slot |
| `gw shop [cpu\|storage\|modem\|security\|chassis]` | Parts for sale |
| `gw buy <#> [--yes]` | Buy from the last shop list (`--yes` if it takes a part out) |
| `gw remove <slot #> --yes` | Take a part out into stock |
| `gw stock` | The parts in stock |
| `gw fit <#>` / `gw sell <#> --yes` | Fit or sell a part from stock |

**Other applications**

| Command | Does |
|---|---|
| `sw list` / `sw shop` / `sw info <tool>` | Your tools, the shop, what a tool does |
| `sw buy <tool> [version]` | Buy or upgrade a tool (the next version by default) |
| `storage list` / `storage space` / `storage delete <file>` | Your downloads and drive space |
| `bank balance` / `bank ledger [n]` | Your money and the last n transactions |
| `news list` / `news read <#>` | The newswire |
| `operator` | Rating, rank and statistics |
| `sys autosave on\|off` / `sys fast on\|off` / `sys theme light\|dark` | Settings |
| `sys save` / `sys quit` | Save, or save and log out |
| `dsn open [address]` / `dsn search <text>` | Open a page in Internet XPlorer (DSNET's hub by default; `sleekpages`, `directory` or a company's `www.<name>.nx` work too) or search DSNET |
| `dsn haggle <job> <amount\|+n%>` / `dsn reply <job>` / `dsn take <job>` | Ask for a bigger fee, read the client's answer, take a counter-offer |
| `ppl list` / `ppl staff` / `ppl show <person>` | Everyone on file, the linked company's staff, one dossier |
| `ppl profile\|call\|spoofcall\|tap\|inbox\|phish\|spam <person>` | The OSINT, phone and inbox attacks (see [People and OSINT](#people-and-osint)) |
| `notepad show` / `notepad write "<text>"` / `notepad wrap on\|off` / `notepad clear --yes` | The open notepad |
| `notepad list` / `notepad new [name]` / `notepad open <n>` / `notepad rename <name>` / `notepad delete <n> --yes` | Your notepads |

**cheat** (left out of `help`; `help cheat` shows it): `cheat money <n>`,
`cheat heat <0-99>`, `cheat rating <n>`, `cheat speed <1|2|4|8|16>`,
`cheat reveal`, `cheat tools`, `cheat gateway`, `cheat mission`.

---

## Jobs

Jobs come from clients through the broker. Each has a target machine, an
objective, a payout and a deadline. The kinds of job:

- **Retrieve:** copy a file from the target to your storage.
- **Model:** steal an AI model from an AI lab's machine.
- **Delete:** delete a file on the target.
- **Destroy:** delete every file on the target and leave no logs.
- **Transfer:** move money out of a bank's machine.
- **Alteration:** change a detail of a person's record.
- **Story:** missions that are part of the story.

**People and records.** The world has a population of people, each with a
name, sex, SSN, criminal record, vital status, role, security clearance,
work email, employer and social handle. Each detail lives on the machines
that would really keep it:

- **name, sex, SSN, criminal record:** government machines;
- **vital status:** a health company's machines;
- **social handle:** a media company's machines;
- **role, clearance, work email, employer:** the person's own employer's
  machines.

The **RECORDS** tab in Bl@ckG@te lists the people on the connected machine,
with search and a portrait, and is where alteration jobs are carried out.

Briefs mark their key details in `{braces}`, and those details are
highlighted when the brief is shown.

---

## People and OSINT

Every world has **2,000 people**: about 900 work for the 40 companies, and
about 1,100 are civilians (freelancers, students, nurses, retirees…) with
mail at public providers. Everyone has a full dossier: a phone, an email, a
social handle, a role, a city, a clearance level and, sometimes, a password
leaked in an old breach. You start knowing none of it.

**Public and private.** Each person shows some details to the world and keeps
others private (fixed for the world). A public email, phone or handle appears
as a link on their [SleekPages](#sleekpages) profile and on their
[company's website](#company-websites): **click it and it goes into the
dossier** ("EMAIL of … added to the dossier"), with a ✓ beside it from then
on. A detail picked up this way unlocks the same attacks as one found by
PROFILE. Private details still need OSINT.

**Finding people.** An OSINT sweep on a link (`bg osint`) adds the company's
staff to **DOSSIERS** as leads. The **PEOPLE** tab of a live link lists the
staff of that company. **PROFILE** fills in a dossier; the better your OSINT
SWEEPER, the more it finds:

| SOCIAL OSINT CRAWLER | PROFILE finds |
|---|---|
| v1 | email and role |
| v2 | + phone |
| v3 | + social handle |
| v4+ | + leaked password |

**Working on people.** Attacks run as tasks while you are linked to a host of
the person's company. Each button says what it needs and what it gets.

| Attack | Needs | Gets you |
|---|---|---|
| **CALL + RECORD** | phone, NEURAL VOICE CLONER | a voice recording (for voice locks); leaves a call log |
| **SPOOFED CALL** | phone, SPOOF KIT | the same recording, posing as their IT desk: no log, slower |
| **TAP PHONE** | phone, SPOOF KIT v2 | a password they read out: opens the strongest lock their clearance reaches on their company's hosts |
| **HACK INBOX** | email, plus their leaked password and the CREDENTIAL STUFFING ENGINE, or a cracker at their clearance | their mail: every host of the company on your map, colleagues as leads, and (clearance 3+) a saved password that opens a lock |
| **PHISH** | email, SPOOF KIT | a fake reset mail. Three game hours later they take it or not (the lower their clearance, the likelier): if taken, the inbox is hacked and a lock opens |
| **SPAM** | email, SPOOF KIT | their inbox buried for a day. If they are the host's admin (highest clearance), links to their hosts trace 30% slower |

**Voice locks** open to their admin's voice: profile the admin to v2 for their
phone, record them (the voice lock's **RECORD**, or a call from PEOPLE), then
**VOICEPRINT**.

---

## Internet XPlorer

The desktop's web browser, and the only window open when a run starts. It
has tabs that close with their own **×** (up to six; the last stays open),
back, forward, reload, home, an address bar and a three-relay circuit (click
it to route through new relays). Home and new tabs open the **start page**,
with three bookmarks:

| Bookmark | Address | What it is |
|---|---|---|
| **DSNET** | `dsnet` (or `dsn://hub`) | The hidden job market. See [DSNET](#dsnet). |
| **SleekPages** | `sleekpages` (or `sleekpages.com`) | The social network. See [SleekPages](#sleekpages). |
| **Business Directory** | `directory` | Every company's website, by industry. See [Company websites](#company-websites). |

### DSNET

All jobs live on **DSNET**, "the market for the anonymous", a TOR-like hidden
market (it replaced the old CONTRACTS app). The board keeps 6 open offers,
one more for every 30 rating, up to 10. The header's HUB button and every
"show me the job" link go straight to it.

| Address | Page |
|---|---|
| `dsn://hub` | The portal: search, the six categories, the biggest fees, the brokers |
| `dsn://cat/<kind>` | DATA HEISTS, SCRUBBERS, PAPERWORK, MONEY MOVES, BURN BOOK, MIND THEFT |
| `dsn://<broker>.dsn` | Each client's own site, with its banner, tagline, listings and an about page |
| `dsn://job/<id>` | A listing: brief and target on the left, the deal and the client channel on the right |
| `dsn://jobs` | MY JOBS: the work you hold (SUBMIT, LINK NOW, SHOW ON MAP, DROP asks twice), deals waiting on a reply, and your history |
| `dsn://lookup/<company>` | LEAKBASE: what is known about a target company, its hosts and its staff |
| `dsn://board` | The undernet board: rumours that change every day |

DSNET is always dark, whatever the desktop skin. On its pages a sidebar
shows HUB, MY JOBS, the six categories with their counts, the brokers and the
board. Listings show as cards
with the fee, the time left as a bar, the stars, the broker and VIEW and
ACCEPT. A status bar at the bottom counts open listings, your jobs, replies
waiting and your money.

**Haggling.** On a listing, ask for +10%, +25%, +50% or an exact amount.
The client answers a few game minutes later:

- **Yes:** the fee rises to your ask.
- **Counter-offer:** halfway between the posted fee and your ask; take it or leave it.
- **No:** the posted fee stands.
- **Insulted:** ask for more than double and the listing is pulled, and that client will not deal with you for a game day.

**Answering a counter-offer.** You can **TAKE** it, or **COUNTER** once with
an amount between their figure and your ask (the button shows the chance; a
second round is harder, and ends in yes or no). **DECLINE THE JOB** (press it
twice) walks away at any point and the listing goes.

The talk with the client is shown as a **chat console**: the client on the
left in their colour, you on the right in blue, a name and time on each
message, long lines wrapped, and a status line ("… is typing", "counter-offer
on the table", "channel closed").

The chance of a yes is `exp(-over x 1.78 x temper / (0.5 + rating / 150))`,
capped at 97%, where `over` is how far above the fee you ask (0.25 for +25%)
and `temper` is the client's (0.8 flexible to 1.3 stubborn). Roughly: +10% is
about 70% at rating 0 and 90% at LEGEND; +50% is about 17% at rating 0 and 50%
at LEGEND. The odds are shown on each button. One ask per job, and the same
ask on the same job always gets the same answer.

The broker sites, categories, rumours and 404 pages live in
`data/darknet.json` and can be edited like the other data files.

### SleekPages

A light, Facebook-style social network: a blue top bar (**Feed**,
**People**) and white cards on grey.

- **Feed:** posts from random people of the world, a new set every time the
  page loads or is reloaded. Each post has the person's face, name, time and
  city, a caption, a **square photo** on the same topic (cars, city, food,
  pets), likes and comments. Click a name to open the profile.
- **People:** search everyone by name, job, company or city, fifty to a page
  with **PREVIOUS** / **NEXT**.
- **Profile:** a cover banner, a large portrait, name, job and company, an
  **About** box (works at, lives in, handle, email, phone) and three of their
  posts. Public details are links that go into the dossier when clicked;
  private ones read "private". **VIEW DOSSIER** puts the person on file and
  opens DOSSIERS.

The photos are in `data/images/socialmedia/<topic>/` and the captions in
`data/images/socialmedia/text.txt` (numbered lines under `### Topic`
headings). After adding photos or lines, run
`data/images/socialmedia/populate.bat` (or `node tools/socialmedia.mjs`): it
writes `images.json` and `text.json`, which the game reads. A new topic needs
both a folder and a heading of the same name.

### Company websites

Each of the 40 companies has a website, listed in the **Business Directory**.
The address comes from the name (`www.vantasystems.nx`), and the look is one
of **ten themes** picked for the world: CORPORATE BLUE, MIDNIGHT, FOREST,
SUNSET, MONOCHROME, ROYAL, TERMINAL, OCEAN, CRIMSON and SAND, each with its
own colours and header layout.

| Page | Address | What it shows |
|---|---|---|
| **Home** | `www.<name>.nx` | About us and what the company does |
| **Our team** | `www.<name>.nx/team` | Every staffer: square photo, name, role, and their email and phone where public (click to add to the dossier; click the photo or name for their SleekPages profile) |
| **Contact** | `www.<name>.nx/contact` | Reception's email and phone, and the city |

---

## Traces, heat and raids

- **The trace.** While you are connected, the target traces you back along
  your bounce route. More hops slow it down. A warning appears when it is
  getting close; a SOC TRACE INTERCEPTOR makes the warning come earlier. If the trace completes, the connection is seized
  and **the run is over**. Disconnect in time. The one exception is the
  GHOST-VPS BASTION: its provider pulls the plug and **wipes every file on
  your drives**, but the run goes on (credits, tools and the world are kept).
- **Copying and the window.** A copy takes the file's size over your uplink
  (1.2 GB a second for every Gbps; the files tab shows the seconds). A host
  whose firewall, monitor and proxy add up to 6 or more drops your session on
  its own clock: 90 seconds at 6, 15 fewer for each step, never under 45. Its
  datastore dump (150 to 450 GB) is too big for a 1 Gbps line inside that
  window; a 10 Gbps rack takes it in time. A timeout is not a capture: the
  copies under way are lost and the logs you left still count.
- **MFA and tokens.** A host that is hard enough puts its back-end locks (admin,
  records, bank, database, AI) behind more than a password: from difficulty 4
  **app MFA**, from 7 **session-bound MFA**, and on the big banks and
  ministries from 9 a **hardware token**. A cracked or stuffed password is not
  enough behind MFA; the SESSION TOKEN HIJACKER (v1 beats app MFA, v2 session-bound
  MFA) captures a live session instead (HIJACK, or `bg hijack`). The token lasts
  40 seconds: when it runs out the service locks again, an alteration under way
  is lost, and the host notices (the trace starts and jumps). Closing the link
  takes the token back. A hardware token wants the HSM TAP fitted; with it the
  lock is cracked like a password. The same goes for a company's mail: behind
  MFA, credential stuffing and brute force are blocked and only the hijacker
  opens an inbox. Alteration jobs only appear on hosts whose guard your rating
  can beat (MFA from rating 6, session-bound from 16, tokens from 30).
- **Internal networks.** The last host of a company that guards it is its
  crown jewel and an **internal segment**: it cannot be linked from outside
  (the map marks it INTERNAL). Link to another host of the company, then
  move inside:
  - the **ZERO-TRUST MAPPER** maps the company's hidden hosts onto your map,
    up to the difficulty its version reaches (6, 10, any);
  - the **KERBEROS FORGER** forges a ticket that moves the live link to
    another host of the same company (`bg forge <host>` or the CLOUD GRAPH
    window), with the same reach. The host you leave becomes a hop of the
    route (its logs still count as heat), the firewall and the proxy are
    behind you, the monitor is not, and the trace goes with you. Wait for the
    running tasks to finish first;
  - the **IAM PROBE** opens one locked service quietly with a stolen
    service-account key (v1 password locks, v2 also app MFA, v3 also
    session-bound MFA; never a hardware token);
  - the **KERNEL PRIVESC** (`bg root`) opens every lock it reaches at once,
    but the incident responder always comes: the trace starts, jumps and runs
    twice as fast.

  The job board offers internal hosts from the third unlock level (rating 16).
  Three HUD programs only add information: the **SOC ATTACK SURFACE HUD**
  writes the target's guards, difficulty, window and lock guards in the link
  panel, the **HOP VISUALIZER** draws the route, and the **CLOUD GRAPH**
  opens a window with the company's segments you know of and a FORGE button
  on each. None of them is needed to use a bypass.
- **Logs.** Every link writes a *session open* log with your address on the
  target and on each bounce hop, and your actions add more on the target.
  A machine keeps its logs until you scrub or wipe them. Logs you leave
  behind become heat when you disconnect (2 each on the target, 1.1 each on
  a hop), so delete or modify them before you leave.
- **Heat.** Evidence left behind becomes heat. Heat cools down over game
  time, including while the clock runs faster.
- **Raids.** If heat reaches 100, you are raided. Security parts can save
  you: a security part's own failsafe triggers first; otherwise the shield,
  and last the chassis purge. Without protection, the raid ends the run.
  The Pelican has no room for a security part but a surge protector absorbs
  15% of a raid. The GHOST-VPS cannot be raided at all.
- **The sensor bands.** With the MULTI-SPECTRUM PERIMETER SENSORS fitted, the
  heat meter reads **CLEAR** (below 70), **RECON** (70 and up: unmarked
  vehicles near the hideout) and, at 100, **BREACH**: a 15-second countdown
  in real time (the clock is forced to 1x) before the raid lands. Without
  the sensors there is no warning and the raid lands at once.
- **Ways out.**
  - The **RF JAMMER** adds 45 seconds to the countdown, but for the next 6
    game hours every link leaves twice the heat.
  - The **THERMITE CORE MELT** burns the rig when the raid lands: the warrant
    is void and you start again on a Pelican with one compute part, with your
    credits, tools and stock kept and the drives empty.
  - The **MOBILE C2 VAN** can drive to a new grid from a RECON investigation
    (heat 70 or more, no link open): the heat drops to 0, the rig is on the
    road for 2 hours, and it can do this once a day (`gw relocate` or the
    RELOCATE button).

---

## Your machine: the gateway

Your gateway is a **chassis** filled with **parts**. The chassis comes with a
drive and an uplink of its own, and sets how many of each part fit:

| Chassis | Price | CPU sockets | Onboard drive | Onboard uplink | Defense slots | Rack | Trait |
|---|---|---|---|---|---|---|---|
| PELICAN FIELD RIG | free | 1 | 2 TB (+1 card) | 1 Gbps (+1) | 0 |  | high physical risk |
| GHOST-VPS BASTION | 6,500 | 2 | 4 TB (+1 card) | 2.5 Gbps (+1) | 0 |  | offshore hosting |
| STEALTH MICRO-SERVER | 14,000 | 2 | 8 TB (+2 cards) | 5 Gbps (+1) | 1 |  | hidden in a utility enclosure |
| SUB-ZERO RACK | 32,000 | 4 | 32 TB (+4 cards) | 10 Gbps (+1) | 2 | yes | soundproofed safehouse |
| DATASTORE RACK | 48,000 | 3 | 128 TB (+4 cards) | 10 Gbps (+1) | 2 | yes | cold storage |
| CRYO-COOLED CLUSTER | 75,000 | 12 | 16 TB (+2 cards) | 10 Gbps (+1) | 1 |  | power spikes |
| MOBILE C2 VAN | 120,000 | 8 | 64 TB (+4 cards) | 25 Gbps (+2) | 3 |  | base on wheels |

The parts:

- **Compute:** each socket gives thread slots, which is how many tasks can
  run at once. All compute parts in a machine must be the same model.
  SERVER XEON GEN 1 // 32 CORES (1,200 cr); SERVER EPYC GEN 2 // 64 CORES (3,500 cr); SERVER EPYC GEN 3 // 128 CORES (7,000 cr).
- **Accelerator:** one PCIe card, which speeds up password cracking, file
  decrypting and voice synthesis (not a recorded call, which runs in real
  time). The best card fitted counts.
  TENSOR HASH ACCELERATOR // 1 UNIT (4,500 cr, 1.5x); // 2 UNITS (9,000 cr, 2.5x); // 3 UNITS (15,000 cr, 3.5x); // 4 UNITS (24,000 cr, 5x).
- **FPGA:** custom silicon that decrypts and shakes hands 3x faster, and a
  decryption on it takes no thread slot. Every chassis from the Micro-Server up
  takes one.
  FPGA WIRE-SPEED CRYPTO ENGINE (35,000 cr).
- **HSM:** a card that emulates smartcards and hardware tokens, needed for the
  token locks of the big banks and defence servers. Every chassis takes one.
  HARDWARE SECURITY MODULE TAP (11,000 cr).
- **Storage:** how much you can download. Cards add to the onboard drive; the
  ZFS enclosures need a rack chassis.
  ENCRYPTED NVME STRIP 4 TB (1,500 cr); ENCRYPTED NVME STRIP 8 TB (3,200 cr); ENCRYPTED NVME STRIP 16 TB (6,000 cr); ZFS FLASH ENCLOSURE 32 TB (9,500 cr); ZFS FLASH ENCLOSURE 64 TB (16,000 cr); ZFS FLASH ENCLOSURE 128 TB (28,000 cr).
- **Modem:** download speed (added to the onboard uplink), and how many hops
  your route can take cleanly. It also sets how easily the line is traced:
  the fixed fibre lines are followed 15% faster, the SFP+ trunk 10% slower,
  and the LEO dish 20% slower, but a dish is found from orbit after 120
  seconds of activity (the trace starts and runs three times faster).
  FTTP MODEM 1 GBPS (800 cr); FTTP MODEM 2.5 GBPS (2,200 cr); SFP+ OPTICAL TRUNK 10 GBPS (7,500 cr); LEO PHASED-ARRAY 25 GBPS (18,000 cr).
- **Security:** sensors and failsafes against traces and raids. They work
  together: the earliest warning, the best shield and any failsafe count. A
  chassis with no defense slot cannot fit them.
  MULTI-SPECTRUM PERIMETER SENSORS (3,000 cr); AUTOMATED THERMITE CORE MELT (8,500 cr); BROADBAND RF JAMMER & SNIFFER (12,000 cr).

**Thread slots.** Every running task takes one thread slot; cracking,
decrypting and voice work take two. Up to the slots, tasks run at full speed.
Past them every task slows to slots over demand, and no task starts once the
demand would pass twice the slots. If the demand stays above one and a half
times the slots for 20 seconds, the weakest bypass (one in place or one still
running) drops and the digital trace starts. The session window shows the load.

Parts you take out go to your **stock**. Selling a part from stock pays 30%
to 55% of its price.

A run saved before this hardware (save version 1) is converted when it
loads: every part and the old chassis are paid back at the old prices, and
the gateway goes back to the starter rig.

---

## Software

The tools, each with several versions to buy:

CLOUD GPU HASH CRACKER, CLOUD PIVOT TUNNEL, WAF / DNS TUNNEL, EDR BLINDER,
VOLUMETRIC DDOS CANNON, SOC TRACE INTERCEPTOR, S3 EXFILTRATOR, FILE SHREDDER,
RANSOM DECRYPTOR, AUDIT LOG FABRICATOR, SIEM STOMPER, SOCIAL OSINT CRAWLER,
CREDENTIAL STUFFING ENGINE, NEURAL VOICE CLONER, SPOOF KIT, SESSION TOKEN HIJACKER,
ZERO-TRUST MAPPER, IAM PROBE, KERBEROS FORGER, KERNEL PRIVESC and the HUD programs
(SOC ATTACK SURFACE HUD, HOP VISUALIZER, CLOUD GRAPH).

The shop only sells a tool once the game has a task that uses it.

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
| **CRACKER** | V1 HASHBUSTER | beats locks up to v1 |
|  | V2 KRAKEN | beats locks up to v2 |
|  | V3 SKELETON KEY | beats locks up to v3 |
| **AITM** | V1 REVERSE PROXY | beats app MFA |
|  | V2 TOKEN REPLAY | beats app MFA and session-bound MFA |
| **PIVOT** | V1 GHOSTLINE | scrubs proxies up to PX 1 |
|  | V2 COLDSPOT | scrubs proxies up to PX 2 |
|  | V3 VAPORTRAIL | scrubs proxies up to PX 3 |
|  | V4 MIRAGE | scrubs proxies up to PX 4 |
|  | V5 PHANTOM | scrubs proxies up to PX 5 |
| **WAF** | V1 CROWBAR | gets past firewalls up to FW 1 |
|  | V2 RAM | gets past firewalls up to FW 2 |
|  | V3 BREACH | gets past firewalls up to FW 3 |
|  | V4 SIEGEBREAK | gets past firewalls up to FW 4 |
|  | V5 ROOTKIT | gets past firewalls up to FW 5 |
| **EDR** | V1 BLINDFOLD | blinds monitors up to strength 1 |
|  | V2 DEAF EYE | blinds monitors up to strength 2 |
|  | V3 SILENCE | blinds monitors up to strength 3 |
|  | V4 DEAD AIR | blinds monitors up to strength 4 |
|  | V5 BLACKOUT | blinds monitors up to strength 5 |
| **DDOS** | V1 SYN FLOOD | drops firewalls up to FW 1 and proxies up to PX 1 at once, loudly |
|  | V2 UDP STORM | drops firewalls up to FW 2 and proxies up to PX 2 at once, loudly |
|  | V3 AMPLIFIER | drops firewalls up to FW 3 and proxies up to PX 3 at once, loudly |
|  | V4 BOTNET | drops firewalls up to FW 4 and proxies up to PX 4 at once, loudly |
|  | V5 TERABIT | drops firewalls up to FW 5 and proxies up to PX 5 at once, loudly |
| **SOC** | V1 PING | warns of a trace 5% earlier |
|  | V2 RADAR | warns of a trace 10% earlier |
|  | V3 SONAR | warns of a trace 15% earlier |
|  | V4 LIDAR | warns of a trace 20% earlier |
| **EXFIL** | V1 STRAW | does the whole job |
| **SHRED** | V1 ERASER | does the whole job |
| **RANSOM** | V1 PIN | opens files encrypted up to v1 |
|  | V2 LOCKPICK | opens files encrypted up to v2 |
|  | V3 CIPHER | opens files encrypted up to v3 |
|  | V4 KEYSMITH | opens files encrypted up to v4 |
|  | V5 MASTER KEY | opens files encrypted up to v5 |
|  | V6 SKELETON | opens files encrypted up to v6 |
|  | V7 ZERO KEY | opens files encrypted up to v7 |
| **FABRICATE** | V1 BLUR | does the whole job |
| **STOMPER** | V1 TEAR | does the whole job |
| **CRAWLER** | V1 CRAWL | PROFILE finds email and role |
|  | V2 SPIDER | PROFILE finds the phone too |
|  | V3 DREDGE | PROFILE finds the social handle too |
|  | V4 SIPHON | PROFILE finds leaked passwords too |
| **STUFFER** | V1 RETRY | opens an inbox with its owner's leaked password |
| **CLONER** | V1 SAMPLE | records voices and matches voice locks up to v1 |
| **SPOOF** | V1 MASK | spoofed calls, phishing and spam; taps need v2 |
|  | V2 MIMIC | spoofed calls, phishing, spam and phone taps |
| **MAPPER** | V1 SEGMENT SCAN | maps hosts of a company up to difficulty 6 |
|  | V2 FLOW MAP | maps hosts of a company up to difficulty 10 |
|  | V3 FULL TOPOLOGY | maps hosts of a company up to difficulty 15 |
| **IAM** | V1 KEY HARVEST | opens a locked password service with a stolen key |
|  | V2 TOKEN GRAB | also opens app MFA services |
|  | V3 ROLE CHAIN | also opens session-bound MFA services |
| **KERB** | V1 SILVER TICKET | forges tickets to hosts of a company up to difficulty 6 |
|  | V2 GOLDEN TICKET | forges tickets to hosts of a company up to difficulty 10 |
|  | V3 DIAMOND TICKET | forges tickets to hosts of a company up to difficulty 15 |
| **PRIVESC** | V1 SUID | roots the host: opens every password lock, and always raises the alert |
|  | V2 DIRTY PIPE | also opens app MFA services, and always raises the alert |
|  | V3 KERNEL ROOT | also opens session-bound MFA services, and always raises the alert |
| **SURFACE** | V1 HUD | shows the target's whole attack surface in the link panel |
| **HOPS** | V1 HUD | draws the route of the link hop by hop |
| **GRAPH** | V1 HUD | opens the CLOUD GRAPH of the company's segments |

A saved run that owns a version that no longer exists is cut back to the tool's
last version when it loads, and the price of the levels above it is paid back.
A tool that is no longer in the shop (IP PROBE, HUD CONNECTION ANALYSIS and LAN
SCANNER, which no task ever used) is dropped from the run.

## Cheat menu

Click the **BLACKGATE logo** (the blue triangle at the top left) to open
**CHEATS**. Using it does **not** mark your run as cheated. It offers:

- set your money;
- raise or lower heat (it stops at 99, because a raid starts at 100);
- pause, and set the clock speed (1×, 2×, 4×, 8× or 16×);
- set your rating, from 0 to 150;
- **REVEAL THE MAP**, **EVERY TOOL AT V5** and **MAX THE GATEWAY**;
- **OPEN MISSION BUILDER:** build a job to order, choosing its kind, target,
  objective, payout, deadline, client and brief. The kinds use the market's
  names, with a line explaining the picked one:

  | Kind | The job |
  |---|---|
  | **DATA HEIST** | Copy a file off the host and bring it home |
  | **SCRUBBERS** | Erase one file from the host |
  | **BURN BOOK** | Wipe the host: every file and every log |
  | **PAPERWORK** | Rewrite one detail in a person's record |
  | **MONEY MOVES** | Move funds out of an account on a bank host |
  | **MIND THEFT** | Steal a trained AI model off a lab host |

The cheat menu has three tabs (PLAYER, WORLD, SWITCHES) and a status line.

---

## Modding the content

Everything the world is made of is JSON in `data/`. In the Windows app, edit
your copies in `Documents\Games\Blackgate`; in the browser, edit `data/`
directly. Restart the game to see changes.

| File | Contents |
|---|---|
| `briefs.json` | Job brief texts by kind. Values in `{braces}` are filled in and highlighted. |
| `cities.json` | The cities: country code, name, and `x`/`y` as fractions of the world map. |
| `clients.json` | The clients who post jobs. |
| `companies.json` | Company name prefixes and name endings by kind of company. |
| `countries.json` | Country outlines for the map (built by `tools/countries.mjs`). |
| `files.json` | File names found on machines. |
| `hardware.json` | Chassis and parts: slots, tiers, figures and prices. |
| `missions.json` | Story missions. |
| `news.json` | News stories. |
| `people.json` | First names (with sex), surnames and job roles. |
| `rivals.json` | Rival operators. |
| `software.json` | The tools, their versions and prices. |
| `unlocks.json` | The rating needed for each level. |
| `hints/*.json` | One file per in-game hint. |
| `sessionActions/*.json` | One file per action in the Bl@ckG@te action panel. |
| `images/people/index.json` | The list of portrait images (rebuilt by `populate.bat`). |

**City positions** use plain longitude and latitude:
`x = (lon + 180) / 360` and `y = (90 - lat) / 180`.

**Portraits:** put images in `data/images/people/male` or
`data/images/people/female`, then run `data/images/people/populate.bat` (or
`node tools/portraits.mjs`) to rebuild `index.json`. Each person gets a
portrait from the folder matching their sex, chosen from the world seed, so
it stays the same between sessions. `ph-male.jpg` and `ph-female.jpg` are
shown until a portrait has loaded.

Changing `cities.json`, `people.json` or `companies.json` changes the world
that new runs build from a seed.

---

## Building from source

Requirements: **Node.js** (a recent LTS release), and **Windows** to build
the `.exe`.

```bash
npm install
```

| Command | What it does |
|---|---|
| `npm start` | Runs the game in Electron from the source folder. |
| `npm run dist` | Builds the app zip, `latest.json` and the launcher in `dist/`. |
| `npm run release` | Does the same, then uploads them to the GitHub release `v<version>`. |
| `npm test` | Runs the test suite. |

How a build works (`electron/release.js`):

1. `electron-builder --win dir` builds the unpacked app in
   `dist/win-unpacked`, with the English language pack only.
2. A new build id is written to `resources/build.json`.
3. `dist/win-unpacked` is zipped to `dist/blackgate-app.zip`, and
   `dist/latest.json` records the version, build id, SHA-256 and size.
4. `electron/launcher.nsi` is compiled with NSIS into `dist/blackgate.exe`.
   It carries only `electron/launcher.ps1`, the updater described in
   [Windows app](#windows-app-blackgateexe).
5. `npm run release` uploads `blackgate.exe`, `blackgate-app.zip` and
   `latest.json` with the GitHub CLI (`gh`, logged in). A new version makes
   a new release; running it again at the same version replaces that
   release's files, which ships a new build to every launcher.

To release: raise `version` in `package.json`, commit and push, then run
`npm run release`.

**How the Electron shell works** (`electron/main.js`):

- The game folder is served over a private `app://blackgate/` address, so
  `fetch()` and ES modules work as they do on a web server. Only files inside
  the game folder can be served.
- Requests for `data/*.json` are answered from your copy in
  `Documents\Games\Blackgate` first, then from the built-in copy.
- Saves go through a small bridge (`electron/preload.js`) that gives the game
  the same calls as browser local storage but writes files. A save is written
  to a temporary file and then renamed, so a crash mid-save cannot destroy
  the previous save. Save names are plain names, never paths.
- The page runs with context isolation on and Node.js access off.
- The file helpers (`electron/files.js`) have no Electron code, so they are
  tested with the rest of the suite.

---

## Tests

```bash
node --test tests/*.mjs
```

The suite uses Node's built-in test runner and covers the simulation, the
economy, contracts, records, saves, the windows and the map. Windows are
drawn onto a stand-in canvas (`tests/stubCanvas.mjs`) that records where text
was drawn, so the interface is tested without a browser.

World generation is deterministic: the same seed always builds the same
world, and the tests check this.

---

## Project layout

```
index.html          the page the game runs in
run.bat             serves the game in a browser on port 8001
package.json        Electron scripts and build settings
src/
  main.js           start-up: the canvas, the content, the screens, the loop
  core/             engine services with no game knowledge: the loop, the
                    clock, seeded random numbers (PCG32), text and the skin
  data/             loading the content files and generating the world
  state/            the game state and the rules that change it: contracts,
                    economy, gateway, records, routes, saves, windows
  systems/          the simulation and input, one system per file: the clock,
                    heat, the live connection and its tasks, events, hotkeys
  render/           the desktop: boot, login, the shell, the Start menu and
                    window frames
  ui/               the shared form toolkit: buttons, fields, tables,
                    scrolling, panels and portraits
  windows/          one file per application
data/               the content JSON files and portrait images
electron/           the Windows app: main process, preload bridge, file
                    helpers, and the launcher with its build script
build/              the app icon
tests/              the test suite
tools/              content tools (see below)
```

---

## Tools

| Tool | Use |
|---|---|
| `node tools/countries.mjs <ne_50m_admin_0_countries.geojson>` | Rebuilds `data/countries.json` from Natural Earth's countries file. Positions use the same grid as `cities.json`; Antarctica is left out. |
| `node tools/portraits.mjs` (or `data/images/people/populate.bat`) | Rebuilds the portrait list from the image folders. |
| `node tools/socialmedia.mjs` (or `data/images/socialmedia/populate.bat`) | Rebuilds the SleekPages lists: `images.json` (the photos in each topic folder) and `text.json` (the captions in `text.txt`). |
| `npm run release` | Builds `blackgate.exe` (the launcher), `blackgate-app.zip` and `latest.json`, and uploads them to a GitHub release. |

---

## Credits and licences

- **Map data:** country outlines from [Natural Earth](https://www.naturalearthdata.com/)
  (1:50m Admin 0 countries), which is in the public domain.
- **Electron** and **electron-builder** build the Windows app. Their licences
  ship inside the build (`LICENSE.electron.txt`, `LICENSES.chromium.html`).
