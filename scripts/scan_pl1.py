#!/usr/bin/env python3
"""Build a static PL1 alliance/player index from the public E4K API.

The collector is deliberately conservative: it preserves raw API records, never
replaces a last-good database with an empty/partial scan, and records history only
for player fields actually returned by the API.
"""
import http.client
import json
import os
import time
import urllib.parse
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
SERVER = os.getenv("E4K_SERVER", "EmpirefourkingdomsExGG2_3")
HOST = os.getenv("E4K_API_HOST", "empire-api.fly.dev")
RANKING_STARTS = [str(n) for n in range(5, 100, 10)]
MAX_ALLIANCES = int(os.getenv("PL1_SCAN_ALLIANCES", "50"))
SLEEP_SECONDS = float(os.getenv("PL1_SCAN_DELAY", "0.4"))
KNOWN_AIDS = [115, 41343]
HISTORY_DAYS = 14


def api_get(endpoint, params):
    raw = json.dumps(params, separators=(",", ":"), ensure_ascii=False)
    path = f"/{SERVER}/{endpoint}/{urllib.parse.quote(raw, safe='')}"
    conn = http.client.HTTPSConnection(HOST, timeout=20)
    try:
        conn.request("GET", path, headers={"Accept": "application/json", "User-Agent": "GGEmpire-PL1-Scanner/2.1"})
        response = conn.getresponse()
        body = response.read()
        if response.status != 200:
            raise RuntimeError(f"HTTP {response.status} for {endpoint}")
        return json.loads(body.decode("utf-8"))
    finally:
        conn.close()


def content_of(payload):
    return payload.get("content") if isinstance(payload, dict) else None


def rows_from(payload):
    content = content_of(payload)
    if isinstance(content, dict):
        for key in ("L", "A", "M", "ML", "alliances", "items", "R"):
            value = content.get(key)
            if isinstance(value, list):
                return value
            if isinstance(value, dict):
                return list(value.values())
    if isinstance(content, list):
        return content
    return []


