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


## Historical alliance IDs (not yet verified for PL1)
The conversation history contains these identifiers from the `EmpirefourkingdomsExGG2_3` server namespace (Empire: Four Kingdoms): `ReBorN` — AID `115`; `MADDEVILS` — AID `41343`. These are recorded as historical E4K IDs only. Do **not** treat them as confirmed IDs for the Goodgame Empire PC server PL1 until the server namespace and live API response are verified. The `empire-api` project uses separate server namespaces for GGE and E4K, so IDs must not be silently carried across games/servers.


## Intelligence notebook
- Manual in-game scouting/espionage report log for alliance, player, castle, troop/defense, resources and activity notes.
- Reports are saved only in the visitor's browser using localStorage; there is no server upload or automatic access to private game data.
- Reports older than 7 days are marked stale. Treat recorded intelligence as user-entered information, not verified live game data.


## E4K profile linking status
- Public sources reviewed did not document an official Goodgame Studios OAuth/login flow or authenticated player API for this project. The public `empire-api` README describes a REST API for game data but not account authentication.
- The site therefore provides a local profile note (nickname and optional personal ID) only. It is explicitly **not verified**, does not sign in to the game, and does not unlock live stats/history. Values remain in browser localStorage and can be removed with “Odłącz profil”.
- Never request or store game passwords, one-time codes, or session cookies. Implement official OAuth only if Goodgame Studios publishes or grants an authorized flow and documented scopes.
- Live stats, alliance membership and history remain dependent on a documented, reachable API endpoint for E4K server namespace `EmpirefourkingdomsExGG2_3`; the GGE Tracker PL1 integration must not be assumed to apply to E4K.
