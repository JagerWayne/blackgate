import { learn, forget } from '../state/intel.js';
import { fileLead } from '../windows/dsn/sleek.js';
import { newPad, openPad, deletePad } from '../state/notes.js';
// The events the operator made, applied to the game state.

import { handleDsnClick } from '../windows/dsn/browser.js';
import { askFee, takeOffer, declineDeal, counterAsk } from '../state/haggle.js';
import { setDark } from '../core/theme.js';
import {
  openWindow, closeWindow, makeWindows, minimizeWindow, toggleMax, taskWindow,
} from '../state/windows.js';
import { toast, toggleBounce, toggleFavorite, discover } from '../state/gameState.js';
import { saveRoute, loadRoute, deleteRoute, clearRoute, MAX_HOPS, moveHop } from '../state/routes.js';
import { mapHosts } from '../state/mapQuery.js';
import { acceptContract, declineContract, dropContract, submitContract, contractLabel } from '../state/contracts.js';
import { generateCustomContract } from '../state/contractSpawn.js';
import { parseRecord, validRecord, RECORD_LABEL } from '../state/gameState.js';
import { buyComponent, buyChassis, sellPart, buyTool, sellStock, fitStock } from '../state/economy.js';
import { relocate } from './physical.js';
import { fitPlan } from '../state/gateway.js';
import { connect, disconnect } from './sessionTick.js';
import { startTask } from './sessionTasks.js';
import { componentDef, chassisDef, software } from '../data/content.js';
import { saveRun, loadRun, listSlots } from '../state/save.js';
import * as cheat from '../state/cheats.js';

/// Applies the events from one frame. A run that ended in this frame takes
/// no more events.
export function handleEvents(state, events, desk) {
  for (const e of events) {
    if (!state.game) break;
    if (e.type === 'select') handleSelect(state, e);
    else if (e.type === 'toggle') handleToggle(state, e);
    else if (e.type === 'edit') handleEdit(state, e);
    else if (e.type === 'click' && e.id === 'over.again') toLogin(state);
    else if (e.type === 'click' && e.id === 'over.load') loadLast(state);
    else if (e.type === 'click') handleClick(state, e, desk);
  }
}

/// The ending's NEW CAMPAIGN: back to the welcome screen with a clean desk.
function toLogin(state) {
  state.game = null;
  state.mode = 'login';
  state.windows = makeWindows();
  state.win = {};
  state.startOpen = false;
  state.login.slots = listSlots();
  state.login.sel = state.login.slots.length ? 1 : 0;
}

/// The ending's LOAD LAST SAVE: the saved run, or the welcome screen.
function loadLast(state) {
  const saved = loadRun();
  if (!saved) return toLogin(state);
  setDark(saved.settings.darkSkin);
  state.game = saved;
  state.mode = 'play';
  return null;
}

/// A row was picked in a list.
function handleSelect(state, e) {
  const game = state.game;
  if (e.id === 'mg.list') {
    // the builder's picker: a host, a file or a person, by what is being picked
    const v = state.win.missions ?? {};
    const value = v.pickOrder?.[e.index];
    if (value === undefined) return;
    if (v.pick === 'host') Object.assign(v, { host: value, file: null, person: null, field: null, value: '' });
    else if (v.pick === 'file') v.file = value;
    else if (v.pick === 'person') Object.assign(v, { person: value, field: null, value: '' });
  } else if (e.id === 'mail.list') {
    const mails = game.mail.slice().sort((a, b) => b.minute - a.minute);
    if (mails[e.index]) state.win.mail.mailSel = mails[e.index].id;
  } else if (e.id === 'map.list') {
    const view = state.win.map ?? (state.win.map = {});
    const host = mapHosts(game, view)[e.index];
    if (host) {
      view.sel = host.id;
      view.glide = true;
    }
  } else if (e.id === 'sess.people' || e.id === 'dos.list') {
    const view = state.win[e.id === 'dos.list' ? 'dossiers' : 'blackgate'] ??= {};
    view.pplSel = view.pplOrder?.[e.index] ?? view.pplSel;
  } else if (e.id === 'sess.records') {
    const view = state.win.blackgate ?? (state.win.blackgate = {});
    view.recSel = view.recOrder?.[e.index] ?? view.recSel;
  } else if (e.id === 'sw.list') {
    const tool = software()[e.index];
    if (tool) state.win.software = { ...(state.win.software ?? {}), sel: tool.kind };
  }
}

