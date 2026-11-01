// The Electron shell's file work that needs no Electron, so it can be tested
// under node: the build id, the first-run copy and the save file names.
const fs = require('fs');
const path = require('path');

/// A build's id: its version plus when it was built, so a rebuild at the same
/// version still reinstalls and still checks the data files.
function buildId(version, when = new Date()) {
  return `${version}+${when.toISOString().replace(/[-:.]/g, '')}`;
}

/// The id of the running build (resources/build.json), or the bare version
/// where there is none (npm start).
function readBuild(dir, version) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'build.json'), 'utf8')).build || version;
  } catch {
    return version;
  }
}

/// Copies every data JSON the user folder lacks. Never overwrites.
function seed(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) seed(s, d);
    else if (e.name.endsWith('.json') && !fs.existsSync(d)) fs.writeFileSync(d, fs.readFileSync(s));
  }
}

/// A save key as a file in saves/. Keys are plain names, never paths.
function saveFile(dir, key) {
  if (!/^\w[\w.-]*$/.test(key)) throw new Error(`bad save key: ${key}`);
  return path.join(dir, 'saves', `${key}.json`);
}

module.exports = { buildId, readBuild, seed, saveFile };
