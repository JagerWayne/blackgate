import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { readdirSync, existsSync } from 'node:fs';

// The portraits are the files in data/images/people/male and /female: nothing to populate. A browser cannot list
// a folder, so the dev server (and the build) answer the list the game asks for, read from those folders each time.
const people = fileURLToPath(new URL('./data/images/people/', import.meta.url));
const listPeople = () => {
  const ls = (dir) => (existsSync(people + dir) ? readdirSync(people + dir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort() : []);
  return JSON.stringify({ male: ls('male'), female: ls('female') });
};
const portraitFolders = () => ({
  name: 'portrait-folders',
  configureServer(server) {
    server.middlewares.use('/images/people/index.json', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(listPeople());
    });
  },
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'images/people/index.json', source: listPeople() });
  },
});

// v2 is served from its own folder: npm run ui, then open http://localhost:5173/.
// publicDir is v2/data, because game/data/contentLoad.js asks for '../../data/' relative to itself.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [tailwindcss(), portraitFolders()],
  publicDir: 'data',
  build: { outDir: 'dist', emptyOutDir: true },
});
