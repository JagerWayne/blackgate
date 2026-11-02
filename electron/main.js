// Electron shell for BLACKGATE. Serves the game folder over app://blackgate/
// so fetch() and ES modules work. Content JSON is copied on first run to
// Documents/Games/Blackgate and read from there; saves live in its saves/.

const { app, BrowserWindow, Menu, dialog, protocol, net, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { readBuild, seed, saveFile: saveIn } = require('./files.js');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');
let USER; // Documents/Games/Blackgate, set once the app is ready
const fallbacks = new Set(); // data files that fell back to the packaged copy

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

/// Brings the user's data files up to this build: missing ones are copied, ones
/// the player never edited are replaced, edited ones are kept. After a new
/// build (not only a new version) each kept file that differs from the shipped
/// one is warned about (console and blackgate.log), since new content in it
/// does not reach the game. The hashes of what was copied go in data-version.json.
function syncData() {
  const stampFile = path.join(USER, 'data-version.json');
  let old = {};
  try {
    old = JSON.parse(fs.readFileSync(stampFile, 'utf8'));
  } catch {}
  // the build id, so a rebuild at the same version is checked too
  const now = readBuild(process.resourcesPath, app.getVersion());
  const { hashes, stale } = seed(DATA, USER, old.hashes);
  if (old.version && old.version !== now && stale.length) {
    const lines = stale.map((rel) => `${new Date().toISOString()} warning: ${rel} differs from version ${now}'s copy (kept, from ${old.version})`);
    lines.forEach((l) => console.warn(l));
    fs.appendFileSync(path.join(USER, 'blackgate.log'), lines.join('\n') + '\n');
  }
  fs.writeFileSync(stampFile, JSON.stringify({ version: now, hashes }));
}

/// The user's copy of a data JSON, or null when it is missing or not valid JSON.
function userJson(rel) {
  try {
    const text = fs.readFileSync(path.join(USER, rel), 'utf8');
    JSON.parse(text);
    return text;
  } catch {
    return null;
  }
}

function serve(request) {
  const rel = decodeURIComponent(new URL(request.url).pathname);
  const file = path.normalize(path.join(ROOT, rel));
  // Only serve files inside the app folder.
  if (!file.startsWith(ROOT + path.sep)) return new Response('Forbidden', { status: 403 });
  if (file.startsWith(DATA + path.sep) && file.endsWith('.json')) {
    const sub = path.relative(DATA, file);
    const text = userJson(sub);
    if (text != null) return new Response(text, { headers: { 'content-type': 'application/json' } });
    fallbacks.add(sub.replaceAll('\\', '/'));
  }
  return net.fetch(pathToFileURL(file).toString());
}

const saveFile = (key) => saveIn(USER, key);

ipcMain.on('save:get', (e, key) => {
  try {
    e.returnValue = fs.readFileSync(saveFile(key), 'utf8');
  } catch {
    e.returnValue = null;
  }
});
ipcMain.on('save:set', (e, key, value) => {
  try {
    // write then rename, so a crash mid-write cannot destroy the old save
    const f = saveFile(key);
    fs.writeFileSync(`${f}.tmp`, value);
    fs.renameSync(`${f}.tmp`, f);
    e.returnValue = true;
  } catch {
    e.returnValue = false;
  }
});
ipcMain.on('save:remove', (e, key) => {
  try {
    fs.rmSync(saveFile(key), { force: true });
    e.returnValue = true;
  } catch {
    e.returnValue = false;
  }
});
/// An operator's visited-hosts report, hosts/<NAME>.json. Names are plain names.
function reportFile(name) {
  if (!/^[A-Z0-9_-]+$/.test(name)) throw new Error(`bad report name: ${name}`);
  return path.join(USER, 'hosts', `${name}.json`);
}
ipcMain.on('report:write', (e, name, text) => {
  try {
    fs.mkdirSync(path.join(USER, 'hosts'), { recursive: true });
    fs.writeFileSync(reportFile(name), text);
    e.returnValue = true;
  } catch {
    e.returnValue = false;
  }
});
ipcMain.on('report:remove', (e, name) => {
  try {
    fs.rmSync(reportFile(name), { force: true });
    e.returnValue = true;
  } catch {
    e.returnValue = false;
  }
});
ipcMain.on('save:list', (e) => {
  try {
    e.returnValue = fs.readdirSync(path.join(USER, 'saves')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5));
  } catch {
    e.returnValue = [];
  }
});
ipcMain.on('app:build', (e) => {
  e.returnValue = readBuild(process.resourcesPath, app.getVersion());
});

ipcMain.on('data:fallbacks', (e) => {
  e.returnValue = [...fallbacks];
});

// Two copies would write the same save files, so a second launch hands over to the first.
const primary = app.requestSingleInstanceLock();
if (!primary) app.quit();
let win;
app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

app.whenReady().then(() => {
  if (!primary) return;
  USER = path.join(app.getPath('documents'), 'Games', 'Blackgate');
  fs.mkdirSync(USER, { recursive: true });
  syncData();
  fs.mkdirSync(path.join(USER, 'saves'), { recursive: true });
  protocol.handle('app', serve);
  Menu.setApplicationMenu(null);
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    fullscreenable: true,
    fullscreen: true, // starts full screen; F11 leaves it
    backgroundColor: '#05080c',
    icon: path.join(ROOT, 'build', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  // F11 toggles fullscreen, since the menu that would offer it is hidden.
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      e.preventDefault();
    }
  });
  win.loadURL('app://blackgate/index.html');
}).catch((e) => {
  // without this a failed start (read-only or locked Documents) leaves a windowless process
  dialog.showErrorBox('BLACKGATE', `The game could not start.\n\n${e.message}`);
  app.quit();
});

app.on('window-all-closed', () => app.quit());
