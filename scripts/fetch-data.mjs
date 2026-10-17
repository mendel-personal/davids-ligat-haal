// Fetches each league's fixtures and club details from TheSportsDB and writes
// one JSON file per league for the app to load. Runs hourly in GitHub Actions so
// visitors' browsers never hit TheSportsDB's rate limit themselves.
//
// Two refresh speeds, to keep requests (and rate-limit trouble) down:
//   - quick (every run): re-fetch only rounds that still have an unfinished match
//     (upcoming, live, postponed, abandoned); finished rounds are kept from the
//     previous data file, and club details are reused.
//   - full (when the last full refresh is 6+ hours old, or with --full): re-fetch
//     every round and every club, to pick up late corrections to old results.
//
// The previous data comes from <output-dir>/<league>.json if it exists, otherwise
// from $PREVIOUS_URL/data/<league>.json (the live site, in GitHub Actions). With
// neither, the run is full.
//
// Usage: node scripts/fetch-data.mjs <output-dir> [il|es ...] [--full]
//   Writes <output-dir>/il.json and <output-dir>/es.json (or only the leagues named).

import { mkdir, readFile, writeFile } from "node:fs/promises";

const SEASON = "2026-2027";
const LEAGUES = {
  il: { name: "Israeli Premier League", id: 4644, rounds: 26, perRound: 7 },
  es: { name: "Spanish La Liga", id: 4335, rounds: 38, perRound: 10 },
};
const BASE = "https://www.thesportsdb.com/api/v1/json/123";
const GAP_MS = 4000; // 15 requests a minute: slow enough that TheSportsDB doesn't make us wait
const FULL_EVERY_MS = 6 * 3600 * 1000;
const FULL_SLACK_MS = 10 * 60 * 1000; // hourly runs drift; count "5h52m ago" as due
const FINISHED = new Set(["FT", "AET", "PEN", "AWD", "WO"]);

const args = process.argv.slice(2);
const forceFull = args.includes("--full");
const [outDir, ...picked] = args.filter((a) => a !== "--full");
if (!outDir) {
  console.error("Usage: node scripts/fetch-data.mjs <output-dir> [il|es ...] [--full]");
  process.exit(1);
}
const keys = picked.length ? picked : Object.keys(LEAGUES);
for (const k of keys) if (!LEAGUES[k]) { console.error(`Unknown league "${k}"`); process.exit(1); }

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

// The last data file for this league, from disk or the live site; null if there's none usable.
async function loadPrevious(key) {
  const ok = (d) => d && d.season === SEASON && Array.isArray(d.events) && d.events.length ? d : null;
  try { return ok(JSON.parse(await readFile(`${outDir}/${key}.json`, "utf8"))); } catch {}
  if (process.env.PREVIOUS_URL) {
    try {
      const res = await fetch(`${process.env.PREVIOUS_URL.replace(/\/$/, "")}/data/${key}.json`, { cache: "no-store" });
      if (res.ok) return ok(await res.json());
    } catch {}
  }
  return null;
}

async function fetchLeague(key) {
  const lg = LEAGUES[key];
  const round = async (r) => (await get(`eventsround.php?id=${lg.id}&r=${r}&s=${SEASON}`)).events || [];
  const prev = await loadPrevious(key);
  const lastFull = prev?.fullUpdated ? Date.parse(prev.fullUpdated) : 0;
  const full = forceFull || !prev || Date.now() - lastFull >= FULL_EVERY_MS - FULL_SLACK_MS;
  console.log(`== ${lg.name}: ${full ? "full refresh" : "quick refresh"}`
    + (prev ? ` (last full refresh ${prev.fullUpdated || "unknown"})` : " (no previous data)"));

  // Rounds whose matches are all finished, carried over from the previous file on a quick refresh.
  const kept = new Map();
  if (!full) {
    const byRound = new Map();
    for (const e of prev.events) {
      const r = +e.intRound;
      if (!byRound.has(r)) byRound.set(r, []);
      byRound.get(r).push(e);
    }
    for (const [r, es] of byRound) if (es.every((e) => FINISHED.has((e.strStatus || "").toUpperCase()))) kept.set(r, es);
  }

  const events = [];
  let fetched = 0;
  for (let r = 1; r <= lg.rounds; r++) {
    if (kept.has(r)) { events.push(...kept.get(r)); continue; }
    const e = await round(r);
    fetched++;
    console.log(`round ${r}: ${e.length} matches`);
    events.push(...e);
  }
  // Playoff rounds only exist once scheduled; stop at the first empty one.
  for (let r = lg.rounds + 1; r <= lg.rounds + 14; r++) {
    if (kept.has(r)) { events.push(...kept.get(r)); continue; }
    const e = await round(r);
    fetched++;
    if (!e.length) break;
    console.log(`round ${r}: ${e.length} matches`);
    events.push(...e);
  }
  if (events.length < lg.perRound * lg.rounds) throw new Error(`${lg.name}: only got ${events.length} matches; refusing to publish partial data`);
  console.log(`rounds fetched: ${fetched}, kept from last time: ${kept.size}`);

  // Club details: all clubs on a full refresh; otherwise only clubs we don't have yet.
  const ids = [...new Set(events.flatMap((e) => [e.idHomeTeam, e.idAwayTeam]).filter(Boolean))];
  const teams = full ? {} : { ...(prev.teams || {}) };
  for (const id of ids) {
    if (teams[id]) continue;
    const t = (await get(`lookupteam.php?id=${id}`)).teams?.[0];
    if (t) teams[id] = { founded: t.intFormedYear, stadium: t.strStadium };
  }
  console.log(`club details: ${Object.keys(teams).length} of ${ids.length}`);

  const now = new Date().toISOString();
  const file = `${outDir}/${key}.json`;
  await writeFile(file, JSON.stringify({ updated: now, fullUpdated: full ? now : prev.fullUpdated, season: SEASON, events, teams }));
  console.log(`wrote ${events.length} matches to ${file}`);
}

await mkdir(outDir, { recursive: true });
for (const k of keys) await fetchLeague(k);
