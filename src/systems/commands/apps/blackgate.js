import { routeLines } from '../../../state/session.js';
import { authOf } from '../../../data/auth.js';
import { recordsKept, RECORD_LABEL, WORK_FIELDS, parseRecord, validRecord, recordText } from '../../../state/records.js';
import { pad, clock, fail, rowOf, press, hostArg, link, remoteFile, task, voiceLock, personArg, fieldArg, simple } from '../helpers.js';

export const blackgateApp = {
  alias: ['bg'],
  window: 'blackgate',
  about: 'the hacking client: the live link and its tasks',
  commands: {
    connect: simple('<host>', 'open a link through your route', (ctx, [w]) => { const h = hostArg(ctx, w); return { id: `map.go.${h.id}`, done: `link open to ${h.name}` }; }),
    disconnect: { args: '', help: 'close the link', run: (ctx) => { link(ctx, false); return press(ctx, 'sess.disconnect', 'disconnected'); } },
    status: {
      args: '', help: 'heat, the trace and the running tasks',
      run(ctx) {
        const { game } = ctx;
        const out = [{ text: `HEAT ${Math.round(game.player.heat)} / 100`, tone: 'head' }];
        const s = game.session;
        if (!s) return [...out, { text: 'not connected' }];
        const h = game.world.hosts[s.target];
        if (s.phase !== 'online') return [...out, { text: `LINK ${h.name} // negotiating ${Math.round((s.connectT / s.connectDur) * 100)}%` }, ...routeLines(game, s).map((l) => ({ text: `  ${l.text}`, tone: l.done ? 'ok' : undefined }))];
        out.push({ text: `LINK ${h.name} (${h.ip}) // trace ${Math.round(s.trace * 100)}%`, tone: s.trace > 0.7 ? 'err' : 'head' });
        if (!s.tasks.length) out.push({ text: 'no tasks running' });
        s.tasks.forEach((t) => out.push({ text: `  ${pad(t.label, 32)}${Math.round(Math.min(t.progress, 1) * 100)}%` }));
        return out;
      },
    },
    services: {
      args: '', help: "the host's services",
      run(ctx) {
        const { h } = link(ctx);
        return h.services.map((s, i) => ({ s, i })).filter(({ s }) => s.visible !== false)
          .map(({ s, i }) => ({ text: `${pad(`#${i + 1}`, 5)}${pad(`${s.name}:${s.port}`, 18)}${s.open ? 'open' : `locked (lock v${s.password})`}` }));
      },
    },
    files: {
      args: '', help: "the host's files",
      run(ctx) {
        const { h } = link(ctx);
        const list = h.files.map((f, i) => ({ f, i })).filter(({ f }) => !f.deleted);
        ctx.term.last = { kind: 'rfile', host: h.id, ids: list.map(({ i }) => i) };
        if (!list.length) return [{ text: 'no files' }];
        return list.map(({ f }, n) => ({ text: `${pad(`#${n + 1}`, 5)}${pad(f.name, 28)}${pad(`${f.size} GB`, 9)}${f.enc > 0 ? `encrypted v${f.enc}` : ''}` }));
      },
    },
    logs: {
      args: '[wipe|scrub]', help: 'show the logs; `wipe` deletes them all, `scrub` quietly removes only yours',
      run(ctx, [verb]) {
        const { h } = link(ctx);
        if (verb === 'wipe') return task(ctx, 'WipeLogs', undefined, 'wipe logs');
        if (verb === 'scrub') return task(ctx, 'ModifyLogs', undefined, 'scrub own logs');
        if (verb) fail('usage: bg logs [wipe|scrub]');
        if (!h.logs.length) return [{ text: 'no logs' }];
        return h.logs.map((l) => ({ text: typeof l === 'string' ? l : `${l.minute !== undefined ? `${pad(clock(l.minute), 14)}` : ''}${l.text ?? l.action ?? ''}` }));
      },
    },
    records: {
      args: '[text]', help: 'the people on the host, with search',
      run(ctx, rest) {
        const { game } = ctx;
        const { h } = link(ctx);
        const fields = recordsKept(game, h);
        if (!fields.length) return [{ text: `${h.name} keeps no personal records` }];
        const staffOnly = fields.some((f) => WORK_FIELDS.includes(f)) && !fields.some((f) => !WORK_FIELDS.includes(f));
        const q = rest.join(' ').toLowerCase();
        const people = game.world.people.map((p, i) => ({ p, i }))
          .filter(({ p }) => !staffOnly || (h.company != null && p.company === h.company))
          .filter(({ p }) => !q || p.name.toLowerCase().includes(q));
        ctx.term.last = { kind: 'person', ids: people.map(({ i }) => i) };
        if (!people.length) return [{ text: 'no one matches' }];
        const rows = people.slice(0, 60).map(({ p }, n) => ({ text: `${pad(`#${n + 1}`, 5)}${pad(p.name, 24)}${fields.map((f) => `${RECORD_LABEL[f]} ${recordText(game, f, p[f])}`).join(' // ')}` }));
        if (people.length > 60) rows.push({ text: `... ${people.length - 60} more // narrow it with a search`, tone: 'info' });
        return rows;
      },
    },
    crack: {
      args: '[service #]', help: 'break a password (the first locked service by default)',
      run(ctx, [w]) {
        const { h } = link(ctx);
        const i = w ? rowOf(w) : h.services.findIndex((s) => !s.open && s.kind !== 'voice');
        if (i < 0 || !h.services[i]) fail(w ? `no service ${w} // see \`bg services\`` : 'every password lock is already open');
        return task(ctx, 'CrackPassword', i, `crack ${h.services[i].name}`);
      },
    },
    netmap: { args: '', help: "map the company's hidden segments (zero-trust mapper)", run: (ctx) => task(ctx, 'MapNetwork', undefined, 'map the network') },
    forge: {
      args: '<host>', help: 'forge a ticket and move the link to another host of the same company',
      run(ctx, [w]) {
        const to = hostArg(ctx, w);
        return task(ctx, 'ForgeTicket', to.id, `forge a ticket to ${to.name}`);
      },
    },
    probe: { args: '', help: 'use a service-account key to open a locked service quietly (IAM probe)', run: (ctx) => task(ctx, 'ProbeIam', undefined, 'harvest service-account keys') },
    root: { args: '', help: 'escalate to root: opens every lock it reaches, always raises the alert', run: (ctx) => task(ctx, 'EscalateKernel', undefined, 'escalate to root') },
    hijack: {
      args: '[service #]', help: 'capture a live session behind MFA (the first MFA service by default); the token lasts 40 s',
      run(ctx, [w]) {
        const { h } = link(ctx);
        const i = w ? rowOf(w) : h.services.findIndex((s) => !s.open && (authOf(s) === 'mfa' || authOf(s) === 'session'));
        if (i < 0 || !h.services[i]) fail(w ? `no service ${w} // see \`bg services\`` : 'no MFA service is locked here');
        return task(ctx, 'HijackSession', i, `hijack ${h.services[i].name}`);
      },
    },
    record: {
      args: '[service #]', help: "call a voice lock's admin and record their voice",
      run(ctx, [w]) {
        const i = voiceLock(ctx, w);
        return task(ctx, 'RecordVoice', i, `call to the admin of ${link(ctx).h.services[i].name}`);
      },
    },
    voiceprint: {
      args: '[service #]', help: "play the admin's recording to open a voice lock",
      run(ctx, [w]) {
        const i = voiceLock(ctx, w);
        return task(ctx, 'PlayVoiceprint', i, `voiceprint ${link(ctx).h.services[i].name}`);
      },
    },
    bypass: {
      args: 'firewall|monitor|proxy|ddos', help: 'bypass a defence (ddos drops the firewall and the proxy together, loudly)',
      run(ctx, [what]) {
        const kind = { firewall: 'BypassFirewall', monitor: 'BypassMonitor', proxy: 'BypassProxy', ddos: 'Ddos' }[what];
        if (!kind) fail('usage: bg bypass firewall|monitor|proxy|ddos');
        return task(ctx, kind, undefined, `bypass ${what}`);
      },
    },
    copy: { args: '<file>', help: 'copy a file to your storage', run: (ctx, [w]) => task(ctx, 'CopyFile', remoteFile(ctx, w), `copy ${w}`) },
    delete: { args: '<file>', help: 'delete a file on the host', run: (ctx, [w]) => task(ctx, 'DeleteFile', remoteFile(ctx, w), `delete ${w}`) },
    decrypt: { args: '<file>', help: 'decrypt a file on the host', run: (ctx, [w]) => task(ctx, 'DecryptFile', remoteFile(ctx, w), `decrypt ${w}`) },
    osint: { args: '', help: 'run an OSINT sweep', run: (ctx) => task(ctx, 'OsintSweep', undefined, 'OSINT sweep') },
    alter: {
      args: '<person> <field> <value>', help: 'change a record, e.g. bg alter "Ana Diaz" status deceased',
      run(ctx, [who, f, ...rest]) {
        if (!who || !f || !rest.length) fail('usage: bg alter <person> <field> <value>');
        link(ctx);
        const person = personArg(ctx, who);
        const field = fieldArg(f);
        const value = parseRecord(ctx.game, field, rest.join(' '));
        if (!validRecord(ctx.game, field, value)) fail(`not a valid ${RECORD_LABEL[field].toLowerCase()}`);
        return task(ctx, 'AlterRecord', { person, field, value }, `alter ${RECORD_LABEL[field].toLowerCase()} of ${ctx.game.world.people[person].name}`);
      },
    },
  },
};