/// Does a GATEWAY click take something away? REMOVE, MIGRATE, SELL from
/// stock and a SWAP that takes parts out all do; a FIT or an ADD does not.
export function isDestructive(game, id) {
  if (id.startsWith('gw.sell.') || id.startsWith('gw.chassis.') || id.startsWith('gw.stock.sell.')) return true;
  if (id.startsWith('gw.buy.')) {
    const [kind, tier] = id.slice(7).split('.');
    const def = componentDef(kind, Number(tier));
    return !!def && fitPlan(game.player.gateway, def).out.length > 0;
  }
  return false;
}

/// The GATEWAY's buttons. One that loses something takes two clicks: the
/// first arms it (the window says what will happen), the second does it. Any
/// other click puts the armed button down again.
function handleGatewayClick(state, id) {
  const game = state.game;
  const view = state.win.gateway ?? (state.win.gateway = {});
  if (isDestructive(game, id) && view.armed !== id) {
    view.armed = id;
    return;
  }
  view.armed = null;
  if (id.startsWith('gw.tab.')) view.tab = Number(id.slice(7));
  else if (id.startsWith('gw.buy.')) {
    const [kind, tier] = id.slice(7).split('.');
    buyComponent(game, componentDef(kind, Number(tier)));
  } else if (id.startsWith('gw.chassis.')) buyChassis(game, chassisDef(Number(id.slice(11))));
  else if (id.startsWith('gw.sell.')) sellPart(game, Number(id.slice(8)));
  else if (id.startsWith('gw.stock.sell.')) sellStock(game, Number(id.slice(14)));
  else if (id === 'gw.relocate') {
    const why = relocate(game);
    toast(game, why ?? 'the Van is on the road // the investigation lost the trail', why ? 'bad' : 'good');
  } else if (id.startsWith('gw.stock.fit.')) {
    const why = fitStock(game, Number(id.slice(13)));
    if (why) toast(game, why, 'bad');
  }
}

/// Opens a link to a host through the current route and brings up the
/// remote-control window, or says why the link cannot open.
function openLink(state, target, desk) {
  openWindow(state.windows, 'blackgate', desk);
  const err = connect(state.game, target);
  if (!err) state.win.blackgate = { tab: 0 };
  else toast(state.game, err, 'bad');
}

/// Starts a task on the live link, or says why it cannot run.
function tryTask(game, kind, arg) {
  const err = startTask(game, kind, arg);
  if (err) toast(game, err, 'bad');
}

/// The NEXUS MAP's own buttons: the filters, the route and the favourites.
function handleMapClick(state, id) {
  const game = state.game;
  const view = state.win.map ?? (state.win.map = {});
  const tail = (prefix) => id.slice(prefix.length);
  if (id.startsWith('map.k.')) {
    view.kind = tail('map.k.');
    view.kindOpen = false;
  } else if (id === 'map.kmenu') view.kindOpen = !view.kindOpen;
  else if (id.startsWith('map.tab.')) view.tab = tail('map.tab.');
  else if (id.startsWith('map.up.')) moveHop(game, Number(tail('map.up.')), -1);
  else if (id.startsWith('map.down.')) moveHop(game, Number(tail('map.down.')), 1);
  else if (id === 'map.addsel') {
    if (view.sel !== undefined && view.sel !== null && !game.player.bounce.includes(view.sel)) handleMapClick(state, `map.hop.${view.sel}`);
  } else if (id.startsWith('map.show.')) Object.assign(view, { sel: Number(tail('map.show.')), glide: true, follow: true, tab: 'HOSTS', kind: 'all', query: '' });
  else if (id.startsWith('map.hop.')) {
    const host = Number(tail('map.hop.'));
    if (!game.player.bounce.includes(host) && game.player.bounce.length >= MAX_HOPS) {
      toast(game, `a route holds ${MAX_HOPS} hops at most`, 'bad');
    } else toggleBounce(game, host);
  } else if (id.startsWith('map.fav.')) toggleFavorite(game, Number(tail('map.fav.')));
  else if (id === 'map.route.save') {
    const err = saveRoute(game);
    toast(game, err ?? `route kept as ${game.routes.at(-1).name}`, err ? 'bad' : 'good');
  } else if (id === 'map.route.clear') clearRoute(game);
  else if (id.startsWith('map.route.load.')) {
    const err = loadRoute(game, Number(tail('map.route.load.')));
    if (err) toast(game, err, 'bad');
  } else if (id.startsWith('map.route.del.')) deleteRoute(game, Number(tail('map.route.del.')));
}

