// Compiles electron/launcher.nsi into dist/blackgate.exe around the unpacked
// app that `electron-builder --win dir` left in dist/win-unpacked.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { buildId } = require('./files.js');
const { getMakeNsisPath } = require('app-builder-lib/out/toolsets/windows');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const { version } = require(path.join(root, 'package.json'));
const src = path.join(dist, 'win-unpacked');
const icon = path.join(dist, '.icon-ico', 'icon.ico');

for (const p of [path.join(src, 'BLACKGATE.exe'), icon]) {
  if (!fs.existsSync(p)) throw new Error(`missing ${p}: run electron-builder --win dir first`);
}

// a new id for every build: the launcher reinstalls whenever it changes, and
// the app reads it (resources/build.json) to check the user's data files
const build = buildId(version);
fs.writeFileSync(path.join(src, 'resources', 'build.json'), JSON.stringify({ build }));

getMakeNsisPath().then((nsis) => {
  execFileSync(
    nsis.path,
    [`-DVERSION=${version}`, `-DBUILD=${build}`, `-DSRC=${src}`, `-DICON=${icon}`, `-DOUT=${path.join(dist, 'blackgate.exe')}`, '-V2',
      path.join(__dirname, 'launcher.nsi')],
    { stdio: 'inherit', env: { ...process.env, ...nsis.env } },
  );
  console.log(`built dist/blackgate.exe (build ${build})`);
});
