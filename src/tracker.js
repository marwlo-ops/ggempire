/* ReBoRN snapshot panel: displays only data from the guarded server-side collector. */
(() => {
  const byId = (id) => document.getElementById(id);
  const fmt = (value) => {
    if (value === null || value === undefined || value === "" || !Number.isFinite(Number(value))) return "—";
    return Math.round(Number(value)).toLocaleString("pl-PL");
  };
  const delta = (current, previous) => {
    if (current === null || current === undefined || previous === null || previous === undefined) return null;
    const a = Number(current), b = Number(previous);
    return Number.isFinite(a) && Number.isFinite(b) ? a - b : null;
  };
  const cell = (row, value, className) => {
    const td = document.createElement("td");
    td.textContent = value;
    if (className) td.className = className;
    row.appendChild(td);
  };
  const deltaCell = (row, value) => {
    if (value === null || value === 0) return cell(row, "—", "numeric");
    cell(row, (value > 0 ? "+" : "") + fmt(value), "numeric " + (value > 0 ? "delta-positive" : "delta-negative"));
  };
  async function load() {
    if (!byId("tracker-state")) return;
    try {
      const response = await fetch("./data/reborn-latest.json?t=" + Date.now(), { cache: "no-store" });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const data = await response.json();
      if (!data.verified || !Array.isArray(data.players) || !data.players.length) {
        byId("tracker-state").textContent = "OCZEKUJE NA WERYFIKACJĘ";
        byId("tracker-count").textContent = "—";
        byId("tracker-might").textContent = "—";
        byId("tracker-updated").textContent = "Brak danych";
        const row = document.createElement("tr"), td = document.createElement("td");
        td.colSpan = 8; td.className = "tracker-empty";
        td.textContent = "Brak zweryfikowanych danych. Kolektor nie publikuje wyników, dopóki świat i AID nie zostaną potwierdzone.";
        row.appendChild(td); byId("tracker-players").replaceChildren(row);
        return;
      }
      byId("tracker-state").textContent = "SNAPSHOT Z API";
      byId("tracker-count").textContent = fmt(data.players.length);
      byId("tracker-might").textContent = fmt(data.total_might);
      byId("tracker-updated").textContent = data.fetched_at ? new Date(data.fetched_at).toLocaleString("pl-PL") : "—";
      const body = byId("tracker-players");
      body.replaceChildren();
      const previous = data.prev_players || {};
      data.players.forEach((player, index) => {
        const old = previous[String(player.oid)] || previous[player.oid] || null;
        const dh = old ? delta(player.honor, old.honor) : null;
        const dm = old ? delta(player.might, old.might) : null;
        const dl = old ? delta(player.loot_current, old.loot_current) : null;
        const row = document.createElement("tr");
        cell(row, String(index + 1));
        cell(row, player.name || "—");
        cell(row, [dh, dm, dl].some((v) => v !== null && v !== 0) ? "● Aktywny" : "—", "tracker-activity");
        deltaCell(row, dh); deltaCell(row, dm);
        cell(row, fmt(player.honor), "numeric");
        cell(row, fmt(player.might), "numeric");
        cell(row, fmt(player.loot_current), "numeric");
        body.appendChild(row);
      });
      byId("tracker-note").textContent = "Źródło: " + (data.source || "kolektor E4K") + " · AID " + (data.aid ?? "—") + " · strefa " + (data.server || "—") + ". Zmiany porównują dwa ostatnie udane odczyty.";
    } catch (error) {
      byId("tracker-state").textContent = "BRAK SNAPSHOTU";
      byId("tracker-note").textContent = "Nie udało się odczytać archiwum (" + error.message + ").";
    }
  }
  document.addEventListener("DOMContentLoaded", () => {
    load();
    window.setInterval(() => { if (document.visibilityState === "visible") load(); }, 5 * 60 * 1000);
  });
})();