/// Opens the NEXUS MAP on a contract's target: the machine is revealed, picked
/// on the map, and any filter or search that would hide it is cleared.
function trackTarget(state, contractId, desk) {
  const game = state.game;
  const c = game.contracts.find((x) => x.id === contractId);
  if (!c) return;
  discover(game, c.target);
  const view = state.win.map ?? (state.win.map = {});
  view.sel = c.target;
  view.kind = 'all';
  view.query = '';
  view.follow = true;
  view.glide = true;
  view.tab = 'HOSTS';
  openWindow(state.windows, 'map', desk);
}

/// A check box moved.
function handleToggle(state, e) {
  const g = state.game;
  if (e.id === 'set.auto') g.settings.autosave = e.value;
  else if (e.id === 'set.fx') g.settings.effects = e.value;
  else if (e.id === 'set.sound') g.settings.sound = e.value;
  else if (e.id === 'set.fast') cheat.setTimeScale(g, e.value ? 8 : 1);
  else if (e.id === 'mg.accept') (state.win.missions ??= {}).accept = e.value;
}

/// A text field changed.
function handleEdit(state, e) {
  if (e.id === 'cheat.money.field') (state.win.cheats ??= {}).money = e.value;
  if (e.id === 'dsn.search') (state.win.dsn ??= {}).query = e.value;
  if (e.id === 'sp.q') Object.assign((state.win.dsn ??= {}), { spQuery: e.value, spPage: 0 });
  if (e.id === 'dsn.askfield') (state.win.dsn ??= {}).ask = e.value;
  else if (e.id.startsWith('mg.')) (state.win.missions ??= {})[e.id.slice(3)] = e.value;
}

/// A MISSION BUILDER button. A new kind or host clears what depended on it.
function handleBuilderClick(state, id) {
  const v = (state.win.missions ??= {});
  if (id.startsWith('mg.kind.')) Object.assign(v, { kind: id.slice(8), file: null, person: null, field: null, value: '' });
  else if (id.startsWith('mg.pick.')) Object.assign(v, { pick: id.slice(8), search: '' });
  else if (id === 'mg.host.random') Object.assign(v, { host: null, file: null, person: null, field: null, value: '' });
  else if (id === 'mg.file.random') v.file = null;
  else if (id === 'mg.person.random') Object.assign(v, { person: null, field: null, value: '' });
  else if (id.startsWith('mg.field.')) Object.assign(v, { field: id.slice(9), value: '' });
  else if (id.startsWith('mg.hours.')) v.hours = Number(id.slice(9));
  else if (id === 'mg.reset') state.win.missions = {};
  else if (id === 'mg.spawn') spawnBuilt(state, v);
}