def walk_dicts(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk_dicts(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk_dicts(child)


def first(record, keys):
    for key in keys:
        value = record.get(key)
        if value not in (None, ""):
            return value
    return None


def normalize_rank_row(row, rank):
    candidates = list(walk_dicts(row))
    item = candidates[-1] if candidates else {}
    return {
        "rank": first(item, ("R", "rank", "RANK", "POS", "position")) or rank,
        "aid": first(item, ("AID", "aid", "allianceId", "alliance_id")),
        "name": first(item, ("AN", "N", "name", "NAME", "alliance_name")),
        "power": first(item, ("PP", "P", "PO", "PW", "MP", "power", "Power", "score", "points")),
        "member_count": first(item, ("MC", "NM", "MEM", "memberCount", "membersCount", "C")),
        "raw": row,
    }


def get_aid(row):
    for item in walk_dicts(row):
        aid = first(item, ("AID", "aid", "allianceId", "alliance_id"))
        if aid is not None:
            try:
                return int(aid)
            except (TypeError, ValueError):
                pass
    return None


def alliance_detail(aid):
    # Keep the documented AID form first; try the legacy A10 shape only if needed.
    last_error = None
    for params in ({"AID": int(aid)}, {"A10": int(aid)}):
        try:
            payload = api_get("ain", params)
            if isinstance(payload, dict) and str(payload.get("return_code")) == "0" and content_of(payload):
                return payload
            last_error = RuntimeError(f"ain returned code {payload.get('return_code') if isinstance(payload, dict) else 'unknown'}")
        except Exception as exc:
            last_error = exc
        time.sleep(0.15)
    raise RuntimeError(f"ain failed for AID {aid}: {last_error}")


def parse_members(payload, aid, alliance_name):
    content = content_of(payload) or {}
    # Preserve common wrapper shape content.A, but support content directly too.
    alliance = content.get("A") if isinstance(content, dict) and isinstance(content.get("A"), dict) else content
    members = []
    for key in ("M", "ML", "members", "players"):
        value = alliance.get(key) if isinstance(alliance, dict) else None
        if isinstance(value, dict):
            value = list(value.values())
        if isinstance(value, list):
            members = value
            break
    normalized = []
    for member in members:
        if not isinstance(member, dict):
            continue
        oid = first(member, ("OID", "OID1", "PID", "PID1", "id", "ID", "playerId"))
        name = first(member, ("N", "PN", "name", "NAME", "nickname"))
        if name is None:
            continue
        normalized.append({
            "pid": str(oid) if oid is not None else None,
            "name": str(name),
            "alliance_aid": int(aid),
            "alliance_name": str(alliance_name or f"AID_{aid}"),
            "might": first(member, ("PP", "P", "PO", "PW", "might", "power")),
            "honor": first(member, ("H", "HONOR", "honor")),
            "level": first(member, ("LV", "L", "level", "LEVEL")),
            "rank": first(member, ("AR", "R", "rank", "allianceRank")),
            "raw": member,
        })
    return alliance, normalized


def read_json(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return default


def atomic_json(path, value):
    DATA.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


def main():
    DATA.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc)
    ranking_rows = []
    ranking_errors = []
    for start in RANKING_STARTS:
        try:
            payload = api_get("hgh", {"LT": 11, "LID": 1, "SV": start})
            rows = rows_from(payload)
            if not rows:
                ranking_errors.append({"sv": start, "error": "No ranking rows", "raw": payload})
            else:
                ranking_rows.extend(rows)
        except Exception as exc:
            ranking_errors.append({"sv": start, "error": str(exc)})
        time.sleep(SLEEP_SECONDS)

    alliances_ranked = []
    seen_aids = set()
    for index, row in enumerate(ranking_rows, 1):
        normalized = normalize_rank_row(row, index)
        aid = get_aid(row)
        if aid is not None:
            normalized["aid"] = aid
            if aid not in seen_aids:
                seen_aids.add(aid)
                alliances_ranked.append(normalized)
    # Keep known alliances available even if ranking schema doesn't expose AID.
    for aid in KNOWN_AIDS:
        if aid not in seen_aids:
            alliances_ranked.append({"rank": None, "aid": aid, "name": None, "power": None, "member_count": None, "raw": None, "pinned": True})

    previous_rank = read_json(DATA / "alliances_pl1.json", {})
    if not alliances_ranked or len(ranking_errors) == len(RANKING_STARTS):
        atomic_json(DATA / "scan_pl1_status.json", {
            "verified": False, "server": SERVER, "updated_at": now.isoformat(),
            "error": "Ranking scan returned no usable rows; previous databases were preserved.",
            "ranking_errors": ranking_errors,
        })
        raise RuntimeError("No usable hgh ranking pages; last-good databases preserved")

    # Fetch full member rosters for top N ranked AIDs plus the two pinned AIDs.
    ranked_aids = [int(a["aid"]) for a in alliances_ranked if a.get("aid") is not None and not a.get("pinned")]
    selected_aids = list(dict.fromkeys(ranked_aids[:MAX_ALLIANCES] + KNOWN_AIDS))
    alliance_details = []
    players_by_key = {}
    failures = []
    for aid in selected_aids:
        try:
            payload = alliance_detail(aid)
            content = content_of(payload) or {}
            alliance, members = parse_members(payload, aid, None)
            name = first(alliance, ("N", "AN", "name", "NAME")) if isinstance(alliance, dict) else None
            name = name or next((a.get("name") for a in alliances_ranked if a.get("aid") == aid and a.get("name")), f"AID_{aid}")
            for member in members:
                member["alliance_name"] = name
                key = member.get("pid") or (str(aid) + ":" + member["name"].casefold())
                players_by_key[key] = member
            alliance_details.append({
                "aid": aid, "name": name, "member_count": len(members),
                "reported_power": first(alliance, ("PP", "P", "PO", "PW", "power", "Power")) if isinstance(alliance, dict) else None,
                "raw": alliance,
            })
        except Exception as exc:
            failures.append({"aid": aid, "error": str(exc)})
        time.sleep(SLEEP_SECONDS)

    # Do not replace the player DB with a partial scan if most roster calls failed.
    successful = len(alliance_details)
    if successful < len(selected_aids) or not players_by_key:
        atomic_json(DATA / "scan_pl1_status.json", {
            "verified": False, "server": SERVER, "updated_at": now.isoformat(),
            "error": "Too many roster failures; previous player database preserved.",
            "alliances_attempted": len(selected_aids), "alliances_succeeded": successful,
            "failures": failures, "ranking_errors": ranking_errors,
        })
        raise RuntimeError("Roster scan too incomplete; last-good player database preserved")

    # Enrich rank entries with names/details, retaining raw ranking rows.
    detail_by_aid = {a["aid"]: a for a in alliance_details}
    for item in alliances_ranked:
        detail = detail_by_aid.get(item.get("aid"))
        if detail:
            item["name"] = item.get("name") or detail["name"]
            item["member_count"] = item.get("member_count") or detail["member_count"]
            item["detail"] = detail

    old_players = read_json(DATA / "players_pl1.json", {}).get("players", [])
    old_by_key = {str(p.get("pid") or (str(p.get("alliance_aid")) + ":" + str(p.get("name", "")).casefold())): p for p in old_players}
    changes = []
    for key, player in players_by_key.items():
        old = old_by_key.get(key)
        if old:
            for field in ("might", "honor", "alliance_aid", "alliance_name", "name"):
                if old.get(field) != player.get(field):
                    changes.append({"key": key, "name": player.get("name"), "field": field,
                                    "old": old.get(field), "new": player.get(field), "at": now.isoformat()})
    for key, old in old_by_key.items():
        if key not in players_by_key:
            changes.append({"key": key, "name": old.get("name"), "field": "not_seen_in_scan",
                            "old": old.get("alliance_name"), "new": None, "at": now.isoformat()})

    history = read_json(DATA / "history_pl1.json", {"server": SERVER, "snapshots": []})
    snapshots = history.get("snapshots", [])
    # Full baseline snapshots every 6 hours; between baselines retain only change events.
    # This keeps 14-day history useful without duplicating every player record every 30 minutes.
    if now.hour % 6 == 0 and now.minute < 35:
        snapshots.append({
            "at": now.isoformat(), "kind": "baseline", "players": {
                key: {field: player.get(field) for field in ("pid", "name", "might", "honor", "alliance_aid", "alliance_name")}
                for key, player in players_by_key.items()
            }, "changes": changes,
        })
    elif changes:
        snapshots.append({"at": now.isoformat(), "kind": "changes", "changes": changes})
    cutoff = now - timedelta(days=HISTORY_DAYS)
    snapshots = [s for s in snapshots if s.get("at") and datetime.fromisoformat(s["at"].replace("Z", "+00:00")) >= cutoff]
    atomic_json(DATA / "alliances_pl1.json", {
        "verified": True, "server": SERVER, "updated_at": now.isoformat(),
        "count": len(alliances_ranked), "scanned_rosters": successful,
        "ranking_pages": len(RANKING_STARTS) - len(ranking_errors), "ranking_errors": ranking_errors,
        "alliances": alliances_ranked, "details": alliance_details, "failures": failures,
    })
    atomic_json(DATA / "players_pl1.json", {
        "verified": True, "server": SERVER, "updated_at": now.isoformat(),
        "count": len(players_by_key), "coverage": f"rosters from up to {MAX_ALLIANCES} top-ranked alliances plus pinned alliances",
        "players": list(players_by_key.values()),
    })
    atomic_json(DATA / "history_pl1.json", {"server": SERVER, "updated_at": now.isoformat(), "retention_days": HISTORY_DAYS, "snapshots": snapshots})
    atomic_json(DATA / "scan_pl1_status.json", {
        "verified": True, "server": SERVER, "updated_at": now.isoformat(),
        "ranking_rows": len(ranking_rows), "alliances_ranked": len(alliances_ranked),
        "rosters_attempted": len(selected_aids), "rosters_succeeded": successful,
        "players": len(players_by_key), "changes": len(changes),
        "ranking_errors": ranking_errors, "roster_failures": failures,
    })
    print(f"PL1 scan saved: {len(alliances_ranked)} alliances, {len(players_by_key)} players, {successful}/{len(selected_aids)} rosters, {len(changes)} changes")


if __name__ == "__main__":
    main()
