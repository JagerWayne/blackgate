import { padsOf, newPad, openPad, deletePad } from '../../../state/notes.js';
import { handleEvents } from '../../events.js';
import { pad, fail, onOff } from '../helpers.js';
import { maxPads } from '../../../data/settings.js';
import { t as tl } from '../../../data/language.js';

export const notepadApp = {
  alias: ['note'],
  window: 'notepad',
  about: tl('systems.commands.apps.notepad.your_notes'),
  commands: {
    show: { args: '', help: tl('systems.commands.apps.notepad.print_the_notes'), run: (ctx) => (ctx.game.notes ? ctx.game.notes.split('\n').map((text, i) => ({ text: `${pad(i + 1, 4)}${text}` })) : [{ text: 'the notepad is empty' }]) },
    list: { args: '', help: tl('systems.commands.apps.notepad.every_notepad'), run: (ctx) => padsOf(ctx.game).map((n, i) => ({ text: `${i === ctx.game.notepad ? '>' : ' '} ${i + 1}  ${n.name}` })) },
    new: {
      args: '[name]', help: tl('systems.commands.apps.notepad.start_a_new_notepad'),
      run(ctx, rest) {
        if (!newPad(ctx.game, rest.join(' '))) fail(tl('systems.commands.apps.notepad.at_most_notepads', maxPads()));
        return [{ text: `opened ${ctx.game.notepads[ctx.game.notepad].name}`, tone: 'ok' }];
      },
    },
    open: {
      args: '<n>', help: tl('systems.commands.apps.notepad.switch_notepad'),
      run(ctx, [n]) {
        if (!openPad(ctx.game, Number(n) - 1)) fail(tl('systems.commands.apps.notepad.no_such_notepad_notepad'));
        return [{ text: `opened ${ctx.game.notepads[ctx.game.notepad].name}`, tone: 'ok' }];
      },
    },
    rename: {
      args: '<name>', help: tl('systems.commands.apps.notepad.rename_the_open_notepad'),
      run(ctx, rest) {
        if (!rest.length) fail(tl('systems.commands.apps.notepad.usage_notepad_rename_name'));
        padsOf(ctx.game)[ctx.game.notepad].name = rest.join(' ').toUpperCase().slice(0, 16);
        return [{ text: 'renamed', tone: 'ok' }];
      },
    },
    delete: {
      args: '<n> --yes', help: tl('systems.commands.apps.notepad.delete_a_notepad'),
      run(ctx, [n, yes]) {
        if (yes !== '--yes') fail(tl('systems.commands.apps.notepad.this_deletes_the_notepad'));
        if (!deletePad(ctx.game, Number(n) - 1)) fail(tl('systems.commands.apps.notepad.no_such_notepad_notepad'));
        return [{ text: 'notepad deleted', tone: 'ok' }];
      },
    },
    write: {
      args: '"<text>"', help: tl('systems.commands.apps.notepad.add_a_line_to'),
      run(ctx, rest) {
        const text = rest.join(' ');
        if (!text) fail(tl('systems.commands.apps.notepad.usage_notepad_write_text'));
        ctx.game.notes = (ctx.game.notes ? `${ctx.game.notes}\n` : '') + text;
        return [{ text: 'line added', tone: 'ok' }];
      },
    },
    wrap: {
      args: 'on|off', help: tl('systems.commands.apps.notepad.word_wrap'),
      run(ctx, [w]) {
        const v = onOff(w, 'notepad wrap');
        if ((ctx.game.settings.noteWrap !== false) !== v) handleEvents(ctx.state, [{ type: 'click', id: 'note.wrap' }], ctx.desk);
        return [{ text: `wrap ${w}`, tone: 'ok' }];
      },
    },
    clear: {
      args: '--yes', help: tl('systems.commands.apps.notepad.wipe_every_line'),
      run(ctx, [yes]) {
        if (yes !== '--yes') fail(tl('systems.commands.apps.notepad.this_wipes_every_line'));
        ctx.game.notes = '';
        return [{ text: 'notepad cleared', tone: 'ok' }];
      },
    },
  },
};
