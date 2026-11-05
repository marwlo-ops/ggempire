/* Barony tab: displays only records explicitly verified by the E4K PL1 scanner. */
(() => {
  const $ = (s) => document.querySelector(s);
  const realms = {
    ice: { label: "Lód", kind: "kingdom" },
    sand: { label: "Piaski", kind: "kingdom" },
    fire: { label: "Ogień", kind: "kingdom" },
    islands: { label: "Archipelag · wyspy", kind: "islands" }
  };
  let dataset = { verified: false, targets: [] };
  let activeRealm = "ice";
  const text = (selector, value) => { const node = $(selector); if (node) node.textContent = value; };
  const fmtDate = (value) => {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" });
  };
  const isAvailable = (target) => {
    if (target.status === "available") return true;
    if (target.cooldownUntil) return new Date(target.cooldownUntil).getTime() <= Date.now();
    return false;
  };
  function filteredTargets() {
    const query = ($("#barony-search")?.value || "").trim().toLocaleLowerCase("pl-PL");
    const status = $("#barony-status-filter")?.value || "all";
    const sort = $("#barony-sort")?.value || "available";
    const rows = (Array.isArray(dataset.targets) ? dataset.targets : []).filter((item) => {
      if (item.realm !== activeRealm || !Number.isFinite(Number(item.x)) || !Number.isFinite(Number(item.y))) return false;
      const haystack = [item.name, item.type, item.level, item.x + ":" + item.y, item.island].join(" ").toLocaleLowerCase("pl-PL");
      return (!query || haystack.includes(query)) && (status === "all" || (status === "available" ? isAvailable(item) : !isAvailable(item)));
    });
    rows.sort((a,b) => {
      if (sort === "level") return Number(b.level || 0) - Number(a.level || 0);
      if (sort === "coords") return Number(a.x) - Number(b.x) || Number(a.y) - Number(b.y);
      return Number(isAvailable(b)) - Number(isAvailable(a)) || Number(a.x) - Number(b.x);
    });
    return rows;
  }
  function renderMap(rows) {
    const host = $("#barony-map");
    if (!host) return;
    if (!rows.length) {
      host.innerHTML = '<div class="barony-empty">Brak zweryfikowanych współrzędnych dla wybranego obszaru. Po podłączeniu odczytu sektorów mapa wypełni się rzeczywistymi pozycjami.</div>';
      return;
    }
    const xs = rows.map(r => Number(r.x)), ys = rows.map(r => Number(r.y));
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const px = (x) => 32 + (maxX === minX ? 0.5 : (x-minX)/(maxX-minX))*536;
    const py = (y) => 28 + (maxY === minY ? 0.5 : (y-minY)/(maxY-minY))*286;
    const lines = [0,1,2,3,4].map(i => '<line class="barony-gridline" x1="32" y1="' + (28+i*71.5) + '" x2="568" y2="' + (28+i*71.5) + '"/><line class="barony-gridline" x1="' + (32+i*134) + '" y1="28" x2="' + (32+i*134) + '" y2="314"/>').join("");
    const dots = rows.map(r => '<circle class="barony-dot" cx="' + px(Number(r.x)) + '" cy="' + py(Number(r.y)) + '" r="4"><title>' + String(r.name || r.type || "NPC").replace(/[&<>"]/g,"") + ' · ' + r.x + ':' + r.y + '</title></circle>').join("");
    host.innerHTML = '<svg viewBox="0 0 600 340" role="img" aria-label="Mapa potwierdzonych celów NPC"><rect x="20" y="16" width="560" height="300" rx="8" fill="#10141d" stroke="#ffffff20"/>' + lines + dots + '<path class="barony-axis" d="M32 322H568M24 28V314"/><text x="300" y="338" fill="#d6c18e" font-size="10" text-anchor="middle">X · ' + minX + '–' + maxX + '</text><text x="10" y="170" fill="#d6c18e" font-size="10" transform="rotate(-90 10 170)" text-anchor="middle">Y · ' + minY + '–' + maxY + '</text></svg>';
  }
  function render() {
    const rows = filteredTargets();
    const realm = realms[activeRealm];
    text("#barony-realm-name", realm.label);
    text("#barony-count", String(rows.length));
    text("#barony-available", String(rows.filter(isAvailable).length));
    text("#barony-updated", fmtDate(dataset.updatedAt));
    text("#barony-list-caption", realm.label + " · wybrane cele");
    text("#barony-list-total", String(rows.length));
    const list = $("#barony-list");
    if (list) {
      list.replaceChildren();
      if (!rows.length) {
        const empty = document.createElement("div");
        empty.className = "barony-empty";
        empty.textContent = dataset.verified === true
          ? "Brak celów w bazie dla tego obszaru. To nie oznacza, że na mapie gry nie ma NPC."
          : "Brak zweryfikowanych rekordów. Automatyczne skanowanie E4K PL1 nie jest jeszcze podłączone.";
        list.append(empty);
      } else rows.forEach((item) => {
        const card = document.createElement("article"); card.className = "barony-target";
        const top = document.createElement("div"); top.className = "barony-target-top";
        const title = document.createElement("h4"); title.textContent = item.name || item.type || "Cel NPC";
        const status = document.createElement("span"); status.className = "barony-target-status " + (isAvailable(item) ? "available" : "cooldown");
        status.textContent = isAvailable(item) ? "Dostępny" : "Odnowienie";
        top.append(title,status);
        const details = document.createElement("p");
        const coords = document.createElement("span"); coords.className = "coords";
        coords.textContent = "X:" + Number(item.x) + " · Y:" + Number(item.y);
        const meta = document.createElement("span");
        const parts = [];
        if (item.level !== undefined && item.level !== null) parts.push("Poziom " + String(item.level));
        if (item.island) parts.push(String(item.island));
        parts.push(item.cooldownUntil && !isAvailable(item) ? "Dostępny: " + fmtDate(item.cooldownUntil) : "Gotowy do sprawdzenia w grze");
        meta.textContent = parts.join(" · ");
        details.append(coords, document.createElement("br"), meta);
        card.append(top,details); list.append(card);
      });
    }
    renderMap(rows);
    const state = $("#barony-state");
    if (state) state.textContent = dataset.verified === true ? "DANE POTWIERDZONE" : "ŹRÓDŁO DO WERYFIKACJI";
  }
  async function loadData() {
    const button = $("#barony-refresh");
    if (button) { button.disabled = true; button.textContent = "Pobieranie…"; }
    try {
      const response = await fetch("./data/npc-dungeons.json?ts=" + Date.now(), { cache: "no-store" });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const next = await response.json();
      dataset = next && Array.isArray(next.targets) ? next : { verified: false, targets: [] };
      if (dataset.verified !== true) text("#barony-source-note", "Brak potwierdzonego odczytu sektorów mapy E4K PL1. Widok i filtry są gotowe, ale nie wyświetlam fikcyjnych lokalizacji. Po potwierdzeniu pakietu skanera źródło JSON będzie aktualizowane automatycznie.");
      else text("#barony-source-note", "Źródło: zweryfikowany skaner E4K PL1 · ostatnia aktualizacja: " + fmtDate(dataset.updatedAt) + ". Dane prezentowane zgodnie z rekordami źródłowymi.");
    } catch (error) {
      dataset = { verified: false, targets: [] };
      text("#barony-source-note", "Nie udało się odczytać bazy NPC: " + error.message + ". Pozostałe zakładki działają niezależnie.");
    } finally {
      if (button) { button.disabled = false; button.textContent = "↻ Odśwież dane"; }
      render();
    }
  }
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("[data-baron-realm]").forEach((button) => button.addEventListener("click", () => {
      activeRealm = button.dataset.baronRealm;
      document.querySelectorAll("[data-baron-realm]").forEach((item) => item.classList.toggle("active", item === button));
      render();
    }));
    ["#barony-search", "#barony-status-filter", "#barony-sort"].forEach(selector => $(selector)?.addEventListener(selector === "#barony-search" ? "input" : "change", render));
    $("#barony-refresh")?.addEventListener("click", loadData);
    loadData();
    window.setInterval(() => { if (document.visibilityState === "visible") loadData(); }, 5 * 60 * 1000);
  });
})();
