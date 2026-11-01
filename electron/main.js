// Electron shell for BLACKGATE. Serves the game folder over app://blackgate/
// so fetch() and ES modules work. Content JSON is copied on first run to
// Documents/Games/Blackgate and read from there; saves live in its saves/.

const { app, BrowserWindow, Menu, protocol, net, ipcMain } = require('electron');
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

/// After a new build (not only a new version), warns (console and blackgate.log) about each data
/// file the user keeps that differs from the one this version ships: it stays
/// as it is, so new content in it does not reach the game.
function checkDataVersion() {
  const stampFile = path.join(USER, 'data-version.json');
  let old = null;
  try {
    old = JSON.parse(fs.readFileSync(stampFile, 'utf8')).version;
  } catch {}
  // the build id, so a rebuild at the same version is checked too
  const now = readBuild(process.resourcesPath, app.getVersion());
  if (old === now) return;
  const stale = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const s = path.join(dir, e.name);
      if (e.isDirectory()) walk(s);
      else if (e.name.endsWith('.json')) {
        const rel = path.relative(DATA, s);
        const mine = path.join(USER, rel);
        if (fs.existsSync(mine) && !fs.readFileSync(mine).equals(fs.readFileSync(s))) stale.push(rel);
      }
    }
  })(DATA);
  if (old && stale.length) {
    const lines = stale.map((rel) => `${new Date().toISOString()} warning: ${rel} differs from version ${now}'s copy (kept, from ${old})`);
    lines.forEach((l) => console.warn(l));
    fs.appendFileSync(path.join(USER, 'blackgate.log'), lines.join('\n') + '\n');
  }
  fs.writeFileSync(stampFile, JSON.stringify({ version: now }));
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
ipcMain.on('data:fallbacks', (e) => {
  e.returnValue = [...fallbacks];
});

app.whenReady().then(() => {
  USER = path.join(app.getPath('documents'), 'Games', 'Blackgate');
  fs.mkdirSync(USER, { recursive: true });
  checkDataVersion();
  seed(DATA, USER);
  fs.mkdirSync(path.join(USER, 'saves'), { recursive: true });
  protocol.handle('app', serve);
  Menu.setApplicationMenu(null);
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    fullscreenable: true,
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
});

app.on('window-all-closed', () => app.quit());
