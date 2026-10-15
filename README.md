# David's Ligat Ha'Al · ליגת העל של דוד

A single-page fixtures app for the Israeli Premier League (Ligat Ha'Al), 2026/27 season.

- Every match by round, with scores, kick-off times (Israel time) and stadiums
- English / Hebrew toggle (Hebrew is right-to-left)
- Current points, estimated title chances (10,000 simulated seasons) and club captains
- Click any team for this season's numbers and the club's history from Wikipedia

Match data comes live from [TheSportsDB](https://www.thesportsdb.com); club histories from Wikipedia.
Title chances are estimates, not bookmaker odds.

## Run it

It's one file. Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8765
```
