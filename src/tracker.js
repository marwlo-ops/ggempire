/* Switchable alliance tracker for ReBoRN (115) and MADDEVILS (41343). */
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
    const td = document.createElement("td"); td.textContent = value;
    if (className) td.className = className; row.appendChild(td);
  };
  const deltaCell = (row, value) => {
    if (value === null || value === 0) return cell(row, "—", "numeric");
    cell(row, (value > 0 ? "+" : "") + fmt(value), "numeric " + (value > 0 ? "delta-positive" : "delta-negative"));
  };
  const alliances = {
    "115": {name:"ReBoRN", file:"./data/reborn-latest.json"},
    "41343": {name:"MADDEVILS", file:"./data/alliance-41343.json"}
  };
  let selectedAid = localStorage.getItem("ggempire.tracker.aid") || "115";
  if (!alliances[selectedAid]) selectedAid = "115";
  async function load() {
    if (!byId("tracker-state")) return;
    const selected = alliances[selectedAid];
    byId("tracker-state").textContent = "POBIERANIE…";
    try {
      const response = await fetch(selected.file + "?t=" + Date.now(), {cache:"no-store"});
      if (!response.ok) throw new Error("HTTP " + response.status);
      const data = await response.json();
      if (!data.verified || !Array.isArray(data.players) || !data.players.length) throw new Error("Brak danych graczy w snapshotcie");
      byId("tracker-alliance-name").textContent = data.alliance_name || selected.name;
      byId("tracker-count").textContent = fmt(data.players.length);
      byId("tracker-might").textContent = data.total_might > 0 ? fmt(data.total_might) : "Brak danych";
      byId("tracker-updated").textContent = data.fetched_at ? new Date(data.fetched_at).toLocaleString("pl-PL") : "—";
      byId("tracker-state").textContent = "DANE API";
      const body = byId("tracker-players"); body.replaceChildren();
      const previous = data.prev_players || {};
      data.players.forEach((player,index) => {
        const old = previous[String(player.oid)] || previous[player.oid] || null;
        const row = document.createElement("tr");
        cell(row,String(index+1)); cell(row,player.name || "—");
        const dh=old?delta(player.honor,old.honor):null, dm=old?delta(player.might,old.might):null, dl=old?delta(player.loot_current,old.loot_current):null;
        cell(row,[dh,dm,dl].some(v=>v!==null&&v!==0)?"● Zmiana":"—","tracker-activity");
        deltaCell(row,dh); deltaCell(row,dm); cell(row,fmt(player.honor),"numeric"); cell(row,fmt(player.might),"numeric"); cell(row,fmt(player.loot_current),"numeric");
        body.appendChild(row);
      });
      byId("tracker-note").textContent = "Źródło: " + (data.source || "API E4K") + " · AID " + data.aid + " · aktualizacja " + (data.fetched_at ? new Date(data.fetched_at).toLocaleString("pl-PL") : "—") + ".";
    } catch (error) {
      byId("tracker-state").textContent = "BRAK SNAPSHOTU";
      byId("tracker-count").textContent = "—"; byId("tracker-might").textContent = "—"; byId("tracker-updated").textContent = "Brak danych";
      const row=document.createElement("tr"), td=document.createElement("td"); td.colSpan=8; td.className="tracker-empty";
      td.textContent = selected.name + ": brak zapisanego snapshotu. Automat pobiera dane co 15 minut; sprawdź ponownie po najbliższym odczycie.";
      row.appendChild(td); byId("tracker-players").replaceChildren(row);
      byId("tracker-note").textContent = "Nie udało się odczytać " + selected.file + " (" + error.message + ").";
    }
    document.querySelectorAll("[data-tracker-aid]").forEach(btn=>btn.classList.toggle("active",btn.dataset.trackerAid===selectedAid));
  }
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-tracker-aid]").forEach(btn=>btn.addEventListener("click",()=>{
      selectedAid=btn.dataset.trackerAid;
      try{localStorage.setItem("ggempire.tracker.aid",selectedAid)}catch{}
      load();
    }));
    load(); window.setInterval(()=>{if(document.visibilityState==="visible")load()},5*60*1000);
  });
})();