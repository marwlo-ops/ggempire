# GGEmpire — PL1 Community Hub

Fan-made Goodgame Empire community portal focused on the Polish PL1 server and the Reborn and MadDevil alliances.

## Features
- Responsive community landing page
- API-backed alliance lookups and search using GGE Tracker
- Links to player tools, community forums and event rankings
- Honest unavailable-data states; no fabricated alliance stats

## Data source
The frontend uses the public GGE Tracker API: https://docs.gge-tracker.com/
The API requires the `gge-server: PL1` header for server-specific alliance lookups. Server availability is checked at runtime. If PL1 is not supported by the API, the portal explains this rather than inventing data.

## Publish
GitHub Actions deploys the static site to GitHub Pages. In **Settings → Pages**, set **Build and deployment → Source** to **GitHub Actions**.

## Notes
- This is an independent fan project and is not affiliated with Goodgame Studios.
- API data can be delayed or unavailable; the UI labels live data only when a response is received.
- Do not place API keys or other secrets in frontend code.
