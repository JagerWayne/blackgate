import { componentsOf } from '../../../data/content.js';
import { pad, fail, rowOf, press } from '../helpers.js';

export const storageApp = {
  alias: ['files'],
  window: 'files',
  about: 'the files you have downloaded',
  commands: {
    list: {
      args: '', help: 'your files',
      run(ctx) {
        const files = ctx.game.player.storage;
        if (!files.length) return [{ text: 'storage is empty' }];
        return files.map((f, i) => ({ text: `${pad(`#${i + 1}`, 5)}${pad(f.name, 28)}${pad(`${f.size} GB`, 9)}${f.enc > 0 ? 'encrypted' : ''}` }));
      },
    },
    space: {
      args: '', help: 'used and free space',
      run(ctx) {
        const used = ctx.game.player.storage.reduce((n, f) => n + (f.size ?? 0), 0);
        const cap = ctx.game.player.gateway.parts.filter((p) => p.kind === 'storage')
          .reduce((n, p) => n + (componentsOf('storage').find((d) => d.tier === p.level)?.capacity ?? 0), 0);
        return [{ text: `${used} GB used of ${cap} GB // ${Math.max(cap - used, 0)} GB free` }];
      },
    },
    delete: {
      args: '<file|#>', help: 'delete a downloaded file',
      run(ctx, [w]) {
        const files = ctx.game.player.storage;
        const n = rowOf(w) >= 0 ? rowOf(w) : files.findIndex((f) => f.name.toLowerCase() === (w ?? '').toLowerCase());
        if (!files[n]) fail('name a file, or #n from `storage list`');
        const { name } = files[n];
        return press(ctx, `files.del.${n}`, `${name} deleted`);
      },
    },
  },
};
