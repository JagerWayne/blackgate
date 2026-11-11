import { forget, dossiers, intelText, INTEL_FIELDS } from '../../../state/intel.js';
import { pad, fail, link, task, personArg } from '../helpers.js';
import { t as tl } from '../../../data/language.js';

export const peopleApp = {
  alias: ['ppl', 'dossiers'],
  window: 'dossiers',
  about: tl('systems.commands.apps.people.osint_dossiers_on_people'),
  commands: {
    list: {
      args: '', help: tl('systems.commands.apps.people.everyone_on_file_with'),
      run(ctx) {
        const ids = dossiers(ctx.game);
        if (!ids.length) return [{ text: 'nobody on file // `bg osint` on a link adds leads' }];
        ctx.term.last = { kind: 'person', ids };
        return ids.map((i, n) => {
          const p = ctx.game.world.people[i];
          return { text: `#${n + 1}  ${pad(p.name, 22)}${pad(intelText(ctx.game, i, 'email'), 34)}${intelText(ctx.game, i, 'phone')}` };
        });
      },
    },
    staff: {
      args: '', help: tl('systems.commands.apps.people.the_staff_of_the'),
      run(ctx) {
        const { h } = link(ctx);
        const ids = ctx.game.world.people.map((p, i) => i).filter((i) => ctx.game.world.people[i].company === h.company && h.company != null);
        ctx.term.last = { kind: 'person', ids };
        return ids.map((i, n) => ({ text: `#${n + 1}  ${pad(ctx.game.world.people[i].name, 22)}clearance ${ctx.game.world.people[i].clearance}  ${intelText(ctx.game, i, 'role')}` }));
      },
    },
    show: {
      args: '<person>', help: tl('systems.commands.apps.people.the_dossier_of_one'),
      run(ctx, [w]) {
        const i = personArg(ctx, w);
        const p = ctx.game.world.people[i];
        const it = ctx.game.intel?.[i] ?? {};
        return [
          { text: `${p.name} // ${ctx.game.world.companies[p.company]?.name ?? ''} // clearance ${p.clearance}`, tone: 'head' },
          ...INTEL_FIELDS.map((f) => ({ text: `  ${pad(f.label, 12)}${intelText(ctx.game, i, f.field)}` })),
          { text: `  ${[it.tapped && 'TAPPED', it.inbox && 'INBOX HACKED', it.phishAt !== undefined && 'PHISH SENT'].filter(Boolean).join(' // ') || 'nothing done yet'}` },
        ];
      },
    },
    forget: {
      args: '<person> --yes', help: tl('systems.commands.apps.people.take_someone_off_file'),
      run(ctx, [w, yes]) {
        const i = personArg(ctx, w);
        if (yes !== '--yes') fail(tl('systems.commands.apps.people.this_forgets_everything_about', w));
        if (!forget(ctx.game, i)) fail(tl('systems.commands.apps.people.is_not_on_file', ctx.game.world.people[i].name));
        return [{ text: `${ctx.game.world.people[i].name} removed from the dossiers`, tone: 'ok' }];
      },
    },
    profile: { args: '<person>', help: tl('systems.commands.apps.people.osint_a_person_email'), run: (ctx, [w]) => { const i = personArg(ctx, w); return task(ctx, 'Profile', i, `profile ${ctx.game.world.people[i].name}`); } },
    call: { args: '<person>', help: tl('systems.commands.apps.people.call_and_record_their'), run: (ctx, [w]) => { const i = personArg(ctx, w); return task(ctx, 'CallRecord', i, `call ${ctx.game.world.people[i].name}`); } },
    spoofcall: { args: '<person>', help: tl('systems.commands.apps.people.record_their_voice_posing'), run: (ctx, [w]) => { const i = personArg(ctx, w); return task(ctx, 'SpoofCall', i, `spoofcall ${ctx.game.world.people[i].name}`); } },
    tap: { args: '<person>', help: tl('systems.commands.apps.people.tap_their_phone_fake'), run: (ctx, [w]) => { const i = personArg(ctx, w); return task(ctx, 'TapPhone', i, `tap ${ctx.game.world.people[i].name}`); } },
    inbox: { args: '<person>', help: tl('systems.commands.apps.people.hack_their_inbox_company'), run: (ctx, [w]) => { const i = personArg(ctx, w); return task(ctx, 'HackInbox', i, `inbox ${ctx.game.world.people[i].name}`); } },
    phish: { args: '<person>', help: tl('systems.commands.apps.people.send_a_fake_reset'), run: (ctx, [w]) => { const i = personArg(ctx, w); return task(ctx, 'Phish', i, `phish ${ctx.game.world.people[i].name}`); } },
    spam: { args: '<person>', help: tl('systems.commands.apps.people.bury_their_inbox_for'), run: (ctx, [w]) => { const i = personArg(ctx, w); return task(ctx, 'Spam', i, `spam ${ctx.game.world.people[i].name}`); } },
  },
};
