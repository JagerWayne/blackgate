import { draw as drawText } from '../../core/text.js';
import { section, buttons, custom } from '../../ui/controls.js';
import { flat } from '../../ui/styles.js';

export const HOME = 'hub';

export const MY_JOBS = 'jobs';

export const MAX_JOBS = 4;

const linkStyle = () => ({ ...flat(), dark: { ...flat().dark, text: 'accent' }, light: { ...flat().light, text: 'accent' } });

export const link = (url, text) => ({ id: `dsn.go.${url}`, text, style: linkStyle() });

export const links = (items) => buttons(items.map(([url, text]) => link(url, text)));

export const money = (n) => `${n.toLocaleString('en-US')} cr`;

/// Lines of text art in a colour, on a dark strip: a site's banner.
export function banner(lines, accent) {
  return custom(lines.length * 15 + 14, (ctx, sk, r) => {
    ctx.fillStyle = '#05070d';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = typeof accent === 'number' ? `#${accent.toString(16).padStart(6, '0')}` : accent;
    ctx.fillRect(r.x, r.y + r.h - 2, r.w, 2);
    lines.forEach((l, i) => drawText(ctx, l, r.x + 10, r.y + 6 + i * 15, 12, accent));
  });
}

/// A heading with a count, in the page's colour.
export const heading = (text) => section(text);
