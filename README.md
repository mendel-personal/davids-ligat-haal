# David's Ligat Ha'Al · ליגת העל של דוד

A single-page fixtures app for the Israeli Premier League (Ligat Ha'Al), 2026/27 season.

- Every match by round, with scores, kick-off times (Israel time) and stadiums
- English / Hebrew toggle (Hebrew is right-to-left)
- Current points, estimated title chances (10,000 simulated seasons) and club captains
- Click any team for this season's numbers and the club's history from Wikipedia

Match data comes from [TheSportsDB](https://www.thesportsdb.com); club histories from Wikipedia.

## How the data updates

TheSportsDB's free tier allows only a few requests a minute, too few for every visitor to load a
whole season. So a GitHub Actions job (`.github/workflows/deploy.yml`) runs every 15 minutes and on
every push: `scripts/fetch-data.mjs` fetches all rounds slowly into `fixtures.json`, and the job
publishes it next to `index.html` on GitHub Pages. The app loads that one file. Without it (for
example when opening `index.html` locally) the app falls back to calling TheSportsDB directly.

GitHub pauses scheduled jobs after 60 days with no activity in the repo. If scores stop updating,
re-enable the workflow from the Actions tab or push any commit.
Title chances are estimates, not bookmaker odds.

## Run it

It's one file. Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8765
```
