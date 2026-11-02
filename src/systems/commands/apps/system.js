import { handleEvents } from '../../events.js';
import { clock, fail, press, onOff } from '../helpers.js';

export const systemApp = {
  alias: ['sys'],
  window: 'settings',
  about: 'settings, saving and logging out',
  commands: {
    autosave: { args: 'on|off', help: 'autosave every 45 seconds', run: (ctx, [w]) => { handleEvents(ctx.state, [{ type: 'toggle', id: 'set.auto', value: onOff(w, 'sys autosave') }], ctx.desk); return [{ text: `autosave ${w}`, tone: 'ok' }]; } },
    fast: { args: 'on|off', help: 'run the world clock 8x', run: (ctx, [w]) => { handleEvents(ctx.state, [{ type: 'toggle', id: 'set.fast', value: onOff(w, 'sys fast') }], ctx.desk); return [{ text: `fast-forward ${w}`, tone: 'ok' }]; } },
    theme: {
      args: 'light|dark', help: 'the skin',
      run(ctx, [w]) {
        if (w !== 'light' && w !== 'dark') fail('usage: sys theme light|dark');
        return press(ctx, `set.theme.${w}`, `${w} skin`);
      },
    },
    save: { args: '', help: 'save now', run: (ctx) => press(ctx, 'set.save', 'run saved') },
    quit: { args: '', help: 'save and log out', run: (ctx) => press(ctx, 'set.quit', 'saved // logging out') },
  },
};
