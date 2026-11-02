import { padsOf, newPad, openPad, deletePad, MAX_PADS } from '../../../state/notes.js';
import { handleEvents } from '../../events.js';
import { pad, fail, onOff } from '../helpers.js';

export const notepadApp = {
  alias: ['note'],
  window: 'notepad',
  about: 'your notes',
  commands: {
    show: { args: '', help: 'print the notes', run: (ctx) => (ctx.game.notes ? ctx.game.notes.split('\n').map((text, i) => ({ text: `${pad(i + 1, 4)}${text}` })) : [{ text: 'the notepad is empty' }]) },
    list: { args: '', help: 'every notepad', run: (ctx) => padsOf(ctx.game).map((n, i) => ({ text: `${i === ctx.game.notepad ? '>' : ' '} ${i + 1}  ${n.name}` })) },
    new: {
      args: '[name]', help: 'start a new notepad',
      run(ctx, rest) {
        if (!newPad(ctx.game, rest.join(' '))) fail(`at most ${MAX_PADS} notepads`);
        return [{ text: `opened ${ctx.game.notepads[ctx.game.notepad].name}`, tone: 'ok' }];
      },
    },
    open: {
      args: '<n>', help: 'switch notepad',
      run(ctx, [n]) {
        if (!openPad(ctx.game, Number(n) - 1)) fail('no such notepad: `notepad list`');
        return [{ text: `opened ${ctx.game.notepads[ctx.game.notepad].name}`, tone: 'ok' }];
      },
    },
    rename: {
      args: '<name>', help: 'rename the open notepad',
      run(ctx, rest) {
        if (!rest.length) fail('usage: notepad rename <name>');
        padsOf(ctx.game)[ctx.game.notepad].name = rest.join(' ').toUpperCase().slice(0, 16);
        return [{ text: 'renamed', tone: 'ok' }];
      },
    },
    delete: {
      args: '<n> --yes', help: 'delete a notepad',
      run(ctx, [n, yes]) {
        if (yes !== '--yes') fail('this deletes the notepad: `notepad delete <n> --yes`');
        if (!deletePad(ctx.game, Number(n) - 1)) fail('no such notepad: `notepad list`');
        return [{ text: 'notepad deleted', tone: 'ok' }];
      },
    },
    write: {
      args: '"<text>"', help: 'add a line to the notes',
      run(ctx, rest) {
        const text = rest.join(' ');
        if (!text) fail('usage: notepad write "<text>"');
        ctx.game.notes = (ctx.game.notes ? `${ctx.game.notes}\n` : '') + text;
        return [{ text: 'line added', tone: 'ok' }];
      },
    },
    wrap: {
      args: 'on|off', help: 'word wrap',
      run(ctx, [w]) {
        const v = onOff(w, 'notepad wrap');
        if ((ctx.game.settings.noteWrap !== false) !== v) handleEvents(ctx.state, [{ type: 'click', id: 'note.wrap' }], ctx.desk);
        return [{ text: `wrap ${w}`, tone: 'ok' }];
      },
    },
    clear: {
      args: '--yes', help: 'wipe every line',
      run(ctx, [yes]) {
        if (yes !== '--yes') fail('this wipes every line: `notepad clear --yes`');
        ctx.game.notes = '';
        return [{ text: 'notepad cleared', tone: 'ok' }];
      },
    },
  },
};
