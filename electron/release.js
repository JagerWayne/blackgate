// Builds a release: the unpacked app as one asset per file (named by SHA-256), latest.json (version,
// build id, the file list) and the small launcher (dist/Blackgate_Installer.exe). No zip is made.
//   node electron/release.js             build, then upload to GitHub release v<version>
//   node electron/release.js --no-upload build only (npm run dist)
//   node electron/release.js --fresh-exe upload the newly built BLACKGATE.exe (about 200 MB) instead of reusing the last one
// Every file of the app is also a release asset named by its SHA-256, and latest.json lists them (path, hash, size, release tag),
// so the launcher downloads only the files that changed. A file whose hash an earlier release already holds is not uploaded again.
// When the release already exists its files are replaced, which ships a new
// build of the same version.
const { execFileSync, execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { buildId } = require('./files.js');
const { getMakeNsisPath } = require('app-builder-lib/out/toolsets/windows');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const { version } = require(path.join(root, 'package.json'));
const src = path.join(dist, 'win-unpacked');
const latest = path.join(dist, 'latest.json');
const launcher = path.join(dist, 'Blackgate_Installer.exe');
const icon = path.join(dist, '.icon-ico', 'icon.ico');
const walk = (dir, base = '') => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name), `${base}${e.name}/`) : [`${base}${e.name}`]));
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
// the app's files are assets of this one release, so the release page of each version shows only the installer and latest.json
const FILES_TAG = 'app-files';
const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });

async function main() {
  // the game is the v2 build: make it fresh, then package it
  run('npm run ui:build');
  run('npx electron-builder --win dir');

  // a new id for every build: the launcher installs whenever it changes, and
  // the app reads it (resources/build.json) to check the user's data files
  const build = buildId(version);
  fs.writeFileSync(path.join(src, 'resources', 'build.json'), JSON.stringify({ build }));

  const tag = `v${version}`;
  const upload = !process.argv.includes('--no-upload');

  // what the last release already holds, so unchanged files are neither uploaded nor listed under the new tag
  const known = new Map(); // hash -> tag
  let prev = null;
  if (upload) {
    try {
      const tmp = fs.mkdtempSync(path.join(dist, 'prev-'));
      execFileSync('gh', ['release', 'download', '--pattern', 'latest.json', '--dir', tmp], { stdio: 'ignore' });
      prev = JSON.parse(fs.readFileSync(path.join(tmp, 'latest.json'), 'utf8'));
      fs.rmSync(tmp, { recursive: true, force: true });
      (prev.files ?? []).forEach((f) => known.set(f.h, f.t));
    } catch { /* no earlier release: everything is new */ }
  }
  // BLACKGATE.exe is rewritten on every build only to record the asar hash, and the asar integrity fuse is off, so while Electron
  // is the same version the installed exe keeps working and is not downloaded again (it is 200 MB)
  const electron = require(path.join(root, 'node_modules', 'electron', 'package.json')).version;
  // --fresh-exe ships the exe as built now (a new icon or Electron resource lives in it)
  const prevExe = prev?.electron === electron && !process.argv.includes('--fresh-exe') ? prev.files?.find((f) => f.p === 'BLACKGATE.exe') : null;
  const files = walk(src).map((p) => {
    if (p === 'BLACKGATE.exe' && prevExe) return prevExe;
    const full = path.join(src, p);
    const h = sha(full);
    return { p, h, s: fs.statSync(full).size, t: known.get(h) ?? FILES_TAG };
  });
  const fresh = files.filter((f) => !known.has(f.h));

  fs.writeFileSync(latest, JSON.stringify({ version, build, electron, files }, null, 2));

  const nsis = await getMakeNsisPath();
  execFileSync(nsis.path, [`-DICON=${icon}`, `-DOUT=${launcher}`, '-V2', path.join(__dirname, 'launcher.nsi')],
    { stdio: 'inherit', env: { ...process.env, ...nsis.env } });
  console.log(`built ${build}: ${path.relative(root, launcher)}, ${fresh.length} of ${files.length} app files are new, latest.json`);

  if (!upload) return;
  // each new file is copied under its hash, which is its asset name
  const blobs = path.join(dist, 'blobs');
  fs.rmSync(blobs, { recursive: true, force: true });
  fs.mkdirSync(blobs);
  const blobFiles = [...new Set(fresh.map((f) => f.h))].map((h) => {
    const f = fresh.find((x) => x.h === h);
    fs.copyFileSync(path.join(src, f.p), path.join(blobs, h));
    return path.join(blobs, h);
  });
  const toSend = [launcher, latest];
  const has = (t) => { try { execFileSync('gh', ['release', 'view', t], { stdio: 'ignore' }); return true; } catch { return false; } };
  if (!has(FILES_TAG)) {
    execFileSync('gh', ['release', 'create', FILES_TAG, '--prerelease', '--title', 'App files (used by the installer)', '--notes',
      'The files of the game, named by SHA-256. Blackgate_Installer.exe downloads the ones that changed; there is nothing to download here by hand.'], { stdio: 'inherit' });
  }
  if (blobFiles.length) execFileSync('gh', ['release', 'upload', FILES_TAG, ...blobFiles, '--clobber'], { stdio: 'inherit' });
  let exists = true;
  try {
    execFileSync('gh', ['release', 'view', tag], { stdio: 'ignore' });
  } catch {
    exists = false;
  }
  if (exists) {
    execFileSync('gh', ['release', 'upload', tag, ...toSend, '--clobber'], { stdio: 'inherit' });
    execFileSync('gh', ['release', 'edit', tag, '--notes', notes(build)], { stdio: 'inherit' });
  } else {
    execFileSync('gh', ['release', 'create', tag, ...toSend, '--title', `BLACKGATE ${version}`, '--notes', notes(build), '--latest'],
      { stdio: 'inherit' });
  }
  fs.rmSync(blobs, { recursive: true, force: true });
  console.log(`uploaded to release ${tag}`);
}

function notes(build) {
  return [
    'Download **Blackgate_Installer.exe** and run it. It installs the game to `Documents\\Games\\Blackgate`,',
    'adds a BLACKGATE shortcut to the desktop, and updates the game from here whenever a new build is released.',
    '',
    `Build \`${build}\``,
    'The app is a set of files named by their SHA-256; the installer downloads only the ones that changed.',
  ].join('\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
