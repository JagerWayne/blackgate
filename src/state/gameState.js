// The game state: one place to reach the run's factory, its seeding and the
// small helpers the systems share.

export { SAVE_VERSION, makeGame } from './newGame.js';
export { seedWorld, randomHeadline } from './seed.js';
export {
  newId, pushMail, note, toast, pay, refund, charge, host, discover,
  toggleBounce, toggleFavorite, routeFactor, companyName, toolLevel, hasTool,
  storageUsed,
} from './gameHelpers.js';
export {
  RECORD_LABEL, WORK_FIELDS, recordsKept, keepsRecord, validRecord, recordText, pickChange, parseRecord,
} from './records.js';
