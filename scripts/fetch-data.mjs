// Fetches the season's fixtures and club details from TheSportsDB and writes
// them to one JSON file the app loads. Runs in GitHub Actions on a schedule so
// visitors' browsers never hit TheSportsDB's rate limit themselves.
//
// Usage: node scripts/fetch-data.mjs <output.json>

import { writeFile } from "node:fs/promises";

const LEAGUE = 4644;
const SEASON = "2026-2027";
const BASE = "https://www.thesportsdb.com/api/v1/json/123";
const REGULAR_ROUNDS = 26;
const GAP_MS = 2200; // ~27 requests a minute, under the free tier's limit

const out = process.argv[2];
if (!out) {
  console.error("Usage: node scripts/fetch-data.mjs <output.json>");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(path, tries = 6) {
  await sleep(GAP_MS);
  const res = await fetch(`${BASE}/${path}`);
  if (res.status === 429 && tries > 0) {
    const wait = (Number(res.headers.get("retry-after")) || 30) + 2;
    console.log(`  rate limited, waiting ${wait}s`);
    await sleep(wait * 1000);
    return get(path, tries - 1);
  }
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

const round = async (r) => (await get(`eventsround.php?id=${LEAGUE}&r=${r}&s=${SEASON}`)).events || [];

const events = [];
for (let r = 1; r <= REGULAR_ROUNDS; r++) {
  const e = await round(r);
  console.log(`round ${r}: ${e.length} matches`);
  events.push(...e);
}
// Playoff rounds only exist once scheduled; stop at the first empty one.
for (let r = REGULAR_ROUNDS + 1; r <= 40; r++) {
  const e = await round(r);
  if (!e.length) break;
  console.log(`round ${r}: ${e.length} matches`);
  events.push(...e);
}
if (events.length < 7 * REGULAR_ROUNDS) throw new Error(`Only got ${events.length} matches; refusing to publish partial data`);

const ids = [...new Set(events.flatMap((e) => [e.idHomeTeam, e.idAwayTeam]).filter(Boolean))];
const teams = {};
for (const id of ids) {
  const t = (await get(`lookupteam.php?id=${id}`)).teams?.[0];
  if (t) teams[id] = { founded: t.intFormedYear, stadium: t.strStadium };
}
console.log(`club details: ${Object.keys(teams).length} of ${ids.length}`);

await writeFile(out, JSON.stringify({ updated: new Date().toISOString(), season: SEASON, events, teams }));
console.log(`wrote ${events.length} matches to ${out}`);
