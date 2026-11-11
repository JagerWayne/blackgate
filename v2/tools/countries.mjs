// Builds data/countries.json from Natural Earth's countries (1:50m by default) (public
// domain, naturalearthdata.com). Positions are fractions of the map, the same
// grid as data/cities.json: x = (lon + 180) / 360, y = (90 - lat) / 180.
// Run with: node v2/tools/countries.mjs <ne_50m_admin_0_countries.geojson>
import fs from 'node:fs';

const src = process.argv[2];
if (!src) throw new Error('usage: node v2/tools/countries.mjs <ne_50m_admin_0_countries.geojson>');
const geo = JSON.parse(fs.readFileSync(src, 'utf8'));
const r4 = (v) => Math.round(v * 10000) / 10000;
const countries = geo.features
  .filter((f) => f.properties.ISO_A3 !== 'ATA' && f.properties.ADM0_A3 !== 'ATA')
  .map((f) => {
    const p = f.properties;
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    // outer rings only: lakes are too small to matter at this scale
    const rings = polys
      .map((poly) => {
        // points that round onto the one before add size and nothing else
        const ring = [];
        poly[0].forEach(([lon, lat]) => {
          const x = r4((lon + 180) / 360);
          const y = r4((90 - lat) / 180);
          if (x !== ring[ring.length - 2] || y !== ring[ring.length - 1]) ring.push(x, y);
        });
        return ring;
      })
      .filter((ring) => ring.length >= 6);
    const xs = rings.flatMap((ring) => ring.filter((_, i) => i % 2 === 0));
    const ys = rings.flatMap((ring) => ring.filter((_, i) => i % 2 === 1));
    const box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    const code = p.ISO_A2_EH && p.ISO_A2_EH !== '-99' ? p.ISO_A2_EH : p.ADM0_A3;
    return { code, name: p.NAME.toUpperCase(), box, rings };
  })
  .sort((a, b) => a.name.localeCompare(b.name));
const out = new URL('../data/countries.json', import.meta.url);
fs.writeFileSync(out, `${JSON.stringify({ source: `Natural Earth ${geo.name.match(/\d+m/)?.[0] ?? ''} (public domain)`, countries })}\n`);
console.log(`${countries.length} countries`);
