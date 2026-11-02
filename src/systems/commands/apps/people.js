import { forget, dossiers, intelText, INTEL_FIELDS } from '../../../state/intel.js';
import { pad, fail, link, task, personArg } from '../helpers.js';

export const peopleApp = {
  alias: ['ppl', 'dossiers'],
  window: 'dossiers',
  about: 'OSINT: dossiers on people, and attacks on their phones and inboxes',
  commands: {
    list: {
      args: '', help: 'everyone on file, with what you know',
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
      args: '', help: "the staff of the linked host's company",
      run(ctx) {
        const { h } = link(ctx);
        const ids = ctx.game.world.people.map((p, i) => i).filter((i) => ctx.game.world.people[i].company === h.company && h.company != null);
        ctx.term.last = { kind: 'person', ids };
        return ids.map((i, n) => ({ text: `#${n + 1}  ${pad(ctx.game.world.people[i].name, 22)}clearance ${ctx.game.world.people[i].clearance}  ${intelText(ctx.game, i, 'role')}` }));
      },
    },
    show: {
      args: '<person>', help: 'the dossier of one person',
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
      args: '<person> --yes', help: 'take someone off file: everything you found about them goes',
      run(ctx, [w, yes]) {
        const i = personArg(ctx, w);
        if (yes !== '--yes') fail(`this forgets everything about them: \`ppl forget ${w} --yes\``);
        if (!forget(ctx.game, i)) fail(`${ctx.game.world.people[i].name} is not on file`);
        return [{ text: `${ctx.game.world.people[i].name} removed from the dossiers`, tone: 'ok' }];
      },
    },
    profile: { args: '<person>', help: 'OSINT a person: email, role, phone, social, leaked password', run: (ctx, [w]) => { const i = personArg(ctx, w); return task(ctx, 'Profile', i, `profile ${ctx.game.world.people[i].name}`); } },
    call: { args: '<person>', help: 'call and record their voice (leaves a call log)', run: (ctx, [w]) => { const i = personArg(ctx, w); return task(ctx, 'CallRecord', i, `call ${ctx.game.world.people[i].name}`); } },
    spoofcall: { args: '<person>', help: 'record their voice posing as their IT desk (no log)', run: (ctx, [w]) => { const i = personArg(ctx, w); return task(ctx, 'SpoofCall', i, `spoofcall ${ctx.game.world.people[i].name}`); } },
    tap: { args: '<person>', help: 'tap their phone (SPOOF KIT v2): a password they say opens a lock', run: (ctx, [w]) => { const i = personArg(ctx, w); return task(ctx, 'TapPhone', i, `tap ${ctx.game.world.people[i].name}`); } },
    inbox: { args: '<person>', help: 'hack their inbox: company hosts, colleagues, saved passwords', run: (ctx, [w]) => { const i = personArg(ctx, w); return task(ctx, 'HackInbox', i, `inbox ${ctx.game.world.people[i].name}`); } },
    phish: { args: '<person>', help: 'send a fake reset mail; the answer comes in 3 hours', run: (ctx, [w]) => { const i = personArg(ctx, w); return task(ctx, 'Phish', i, `phish ${ctx.game.world.people[i].name}`); } },
    spam: { args: '<person>', help: 'bury their inbox for a day; slows the trace if they run the host', run: (ctx, [w]) => { const i = personArg(ctx, w); return task(ctx, 'Spam', i, `spam ${ctx.game.world.people[i].name}`); } },
  },
};
