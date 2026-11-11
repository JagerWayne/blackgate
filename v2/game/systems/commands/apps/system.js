import { handleEvents } from '../../events.js';
import { clock, fail, press, onOff } from '../helpers.js';
import { t as tl } from '../../../data/language.js';

export const systemApp = {
  alias: ['sys'],
  window: 'settings',
  about: tl('systems.commands.apps.system.settings_saving_and_logging'),
  commands: {
    autosave: { args: 'on|off', help: tl('systems.commands.apps.system.autosave_every_45_seconds'), run: (ctx, [w]) => { handleEvents(ctx.state, [{ type: 'toggle', id: 'set.auto', value: onOff(w, 'sys autosave') }], ctx.desk); return [{ text: `autosave ${w}`, tone: 'ok' }]; } },
    fast: { args: 'on|off', help: tl('systems.commands.apps.system.run_the_world_clock'), run: (ctx, [w]) => { handleEvents(ctx.state, [{ type: 'toggle', id: 'set.fast', value: onOff(w, 'sys fast') }], ctx.desk); return [{ text: `fast-forward ${w}`, tone: 'ok' }]; } },
    save: { args: '', help: tl('systems.commands.apps.system.save_now'), run: (ctx) => press(ctx, 'set.save', 'run saved') },
    quit: { args: '', help: tl('systems.commands.apps.system.save_and_log_out'), run: (ctx) => press(ctx, 'set.quit', 'saved // logging out') },
  },
};
