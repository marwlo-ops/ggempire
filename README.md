# GGEmpire — E4K PL1 Community Hub

Fan-made community portal for the **mobile game Empire: Four Kingdoms (E4K)**, focused on the user's PL1 world and the ReBorN and MADDEVILS alliances.

## Current features
- Responsive community landing page
- Local player profile note (not a game login and not verified)
- Manual intelligence/scouting report notebook stored in browser localStorage
- World-monitor dashboard prepared for attack history, player activity, nickname/alliance changes and honor changes, currently awaiting a verified data source
- Links to community tools and alliance resources

## Data source status
**GGE Tracker has been removed from the portal as a data source and destination link because it does not contain the user's E4K world.** The previous integration was aimed at the desktop Goodgame Empire API and was not appropriate to claim as support for mobile E4K PL1.

No live alliance search, stats, attack history, activity, rename history, or honor history is currently connected. The UI explicitly reports this instead of displaying invented data. Do not reintroduce a desktop API unless compatibility with the exact mobile E4K world is verified.

The public `danadum/empire-api` project may be investigated as a possible technical lead, but do not use an untrusted hosted instance or send player passwords, one-time codes, or session cookies. Any future collector must be authorized, server-side, read-only, rate-limited, and keep secrets off the frontend.

## Historical alliance IDs (unverified for this world)
The conversation history contains `ReBorN` — AID `115`; `MADDEVILS` — AID `41343` from the `EmpirefourkingdomsExGG2_3` namespace. These are historical identifiers and must not be presented as currently verified IDs for PL1 without a live source confirmation.

## Local profile
- Nickname and optional personal ID are saved only in browser localStorage.
- This is not official authentication and does not verify account ownership.
- Never request or store game passwords, one-time codes, or session cookies.

## Intelligence notebook
- Manual reports for alliance, player, castle, troops/defense, resources, and activity notes.
- Reports remain in the visitor's browser and are not uploaded.
- Reports are user-entered information, not verified live game data.

## Publish
GitHub Actions deploys the static site to GitHub Pages. In **Settings → Pages**, set **Build and deployment → Source** to **GitHub Actions**.

## Disclaimer
This is an independent fan project and is not affiliated with Goodgame Studios. Historical values cannot be reconstructed if they were never collected.


## ReBoRN tracker integration
The GGEmpire alliance page includes a ReBoRN snapshot tracker panel. It intentionally remains in a waiting state until the E4K mobile PL1 world mapping and alliance AID are independently confirmed. No demo player values or fabricated rankings are shown.
