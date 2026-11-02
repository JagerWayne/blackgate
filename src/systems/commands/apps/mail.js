import { pad, clock, fail, press, mailbox, mailArg, simple } from '../helpers.js';

/// The message a word picks, which must offer a job that is still on offer.
function offeredBy(ctx, word) {
  const m = mailArg(ctx, word);
  if (!m.contract) fail('that message offers no job');
  if (ctx.game.contracts.find((c) => c.id === m.contract)?.state !== 'offered') fail('that job is no longer on offer');
  return m;
}

export const mailApp = {
  alias: [],
  window: 'mail',
  about: 'read and answer your messages',
  commands: {
    list: {
      args: '[new|all]', help: 'the messages, newest first (* = unread)',
      run(ctx, [which]) {
        const box = mailbox(ctx.game).filter((m) => which !== 'new' || !m.read);
        ctx.term.last = { kind: 'mail', ids: box.map((m) => m.id) };
        if (!box.length) return [{ text: which === 'new' ? 'no unread mail' : 'the mailbox is empty' }];
        return box.map((m, i) => ({ text: `${pad(`#${i + 1}`, 5)}${m.read ? ' ' : '*'} ${pad(clock(m.minute), 14)}${pad(m.from.replace(/\s*<.*>/, ''), 24)}${m.subject}` }));
      },
    },
    read: {
      args: '<#|new>', help: 'show a message and mark it read; `new` reads the oldest unread one',
      run(ctx, [word]) {
        const m = mailArg(ctx, word);
        m.read = true;
        // the whole mailbox, so `#n` keeps meaning row n of the list
        ctx.term.last = { kind: 'mail', ids: mailbox(ctx.game).map((x) => x.id) };
        return [
          { text: `FROM     ${m.from}`, tone: 'head' },
          { text: `SUBJECT  ${m.subject}`, tone: 'head' },
          { text: `SENT     ${clock(m.minute)}`, tone: 'head' },
          ...String(m.body ?? '').split('\n').map((text) => ({ text })),
          ...(m.contract ? [{ text: `job ${m.contract}: \`mail accept #${mailbox(ctx.game).indexOf(m) + 1}\`, \`mail decline #${mailbox(ctx.game).indexOf(m) + 1}\` or \`mail target #${mailbox(ctx.game).indexOf(m) + 1}\``, tone: 'info' }] : []),
        ];
      },
    },
    readall: { args: '', help: 'mark every message read', run: (ctx) => press(ctx, 'mail.readAll', 'all mail marked read') },
    accept: simple('<#>', 'accept the job a message offers', (ctx, [w]) => {
      const m = offeredBy(ctx, w);
      if (ctx.game.contracts.filter((x) => x.state === 'accepted' || x.state === 'ready').length >= 4) fail('your job slots are full // finish or drop one first');
      return { id: `mail.accept.${m.contract}`, done: `contract ${m.contract} accepted` };
    }),
    decline: simple('<#>', 'turn down the job a message offers', (ctx, [w]) => {
      const m = offeredBy(ctx, w);
      return { id: `mail.decline.${m.contract}`, done: `contract ${m.contract} declined` };
    }),
    target: simple('<#>', "show the offered job's target on the map", (ctx, [w]) => { const m = mailArg(ctx, w); if (!m.contract) fail('that message offers no job'); return { id: `mail.track.${m.contract}` }; }, 'target shown on the NEXUS MAP'),
  },
};
