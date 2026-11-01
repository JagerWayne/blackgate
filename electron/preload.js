// Gives the game a file-backed save store (same calls as localStorage) and
// the list of data files that fell back to the packaged copy.
const { contextBridge, ipcRenderer } = require('electron');

// Operator saves ('blackgate.save.NAME') are saves/NAME.json; the old single
// save ('blackgate.save') stays saves/blackgate.save.json until the game moves it.
const PREFIX = 'blackgate.save.';
const fileOf = (key) => (key.startsWith(PREFIX) ? key.slice(PREFIX.length) : key);
const keyOf = (name) => (name === 'blackgate.save' ? name : PREFIX + name);

const store = {
  getItem: (key) => ipcRenderer.sendSync('save:get', fileOf(key)),
  setItem: (key, value) => {
    if (!ipcRenderer.sendSync('save:set', fileOf(key), String(value))) throw new Error('save failed');
  },
  removeItem: (key) => ipcRenderer.sendSync('save:remove', fileOf(key)),
  keys: () => ipcRenderer.sendSync('save:list').map(keyOf),
};

// First Electron run: move saves from the old localStorage into files.
try {
  for (const key of Object.keys(localStorage)) {
    if (store.getItem(key) == null) store.setItem(key, localStorage.getItem(key));
    localStorage.removeItem(key);
  }
} catch {}

contextBridge.exposeInMainWorld('blackgate', {
  store,
  dataFallbacks: () => ipcRenderer.sendSync('data:fallbacks'),
});
