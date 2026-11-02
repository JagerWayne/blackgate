// The content folder: one JSON file per topic, fetched once at startup.
// The tables are plain data, so a system can read them without knowing where
// they came from.

/// topic -> file name.
export const TOPIC_FILES = {
  cities: 'cities.json',
  countries: 'countries.json',
  companies: 'companies.json',
  people: 'people.json',
  files: 'files.json',
  news: 'news.json',
  rivals: 'rivals.json',
  clients: 'clients.json',
  darknet: 'darknet.json',
  briefs: 'briefs.json',
  missions: 'missions.json',
  software: 'software.json',
  hardware: 'hardware.json',
  unlocks: 'unlocks.json',
  portraits: 'images/people/index.json',
  socialImages: 'images/socialmedia/images.json',
  socialText: 'images/socialmedia/text.json',
};

export const TOPICS = Object.keys(TOPIC_FILES);

/// The items that live one per file: group -> the item ids. Every item is a
/// file of its own, so it can be read, changed and diffed on its own.
export const ITEM_FILES = {
  sessionActions: ['bypassFirewall', 'blindMonitor', 'scrubProxy', 'wipeLogs', 'scrubOwnLogs'],
  hints: [
    'contractCapacity', 'destroyObjective', 'allLanesBusy', 'destroyWarning', 'destroyOrder',
    'workNotReady', 'noCredits', 'routeFull', 'migrating', 'swapOut', 'routesFull',
  ],
};

/// The folder the topic files live in, next to the module.
const FOLDER = new URL('../../data/', import.meta.url);

/// Loads every topic file. A file that will not load stops the boot: the
/// world would be half made otherwise.
export async function loadContent() {
  const pairs = await Promise.all(
    TOPICS.map(async (topic) => {
      const name = TOPIC_FILES[topic];
      const body = await readTopic(name);
      return [topic, body];
    }),
  );
  const items = await Promise.all(
    Object.entries(ITEM_FILES).map(async ([group, ids]) => {
      const bodies = await Promise.all(ids.map(async (id) => [id, await readTopic(`${group}/${id}.json`)]));
      return [group, Object.fromEntries(bodies)];
    }),
  );
  return { ...Object.fromEntries(pairs), ...Object.fromEntries(items) };
}

/// Reads one topic file. The browser fetches it; the checks read it from disk.
async function readTopic(name) {
  if (typeof process !== 'undefined' && process.versions?.node) {
    const { readFile } = await import('node:fs/promises');
    const { fileURLToPath } = await import('node:url');
    const text = await readFile(fileURLToPath(new URL(name, FOLDER)), 'utf8');
    return JSON.parse(text);
  }
  const res = await fetch(new URL(name, FOLDER));
  if (!res.ok) throw new Error(`content: ${name} (${res.status})`);
  return res.json();
}