/// SPAWN MISSION: the job as the builder has it, or a line saying what is wrong.
function spawnBuilt(state, v) {
  const game = state.game;
  const say = (msg, ok = false) => Object.assign(v, { msg, ok });
  const kind = v.kind ?? 'retrieve';
  const want = {
    kind,
    target: v.host ?? null,
    hours: v.hours || undefined,
    client: (v.client ?? '').trim().toUpperCase() || undefined,
    brief: (v.brief ?? '').trim() || undefined,
    accept: !!v.accept,
  };
  const pay = (v.reward ?? '').replace(/[,\s]/g, '');
  if (pay) {
    if (!/^\d+$/.test(pay) || Number(pay) <= 0) return say('the payout must be a whole number of credits');
    want.reward = Number(pay);
  }
  if (kind === 'retrieve' || kind === 'delete') want.file = v.file ?? undefined;
  if (kind === 'modify' && v.person !== null && v.person !== undefined && v.field) {
    const value = parseRecord(game, v.field, v.value);
    if (!validRecord(game, v.field, value)) return say(`not a valid ${RECORD_LABEL[v.field].toLowerCase()}`);
    want.record = { person: v.person, field: v.field, value };
  }
  const c = generateCustomContract(game, want);
  if (!c) return say('that job cannot be posted: the host, file or change does not fit it');
  say(`posted #${c.id} ${contractLabel(c)}${c.state === 'accepted' ? ' // accepted' : ''}`, true);
  toast(game, `Mission posted // #${c.id} ${contractLabel(c)} // check MAIL`, 'good');
}

/// A button in the cheat menu.
function handleCheatClick(state, id) {
  const game = state.game;
  const tail = (prefix) => Number(id.slice(prefix.length));
  if (id === 'cheat.money.set') {
    const view = state.win.cheats ?? {};
    if (cheat.setMoney(game, view.money)) view.money = '';
    else toast(game, 'Type a whole number of credits', 'bad');
  } else if (id.startsWith('cheat.money.')) cheat.addMoney(game, tail('cheat.money.'));
  else if (id.startsWith('cheat.heat.set.')) cheat.setHeat(game, tail('cheat.heat.set.'));
  else if (id.startsWith('cheat.heat.nudge.')) cheat.nudgeHeat(game, tail('cheat.heat.nudge.'));
  else if (id === 'cheat.heat.freeze') cheat.toggleFreezeHeat(game);
  else if (id === 'cheat.pause') game.paused = !game.paused;
  else if (id.startsWith('cheat.time.')) {
    cheat.setTimeScale(game, tail('cheat.time.'));
    game.paused = false;
  } else if (id.startsWith('cheat.skip.')) cheat.skipTime(game, tail('cheat.skip.'));
  else if (id.startsWith('cheat.rating.')) cheat.nudgeRating(game, tail('cheat.rating.'));
  else if (id === 'cheat.trace.freeze') cheat.toggleFreezeTrace(game);
  else if (id === 'cheat.map') cheat.revealMap(game);
  else if (id === 'cheat.tools') cheat.maxTools(game);
  else if (id === 'cheat.gateway') cheat.maxGateway(game);
}

