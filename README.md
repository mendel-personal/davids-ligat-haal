# David's Ligat Ha'Al · ליגת העל של דוד

A single-page fixtures app for the 2026/27 season of two leagues, with a switch between them:
Israel's Ligat Ha'Al and Spain's La Liga. Link straight to one with `#il` or `#es`.

- Every match by round, with scores, kick-off times (Israel time) and stadiums
- English / Hebrew toggle (Hebrew is right-to-left)
- Current points, estimated title chances (10,000 simulated seasons) and club captains
- Click any team for this season's numbers and the club's history from Wikipedia

Match data comes from [TheSportsDB](https://www.thesportsdb.com); club histories from Wikipedia.
Photos (Messi, Pelé) are from Wikimedia Commons; credits and licences are in the page footer.
Title chances are estimates, not bookmaker odds.

## How the data updates

TheSportsDB's free tier allows only a few requests a minute, too few for every visitor to load a
whole season. So a GitHub Actions job (`.github/workflows/deploy.yml`) runs every hour and on every
push: `scripts/fetch-data.mjs` writes `data/il.json` and `data/es.json`, and the job publishes them
next to `index.html` on GitHub Pages. The app loads the file for the league on screen. Without it
(for example when opening `index.html` locally) the app falls back to calling TheSportsDB directly.

The script asks for one thing every 4 seconds, and keeps requests down with two refresh speeds:

- **Every run (hourly):** only rounds that still have an unfinished match are fetched again.
  Finished rounds and club details are reused from the live site's previous data.
- **Every 6 hours:** a full refresh of every round and club, to catch late corrections.

To get the data files locally: `node scripts/fetch-data.mjs data` (add `il` / `es` for one league,
or `--full` to force a full refresh).

GitHub pauses scheduled jobs after 60 days with no activity in the repo. If scores stop updating,
re-enable the workflow from the Actions tab or push any commit.

## Run it

It's one file. Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8765
```
