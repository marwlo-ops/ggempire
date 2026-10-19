#!/usr/bin/env python3
"""Read-only diagnostics for E4K PL1 API command schemas.

Prints response shape and a few redacted examples, never credentials or full
player records. Intended for manual GitHub Actions runs while validating API
endpoints before wiring new live data into the public site.
"""
import json
import os
import urllib.error
import urllib.request

BASE = os.getenv("E4K_API_BASE", "https://empire-api.fly.dev").rstrip("/")
SERVER = os.getenv("E4K_SERVER", "EmpirefourkingdomsExGG2_3")
COMMANDS = {
    "alliance": 'ain/%22AID%22:115',
    "player_ranking": 'llsp/%22LT%22:11,%22R%22:1',
    "alliance_ranking": 'llsw/%22LT%22:11,%22SI%22:1',
}

def summarize(value, depth=0):
    if depth >= 3:
        if isinstance(value, dict):
            return {"type": "object", "keys": list(value.keys())[:40]}
        if isinstance(value, list):
            return {"type": "array", "length": len(value), "sample_type": type(value[0]).__name__ if value else None}
        return type(value).__name__
    if isinstance(value, dict):
        return {str(k): summarize(v, depth + 1) for k, v in list(value.items())[:40]}
    if isinstance(value, list):
        return {"type": "array", "length": len(value), "samples": [summarize(v, depth + 1) for v in value[:2]]}
    if value is None or isinstance(value, (bool, int, float)):
        return value
    if isinstance(value, str):
        return value[:80] if len(value) < 120 else {"type": "string", "length": len(value)}
    return type(value).__name__

def main():
    failures = 0
    for label, command in COMMANDS.items():
        url = f"{BASE}/{SERVER}/{command}"
        print(f"\n[{label}] GET {url}")
        request = urllib.request.Request(url, headers={
            "Accept": "application/json",
            "User-Agent": "GGEmpire-ReadOnly-Diagnostics/1.0",
        })
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                payload = json.loads(response.read().decode("utf-8"))
                print("HTTP:", response.status)
            print("return_code:", payload.get("return_code"))
            if payload.get("error"):
                print("error:", str(payload["error"])[:200])
            print("schema:", json.dumps(summarize(payload.get("content", {})), ensure_ascii=False))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as error:
            failures += 1
            print("FAILED:", type(error).__name__, str(error)[:200])
    print(f"\nDiagnostics complete. Failed requests: {failures}/{len(COMMANDS)}")
    # A single unsupported ranking command should not block the diagnostic run;
    # the log is the evidence used to decide the next safe implementation.
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
