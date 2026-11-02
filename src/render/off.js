// The machine is off: a black screen with the words on it. A key or a click
// turns it back on.

import { draw as drawText } from '../core/text.js';

export function drawOff(ctx, w, h) {
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, w, h);
  drawText(ctx, 'POWER OFF', w / 2, h / 2 - 14, 18, '#5d7286', { align: 'center', baseline: 'middle' });
  drawText(ctx, 'Press Alt + F4 to exit or any key to reboot', w / 2, h / 2 + 18, 10, '#3f5062', {
    align: 'center',
    baseline: 'middle',
  });
}
