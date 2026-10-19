#!/usr/bin/env python3
"""Read-only collector for the two configured E4K alliance snapshots."""
import json, os, sys, urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
ALLIANCES = [(115, "reborn-latest.json", "ReBoRN"), (41343, "alliance-41343.json", "MADDEVILS")]

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
          "might":member.get("PP",member.get("P",member.get("PO",member.get("PW",member.get("might",member.get("power")))))),
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
