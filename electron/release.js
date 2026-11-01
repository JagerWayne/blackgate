// Builds a release: the unpacked app, zipped, with latest.json (version,
// build id, SHA-256, size) and the small launcher (dist/blackgate.exe).
//   node electron/release.js             build, then upload to GitHub release v<version>
//   node electron/release.js --no-upload build only (npm run dist)
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
const zip = path.join(dist, 'blackgate-app.zip');
const latest = path.join(dist, 'latest.json');
const launcher = path.join(dist, 'blackgate.exe');
const icon = path.join(dist, '.icon-ico', 'icon.ico');
const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });

async function main() {
  run('npx electron-builder --win dir');

  // a new id for every build: the launcher installs whenever it changes, and
  // the app reads it (resources/build.json) to check the user's data files
  const build = buildId(version);
  fs.writeFileSync(path.join(src, 'resources', 'build.json'), JSON.stringify({ build }));

  fs.rmSync(zip, { force: true });
  execFileSync('powershell.exe', ['-NoProfile', '-Command',
    `Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::CreateFromDirectory('${src}', '${zip}', 'Optimal', $false)`],
  { stdio: 'inherit' });
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(zip)).digest('hex');
  const size = fs.statSync(zip).size;
  fs.writeFileSync(latest, JSON.stringify({ version, build, zip: path.basename(zip), sha256, size }, null, 2));

  const nsis = await getMakeNsisPath();
  execFileSync(nsis.path, [`-DICON=${icon}`, `-DOUT=${launcher}`, '-V2', path.join(__dirname, 'launcher.nsi')],
    { stdio: 'inherit', env: { ...process.env, ...nsis.env } });
  console.log(`built ${build}: ${path.relative(root, launcher)}, ${path.basename(zip)} (${(size / 1e6).toFixed(1)} MB), latest.json`);

  if (process.argv.includes('--no-upload')) return;
  const tag = `v${version}`;
  const files = [launcher, zip, latest];
  let exists = true;
  try {
    execFileSync('gh', ['release', 'view', tag], { stdio: 'ignore' });
  } catch {
    exists = false;
  }
  if (exists) {
    execFileSync('gh', ['release', 'upload', tag, ...files, '--clobber'], { stdio: 'inherit' });
    execFileSync('gh', ['release', 'edit', tag, '--notes', notes(build, sha256)], { stdio: 'inherit' });
  } else {
    execFileSync('gh', ['release', 'create', tag, ...files, '--title', `BLACKGATE ${version}`, '--notes', notes(build, sha256), '--latest'],
      { stdio: 'inherit' });
  }
  console.log(`uploaded to release ${tag}`);
}

function notes(build, sha256) {
  return [
    'Download **blackgate.exe** and run it. It installs the game to `Documents\\Games\\Blackgate`,',
    'adds a BLACKGATE shortcut to the desktop, and updates the game from here whenever a new build is released.',
    '',
    `Build \`${build}\``,
    `\`blackgate-app.zip\` SHA-256: \`${sha256}\``,
  ].join('\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
