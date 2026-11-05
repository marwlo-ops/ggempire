#!/usr/bin/env python3
"""Conservative NPC map collector for E4K PL1.

This collector intentionally refuses to guess undocumented map commands or NPC type
IDs. Configure the command, request headers, coordinate paths and recognized NPC
type values only after they have been verified against a live E4K PL1 response.
"""
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
SERVER = os.getenv("E4K_SERVER", "EmpirefourkingdomsExGG2_3")
HOST = os.getenv("E4K_API_HOST", "empire-api.fly.dev").rstrip("/")
OUT = DATA / "npc-dungeons.json"
STATUS = DATA / "npc-scan-status.json"
REALMS = {0: "green", 1: "sand", 2: "ice", 3: "fire", 4: "islands"}
REALM_NAMES = {"green": "Zielone Krainy", "sand": "Piaski", "ice": "Lód", "fire": "Ogień", "islands": "Archipelag"}
X_KEYS = ("x", "X", "posX", "PX", "CX")
Y_KEYS = ("y", "Y", "posY", "PY", "CY")
REALM_KEYS = ("realm", "kingdom", "kid", "KID", "kingdomId", "K")
TYPE_KEYS = ("type", "objectType", "OT", "OID", "T", "typeId")
NAME_KEYS = ("name", "N", "title", "objectName")
LEVEL_KEYS = ("level", "LV", "L", "lvl")
ISLAND_KEYS = ("island", "islandName", "IN", "islandId")


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def write_json(path, payload):
    DATA.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp.replace(path)


def get_first(obj, keys):
    if not isinstance(obj, dict):
        return None
    for key in keys:
        value = obj.get(key)
        if value is not None and value != "":
            return value
    return None


def walk(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk(child)


def api_request(command, headers):
    encoded = urllib.parse.quote(json.dumps(headers, separators=(",", ":"), ensure_ascii=False), safe="")
    url = f"{HOST}/{urllib.parse.quote(SERVER, safe='')}/{urllib.parse.quote(command, safe='')}/{encoded}"
    request = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "GGEmpire-NPC-Scanner/1.0"})
    with urllib.request.urlopen(request, timeout=20) as response:
        body = response.read(2_000_000)
        if response.status != 200:
            raise RuntimeError(f"Bridge HTTP {response.status}")
    payload = json.loads(body.decode("utf-8"))
    if str(payload.get("return_code")) != "0":
        raise RuntimeError(f"Game command returned code {payload.get('return_code')}")
    return payload


def normalize_records(payload, accepted_types):
    found = {}
    content = payload.get("content")
    for obj in walk(content):
        x = get_first(obj, X_KEYS)
        y = get_first(obj, Y_KEYS)
        kind = get_first(obj, TYPE_KEYS)
        realm_value = get_first(obj, REALM_KEYS)
        if x is None or y is None or kind is None or realm_value is None:
            continue
        try:
            x_num, y_num = int(x), int(y)
            realm_id = int(realm_value)
        except (TypeError, ValueError):
            continue
        if str(kind).casefold() not in accepted_types or realm_id not in REALMS:
            continue
        realm = REALMS[realm_id]
        if realm == "green":
            continue
        name = get_first(obj, NAME_KEYS)
        level = get_first(obj, LEVEL_KEYS)
        island = get_first(obj, ISLAND_KEYS)
        stable = f"{realm}:{kind}:{x_num}:{y_num}"
        found[stable] = {
            "id": stable, "realm": realm, "type": str(kind),
            "name": str(name) if name is not None else f"NPC {kind}",
            "x": x_num, "y": y_num,
            "level": level,
            "island": str(island) if island is not None else None,
            "source": "verified-e4k-pl1-map-response",
            "status": "unknown",
        }
    return list(found.values())


def main():
    now = now_iso()
    command = os.getenv("E4K_MAP_COMMAND", "").strip()
    headers_raw = os.getenv("E4K_MAP_HEADERS_JSON", "").strip()
    accepted_raw = os.getenv("E4K_NPC_TYPE_VALUES", "").strip()
    if not command or not headers_raw or not accepted_raw:
        write_json(STATUS, {
            "verified": False, "server": SERVER, "updatedAt": now,
            "state": "blocked-unconfigured",
            "message": "Nie ustawiono potwierdzonej komendy mapy, nagłówków zapytania ani listy identyfikatorów NPC. Skaner nie zgaduje protokołu i zachowuje ostatnią bazę.",
        })
        print("NPC scanner not configured; existing NPC database preserved.")
        return
    try:
        headers = json.loads(headers_raw)
        if not isinstance(headers, dict):
            raise ValueError("E4K_MAP_HEADERS_JSON must be an object")
        accepted_types = {item.strip().casefold() for item in accepted_raw.split(",") if item.strip()}
        payload = api_request(command, headers)
        targets = normalize_records(payload, accepted_types)
        if not targets:
            write_json(STATUS, {
                "verified": False, "server": SERVER, "updatedAt": now,
                "state": "no-recognized-npc-records",
                "message": "Odpowiedź nie zawierała rekordów NPC spełniających zweryfikowany schemat. Poprzednia baza została zachowana.",
                "command": command,
            })
            print("No recognized NPC records; existing NPC database preserved.")
            return
        previous = {}
        try:
            previous = json.loads(OUT.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            pass
        # Preserve locally known cooldowns when the same target appears in the new scan.
        old_by_id = {str(row.get("id")): row for row in previous.get("targets", []) if isinstance(row, dict)}
        for row in targets:
            old = old_by_id.get(row["id"], {})
            for key in ("cooldownUntil", "lastAttackedAt"):
                if old.get(key):
                    row[key] = old[key]
        write_json(OUT, {
            "schemaVersion": 1, "server": SERVER, "verified": True,
            "updatedAt": now, "scanMode": "configured-map-command",
            "realms": ["ice", "sand", "fire", "islands"], "targets": targets,
        })
        write_json(STATUS, {
            "verified": True, "server": SERVER, "updatedAt": now,
            "state": "success", "command": command, "targets": len(targets),
            "byRealm": {realm: sum(1 for row in targets if row["realm"] == realm) for realm in ("ice", "sand", "fire", "islands")},
        })
        print(f"NPC scan saved: {len(targets)} verified records.")
    except (OSError, ValueError, urllib.error.URLError, TimeoutError, RuntimeError, json.JSONDecodeError) as exc:
        write_json(STATUS, {
            "verified": False, "server": SERVER, "updatedAt": now,
            "state": "scan-failed", "error": f"{type(exc).__name__}: {exc}",
            "message": "Skan nie powiódł się; poprzednia baza NPC została zachowana.",
        })
        raise


if __name__ == "__main__":
    main()