/// A button was pressed.
function handleClick(state, e, desk) {
  const { id } = e;
  const game = state.game;
  if (id === 'start') state.startOpen = !state.startOpen;
  else if (id.startsWith('task.')) taskWindow(state.windows, id.slice(5), desk);
  else if (id.startsWith('win.close.')) closeWindow(state.windows, id.slice(10));
  else if (id.startsWith('win.min.')) minimizeWindow(state.windows, id.slice(8));
  else if (id.startsWith('win.max.')) toggleMax(state.windows, id.slice(8));
  else if (id === 'hdr.contracts') openPortal(state, desk, 'jobs');
  else if (id === 'hdr.mail') openWindow(state.windows, 'mail', desk);
  else if (id === 'mail.readAll') game.mail.forEach((m) => { m.read = true; });
  else if (id.startsWith('dsn.') || id.startsWith('sp.')) handleDsn(state, id, desk);
  else if (id === 'hdr.cheat') openWindow(state.windows, 'cheats', desk);
  else if (id === 'cheat.missions') openWindow(state.windows, 'missions', desk);
  else if (id.startsWith('mg.')) handleBuilderClick(state, id);
  else if (id === 'hdr.speed') cheat.setTimeScale(game, cheat.nextSpeed(game));
  else if (id.startsWith('cheat.tab.')) (state.win.cheats ??= {}).tab = Number(id.slice(10));
  else if (id.startsWith('cheat.')) handleCheatClick(state, id);
  else if (id.startsWith('ct.accept.')) acceptContract(game, Number(id.slice(10)));
  else if (id.startsWith('ct.decline.')) declineContract(game, Number(id.slice(11)));
  else if (id.startsWith('ct.drop.')) dropContract(game, Number(id.slice(8)));
  else if (id.startsWith('ct.submit.')) submitContract(game, Number(id.slice(10)));
  else if (id.startsWith('ct.track.')) trackTarget(state, Number(id.slice(9)), desk);
  else if (id.startsWith('mail.accept.')) acceptContract(game, Number(id.slice(12)));
  else if (id.startsWith('mail.decline.')) declineContract(game, Number(id.slice(13)));
  else if (id.startsWith('mail.track.')) trackTarget(state, Number(id.slice(11)), desk);
  else if (id.startsWith('gw.')) handleGatewayClick(state, id);
  else if (id === 'note.new') newPad(game);
  else if (id.startsWith('note.open.')) openPad(game, Number(id.slice(10)));
  else if (id.startsWith('note.del.')) {
    const view = state.win.notepad ?? (state.win.notepad = {});
    if (view.armed === id) {
      deletePad(game, Number(id.slice(9)));
      view.armed = null;
    } else view.armed = id;
  }
  else if (id === 'note.wrap') game.settings.noteWrap = game.settings.noteWrap === false;
  else if (id === 'note.clear') {
    const view = state.win.notepad ?? (state.win.notepad = {});
    if (view.armed === id) {
      game.notes = '';
      view.armed = null;
    } else view.armed = id;
  }
  else if (id.startsWith('sw.buy.')) {
    const [kind, level] = id.slice(7).split('.');
    buyTool(game, kind, Number(level));
  } else if (id.startsWith('files.del.')) game.player.storage.splice(Number(id.slice(10)), 1);
  else if (id.startsWith('map.') && !id.startsWith('map.go.')) handleMapClick(state, id);
  else if (id.startsWith('map.go.')) openLink(state, Number(id.slice(7)), desk);
  else if (id.startsWith('ct.link.')) {
    const c = game.contracts.find((x) => x.id === Number(id.slice(8)));
    if (c) openLink(state, c.target, desk);
  } else if (id.startsWith('sess.tab.')) state.win.blackgate.tab = Number(id.slice(9));
  else if (id === 'sess.disconnect') disconnect(game);
  else if (id.startsWith('sess.task.')) tryTask(game, id.slice(10));
  else if (id.startsWith('sess.crack.')) tryTask(game, 'CrackPassword', Number(id.slice(11)));
  else if (id.startsWith('sess.hijack.')) tryTask(game, 'HijackSession', Number(id.slice(12)));
  else if (id.startsWith('net.forge.')) tryTask(game, 'ForgeTicket', Number(id.slice(10)));
  else if (id === 'net.map') tryTask(game, 'MapNetwork');
  else if (id.startsWith('dos.del.')) {
    const view = (state.win.dossiers ??= {});
    if (view.armed === id) {
      const who = Number(id.slice(8));
      if (forget(game, who)) toast(game, `${game.world.people[who].name} removed from the dossiers`, 'info');
      view.armed = null;
    } else view.armed = id;
  } else if (id.startsWith('ppl.')) {
    const [, kind, who] = id.split('.');
    tryTask(game, kind, Number(who));
  }
  else if (id.startsWith('sess.record.')) tryTask(game, 'RecordVoice', Number(id.slice(12)));
  else if (id.startsWith('sess.voice.')) tryTask(game, 'PlayVoiceprint', Number(id.slice(11)));
  else if (id.startsWith('sess.copy.')) tryTask(game, 'CopyFile', Number(id.slice(10)));
  else if (id.startsWith('sess.del.')) tryTask(game, 'DeleteFile', Number(id.slice(9)));
  else if (id.startsWith('sess.decrypt.')) tryTask(game, 'DecryptFile', Number(id.slice(13)));
  else if (id.startsWith('sess.alter.')) {
    const c = game.contracts.find((x) => x.id === Number(id.slice(11)));
    if (c?.record) tryTask(game, 'AlterRecord', c.record);
  }
  else if (id === 'set.theme.light' || id === 'set.theme.dark') {
    setDark(id === 'set.theme.dark');
    game.settings.darkSkin = id === 'set.theme.dark';
  } else if (id === 'set.save') {
    if (saveRun(game)) toast(game, 'Run saved', 'good');
    else toast(game, 'Save failed // browser storage is full or blocked', 'bad');
  } else if (id === 'set.quit') {
    // the run is written out and the desk is cleared: the welcome screen comes
    // back with the saved operator on it
    const ok = saveRun(game);
    toLogin(state);
    state.login.notice = ok ? 'run saved' : 'the save could not be written';
  }
}

