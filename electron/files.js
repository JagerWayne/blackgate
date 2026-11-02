// The Electron shell's file work that needs no Electron, so it can be tested
// under node: the build id, the first-run copy and the save file names.
const crypto = require('crypto');
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

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

/// Copies every data JSON the user folder lacks, and replaces one the player
/// never touched: its hash is still the one recorded when it was copied
/// (`known`, rel path -> hash). An edited file is kept and listed in `stale`.
/// Returns the hashes to record for the next run, and the stale paths.
function seed(src, dst, known = {}, base = '') {
  fs.mkdirSync(dst, { recursive: true });
  const hashes = {};
  const stale = [];
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) {
      const sub = seed(s, d, known, rel);
      Object.assign(hashes, sub.hashes);
      stale.push(...sub.stale);
    } else if (e.name.endsWith('.json')) {
      const mine = fs.readFileSync(s);
      const theirs = fs.existsSync(d) ? fs.readFileSync(d) : null;
      if (theirs && sha(theirs) !== sha(mine) && known[rel] !== sha(theirs)) {
        stale.push(rel);
        continue;
      }
      if (!theirs || sha(theirs) !== sha(mine)) fs.writeFileSync(d, mine);
      hashes[rel] = sha(mine);
    }
  }
  return { hashes, stale };
}

/// A save key as a file in saves/. Keys are plain names, never paths.
function saveFile(dir, key) {
  if (!/^\w[\w.-]*$/.test(key)) throw new Error(`bad save key: ${key}`);
  return path.join(dir, 'saves', `${key}.json`);
}

module.exports = { buildId, readBuild, seed, saveFile };
