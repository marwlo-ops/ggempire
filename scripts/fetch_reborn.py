#!/usr/bin/env python3
"""Read-only collector for the two configured E4K alliance snapshots."""
import json, os, sys, urllib.request
from urllib.parse import quote
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
ALLIANCES = [(115, "reborn-latest.json", "ReBoRN"), (41343, "alliance-41343.json", "MADDEVILS")]


def fetch_server_alliance_ranking(server, base):
    """Fetch hgh ranking; preserve raw rows and save diagnostics without inventing fields."""
    from urllib.parse import quote
    params = {"LT": 11, "LID": 1, "SV": "5"}
    encoded = quote(json.dumps(params, separators=(",", ":")), safe="")
    url = f"{base}/{server}/hgh/{encoded}"
    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "GGEmpire-ReadOnly-Tracker/1.0"})
    output = DATA / "alliance-ranking.json"
    try:
        with urllib.request.urlopen(req, timeout=25) as response:
            raw_text = response.read().decode("utf-8")
        payload = json.loads(raw_text)
    except Exception as exc:
        debug = {"verified": False, "source": url, "server": server, "parameters": params,
                 "fetched_at": datetime.now(timezone.utc).isoformat(), "error": str(exc)}
        DATA.mkdir(parents=True, exist_ok=True)
        (DATA / "alliance-ranking-debug.json").write_text(json.dumps(debug, ensure_ascii=False, indent=2) + "\\n", encoding="utf-8")
        raise RuntimeError(f"hgh request/JSON failed; raw diagnostic saved to data/alliance-ranking-debug.json: {exc}") from exc

    content = payload.get("content") if isinstance(payload, dict) else None
    rows = content.get("L") if isinstance(content, dict) else None
    if isinstance(rows, dict):
        rows = list(rows.values())
    if not isinstance(rows, list):
        rows = []
    if not rows or (isinstance(payload, dict) and str(payload.get("return_code")) != "0"):
        debug = {"verified": False, "source": url, "server": server, "parameters": params,
                 "fetched_at": datetime.now(timezone.utc).isoformat(),
                 "error": payload.get("error") if isinstance(payload, dict) else "Unexpected response shape",
                 "debug_raw": payload}
        DATA.mkdir(parents=True, exist_ok=True)
        (DATA / "alliance-ranking-debug.json").write_text(json.dumps(debug, ensure_ascii=False, indent=2) + "\\n", encoding="utf-8")
        raise RuntimeError("hgh returned no usable content.L list; raw response saved to data/alliance-ranking-debug.json")

    normalized = []
    for index, row in enumerate(rows, 1):
        # Keep every original row. Only extract fields when a row/object explicitly exposes them.
        candidates = []
        if isinstance(row, dict):
            candidates = [row]
        elif isinstance(row, list):
            candidates = [value for value in row if isinstance(value, dict)]
        item = candidates[-1] if candidates else {}
        def pick(*keys):
            for key in keys:
                value = item.get(key)
                if value is not None and value != "":
                    return value
            return None
        rank = pick("R", "rank", "RANK", "POS", "position")
        try:
            rank = int(rank) if rank is not None else index
        except (TypeError, ValueError):
            rank = index
        normalized.append({
            "rank": rank,
            "name": pick("N", "name", "NAME", "AN", "alliance_name"),
            "aid": pick("AID", "aid", "ID", "id", "allianceId"),
            "power": pick("PP", "P", "PO", "PW", "MP", "power", "Power", "S", "score", "points"),
            "member_count": pick("MC", "NM", "MEM", "MCount", "memberCount", "membersCount", "C"),
            "raw": row,
        })
    snapshot = {
        "verified": True, "source": url, "server": server, "ranking_type": "server_alliance",
        "parameters": params, "fetched_at": datetime.now(timezone.utc).isoformat(),
        "count": len(normalized), "alliances": normalized, "debug_raw": payload,
    }
    DATA.mkdir(parents=True, exist_ok=True)
    tmp = output.with_suffix(".tmp")
    tmp.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\\n", encoding="utf-8")
    tmp.replace(output)
    print(f"hgh: saved {len(normalized)} raw alliance ranking rows to data/alliance-ranking.json")

