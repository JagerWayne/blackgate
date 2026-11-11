// One-off: draws the in-game BLACKGATE mark (src/render/backdrop.js logo())
// into build/icon.png. Run with: npx electron electron/make-icon.js
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false });
  await win.loadURL('about:blank');
  const url = await win.webContents.executeJavaScript(`(() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#050505'; ctx.beginPath(); ctx.roundRect(0, 0, 256, 256, 40); ctx.fill();
    const w = 256, bx = 0, by = 8, cx = 128;
    const p1 = [bx + w*0.18, by + w*0.2], p2 = [bx + w*0.82, by + w*0.2], p3 = [bx + w*0.5, by + w*0.82];
    ctx.strokeStyle = 'rgba(76,157,240,0.95)'; ctx.lineWidth = w*0.06; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(...p1); ctx.lineTo(...p2); ctx.lineTo(...p3); ctx.closePath(); ctx.stroke();
    const inner = w*0.3; ctx.strokeStyle = 'rgba(76,157,240,0.7)'; ctx.lineWidth = w*0.03;
    ctx.strokeRect(cx - inner/2, by + w*0.42 - inner/2, inner, inner);
    return c.toDataURL('image/png');
  })()`);
  fs.mkdirSync(path.join(__dirname, '..', 'build'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '..', 'build', 'icon.png'), Buffer.from(url.split(',')[1], 'base64'));
  app.quit();
});
