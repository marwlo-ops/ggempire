#!/usr/bin/env python3
"""Read-only collector for the ReBoRN tracker. Requires verified PL1 mapping."""
import json
import os
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "reborn-latest.json"

def main():
    if os.getenv("E4K_PL1_MAPPING_VERIFIED", "").lower() != "true":
        print("Skipped: mobile E4K PL1 mapping is not verified.")
        return 0
    server = os.getenv("E4K_SERVER", "EmpirefourkingdomsExGG2_3")
    aid = int(os.getenv("E4K_REBORN_AID", "115"))
    base = os.getenv("E4K_API_BASE", "https://empire-api.fly.dev").rstrip("/")
    url = f'{base}/{server}/ain/%22AID%22:{aid}'
    request = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "GGEmpire-ReadOnly-Tracker/1.0"})
    with urllib.request.urlopen(request, timeout=20) as response:
        payload = json.loads(response.read().decode("utf-8"))
    alliance = payload.get("content", {}).get("A")
    if str(payload.get("return_code")) != "0" or not isinstance(alliance, dict):
        raise RuntimeError("API response did not contain a recognized alliance.")
    raw = alliance.get("M", alliance.get("members"))
    if not isinstance(raw, list) or not raw:
        raise RuntimeError("No recognized member list; previous snapshot was preserved.")
    players = []
    for member in raw:
        if not isinstance(member, dict):
            continue
        oid = member.get("OID", member.get("oid", member.get("id", member.get("ID"))))
        name = member.get("N", member.get("name", member.get("NAME")))
        if oid is None or name is None:
            continue
        players.append({
            "oid": str(oid), "name": str(name),
            "honor": member.get("H", member.get("honor", member.get("HONOR"))),
            "might": member.get("P", member.get("PO", member.get("might", member.get("power")))),
            "loot_current": member.get("CF", member.get("loot_current", member.get("loot")))
        })
    if not players:
        raise RuntimeError("Member fields did not match expected shape; previous snapshot was preserved.")
    players.sort(key=lambda p: (p["might"] is None, -(float(p["might"]) if str(p["might"]).replace(".", "", 1).isdigit() else 0)))
    old = {}
    try:
        previous = json.loads(OUTPUT.read_text(encoding="utf-8"))
        old = previous.get("players_by_oid") or {str(p["oid"]): p for p in previous.get("players", [])}
    except (OSError, json.JSONDecodeError):
        pass
    prev_players = {str(k): {field: v.get(field) for field in ("honor", "might", "loot_current")} for k, v in old.items()}
    total = sum(float(p["might"]) for p in players if p["might"] is not None and str(p["might"]).replace(".", "", 1).isdigit())
    snapshot = {
        "verified": True, "source": base, "server": server, "aid": aid,
        "alliance_name": alliance.get("N", alliance.get("name", "ReBoRN")),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "player_count": len(players), "total_might": round(total),
        "prev_players": prev_players, "players_by_oid": {p["oid"]: p for p in players},
        "players": players
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    temporary = OUTPUT.with_suffix(".tmp")
    temporary.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temporary.replace(OUTPUT)
    print(f"Snapshot saved: {len(players)} players.")
    return 0

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"Collector failed safely: {error}", file=sys.stderr)
        raise SystemExit(1)