def fetch(aid, filename, fallback_name, server, base):
    url = f'{base}/{server}/ain/%22AID%22:{aid}'
    req = urllib.request.Request(url, headers={"Accept":"application/json","User-Agent":"GGEmpire-ReadOnly-Tracker/1.0"})
    with urllib.request.urlopen(req, timeout=25) as response:
        payload = json.loads(response.read().decode("utf-8"))
    alliance = payload.get("content", {}).get("A")
    if str(payload.get("return_code")) != "0" or not isinstance(alliance, dict):
        raise RuntimeError(f"AID {aid}: API did not return an alliance")
    raw = alliance.get("M", alliance.get("members"))
    if not isinstance(raw, list) or not raw:
        raise RuntimeError(f"AID {aid}: no member list")
    players = []
    for member in raw:
        if not isinstance(member, dict): continue
        oid = member.get("OID", member.get("oid", member.get("id", member.get("ID"))))
        name = member.get("N", member.get("name", member.get("NAME")))
        if oid is None or name is None: continue
        players.append({"oid":str(oid),"name":str(name),
          "honor":member.get("H",member.get("honor",member.get("HONOR"))),
          "might":member.get("MP",member.get("PP",member.get("P",member.get("PO",member.get("PW",member.get("might",member.get("power"))))))),
          "loot_current":member.get("CF",member.get("loot_current",member.get("loot")))})
    if not players: raise RuntimeError(f"AID {aid}: member schema was not recognized")
    players.sort(key=lambda p:(p["might"] is None, -(float(p["might"]) if str(p["might"]).replace(".","",1).isdigit() else 0)))
    output=DATA/filename
    old={}
    try:
        prev=json.loads(output.read_text(encoding="utf-8"))
        old=prev.get("players_by_oid") or {str(p["oid"]):p for p in prev.get("players",[])}
    except (OSError,json.JSONDecodeError): pass
    prev_players={str(k):{field:v.get(field) for field in ("name","honor","might","loot_current")} for k,v in old.items()}
    might_values=[float(p["might"]) for p in players if p["might"] is not None and str(p["might"]).replace(".","",1).isdigit()]
    total_might=round(sum(might_values)) if might_values else None
    snapshot={"verified":True,"source":base,"server":server,"aid":aid,
      "alliance_name":alliance.get("N",alliance.get("name",fallback_name)),
      "fetched_at":datetime.now(timezone.utc).isoformat(),"player_count":len(players),
      "total_might":total_might,"prev_players":prev_players,
      "players_by_oid":{p["oid"]:p for p in players},"players":players}
    DATA.mkdir(parents=True,exist_ok=True)
    tmp=output.with_suffix(".tmp"); tmp.write_text(json.dumps(snapshot,ensure_ascii=False,indent=2)+"\n",encoding="utf-8"); tmp.replace(output)
    print(f"AID {aid}: saved {len(players)} players to {filename}; total_might={total_might if total_might is not None else chr(110)+chr(47)+chr(97)}")
    return True

def main():
    if os.getenv("E4K_PL1_MAPPING_VERIFIED","").lower()!="true":
        print("Skipped: source mapping is not enabled."); return 0
    server=os.getenv("E4K_SERVER","EmpirefourkingdomsExGG2_3")
    base=os.getenv("E4K_API_BASE","https://empire-api.fly.dev").rstrip("/")
    failures=[]
    for aid,filename,name in ALLIANCES:
        try: fetch(aid,filename,name,server,base)
        except Exception as e: failures.append(str(e)); print(f"Collector warning: {e}",file=sys.stderr)
    if len(failures)==len(ALLIANCES): raise RuntimeError("Both alliance snapshots failed: "+"; ".join(failures))
    return 0

if __name__=="__main__":
    try: raise SystemExit(main())
    except Exception as error:
        print(f"Collector failed safely: {error}",file=sys.stderr); raise SystemExit(1)
