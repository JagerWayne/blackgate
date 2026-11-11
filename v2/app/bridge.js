// The only seam between the game and the DOM.
//   bus      DOM -> game: 'window' {key, action: open|min|max|close} from window chrome clicks.
//   actions  DOM -> game: the Command Prompt. main.js fills these from the real game state.
// Game -> DOM needs no events: main.js reads the game each frame (windows.reconcile, tutorial step).

const handlers = new Map();

export const bus = {
  on(type, fn) {
    if (!handlers.has(type)) handlers.set(type, new Set());
    handlers.get(type).add(fn);
    return () => handlers.get(type).delete(fn);
  },
  emit(type, detail) {
    handlers.get(type)?.forEach((fn) => fn(detail));
  },
};

export const actions = {
  /// Runs a Command Prompt line against the game.
  run: (line) => {},
  /// Tab completion: { line, hits }.
  complete: (line) => ({ line, hits: [] }),
  /// The prompt's state: { lines: [{text, tone}], history: [string] }.
  term: () => ({ lines: [], history: [] }),
  /// The prompt's label, e.g. `local:~`.
  prompt: () => 'local:~',
};