/// DSNET: the job buttons and the haggling here, the browsing in the browser.
function handleDsn(state, id, desk) {
  const game = state.game;
  const view = (state.win.dsn ??= {});
  const num = (prefix) => Number(id.slice(prefix.length).split('.')[0]);
  const say = (err) => { if (err) toast(game, err, 'bad'); };
  if (id.startsWith('dsn.accept.')) say(takeOffer(game, num('dsn.accept.')));
  else if (id.startsWith('dsn.take.')) say(takeOffer(game, num('dsn.take.')));
  else if (id.startsWith('dsn.decline.')) {
    const v = (state.win.dsn ??= {});
    if (v.armed === id) {
      say(declineDeal(game, num('dsn.decline.')));
      v.armed = null;
    } else v.armed = id;
  } else if (id.startsWith('dsn.counter.')) {
    say(counterAsk(game, num('dsn.counter.'), Number(view.ask)));
    view.ask = '';
  }
  else if (id.startsWith('dsn.askexact.')) {
    say(askFee(game, num('dsn.askexact.'), Number(view.ask)));
    view.ask = '';
  } else if (id.startsWith('dsn.ask.')) {
    const [cid, pct] = id.slice(8).split('.').map(Number);
    const c = game.contracts.find((x) => x.id === cid);
    if (c) say(askFee(game, cid, c.reward * (1 + pct / 100)));
  } else if (id.startsWith('dsn.map.')) {
    openWindow(state.windows, 'map', desk);
    const map = (state.win.map ??= {});
    Object.assign(map, { sel: Number(id.slice(8)), glide: true, follow: true, tab: 'HOSTS', kind: 'all', query: '' });
  } else if (id.startsWith('dsn.drop.')) {
    // DROP asks twice: the first press arms it
    const cid = num('dsn.drop.');
    if (view.dropArm === cid) {
      dropContract(game, cid);
      view.dropArm = null;
    } else view.dropArm = cid;
  } else if (id === 'dsn.dossiers') openWindow(state.windows, 'dossiers', desk);
  else if (id.startsWith('sp.learn.')) {
    const [, , who, field] = id.split('.');
    learn(game, Number(who), field);
  } else if (id.startsWith('sp.search.page.')) view.spPage = Number(id.slice(15));
  else if (id === 'sp.search.go') view.spPage = 0;
  else if (id.startsWith('sp.dossier.')) {
    fileLead(game, Number(id.slice(11)));
    openWindow(state.windows, 'dossiers', desk);
  }
  else handleDsnClick(view, id, game.uiTime ?? 0);
}

/// Opens DSNET at an address.
export function openPortal(state, desk, url = 'hub') {
  openWindow(state.windows, 'dsn', desk);
  handleDsnClick((state.win.dsn ??= {}), `dsn.go.${url}`, state.game?.uiTime ?? 0);
}
