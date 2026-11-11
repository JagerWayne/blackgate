import { storageUsed, downloadsUsed } from '../../../state/gameHelpers.js';
import { storage, sharedDrive, systemCap, downloadCap } from '../../../state/gateway.js';
import { appsUsed } from '../../../state/apps.js';
import { pad, fail, rowOf, press } from '../helpers.js';
import { t as tl } from '../../../data/language.js';

export const storageApp = {
  alias: ['files'],
  window: 'files',
  about: tl('systems.commands.apps.storage.the_files_you_have'),
  commands: {
    list: {
      args: '', help: tl('systems.commands.apps.storage.your_files'),
      run(ctx) {
        const files = ctx.game.player.storage;
        if (!files.length) return [{ text: 'storage is empty' }];
        return files.map((f, i) => ({ text: `${pad(`#${i + 1}`, 5)}${pad(f.name, 28)}${pad(`${f.size} GB`, 9)}${f.enc > 0 ? 'encrypted' : ''}` }));
      },
    },
    space: {
      args: '', help: tl('systems.commands.apps.storage.used_and_free_space'),
      run(ctx) {
        const g = ctx.game.player.gateway;
        const used = storageUsed(ctx.game);
        const cap = storage(g);
        if (sharedDrive(g)) return [{ text: `${used} GB used of ${cap} GB // ${Math.max(cap - used, 0)} GB free // ${appsUsed(ctx.game)} GB of it is software // one drive (C:), shared` }];
        return [
          { text: `C: system drive: ${appsUsed(ctx.game)} of ${systemCap(g)} GB used by software` },
          { text: `D: storage drives: ${downloadsUsed(ctx.game)} of ${downloadCap(g)} GB used by files` },
        ];
      },
    },
    delete: {
      args: '<file|#>', help: tl('systems.commands.apps.storage.delete_a_downloaded_file'),
      run(ctx, [w]) {
        const files = ctx.game.player.storage;
        const n = rowOf(w) >= 0 ? rowOf(w) : files.findIndex((f) => f.name.toLowerCase() === (w ?? '').toLowerCase());
        if (!files[n]) fail(tl('systems.commands.apps.storage.name_a_file_or'));
        const { name } = files[n];
        return press(ctx, `files.del.${n}`, `${name} deleted`);
      },
    },
  },
};
