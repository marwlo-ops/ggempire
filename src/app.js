// GGEmpire PL1 portal. Live stats are shown only when the public API returns them.
const API_BASE = "https://api.gge-tracker.com/api/v1";
const SERVER_CODE = "PL1";
const $ = (selector) => document.querySelector(selector);
const fmt = (value) => Number.isFinite(Number(value)) ? new Intl.NumberFormat("pl-PL", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value)) : "—";

async function apiGet(path, { server = false } = {}) {
  const headers = { Accept: "application/json" };
  if (server) headers["gge-server"] = SERVER_CODE;
  const response = await fetch(API_BASE + path, { headers, signal: AbortSignal.timeout(9000) });
  if (!response.ok) {
    const error = new Error("API HTTP " + response.status);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

function setStatus(message, ok = false) {
  const node = $("#api-status");
  if (node) node.textContent = message;
  const dot = document.querySelector(".hero-meta .live-dot");
  if (dot) dot.style.background = ok ? "var(--green)" : "var(--gold)";
  const short = $("#api-stat-short");
  if (short) short.textContent = ok ? "API połączone" : "API / sprawdzanie";
  const updated = $("#api-updated");
  if (updated) updated.textContent = ok ? "Odpowiedź odebrana" : "Brak potwierdzonych danych";
}

function renderAllianceData(key, alliance) {
  const container = document.getElementById(key + "-data");
  const status = document.getElementById(key + "-status");
  if (!container) return;
  const might = alliance.might_current ?? alliance.might ?? alliance.total_might;
  const count = alliance.player_count ?? alliance.member_count ?? alliance.players?.length;
  const name = alliance.alliance_name ?? alliance.name ?? (key === "reborn" ? "Reborn" : "MadDevil");
  container.innerHTML = `
    <div class="data-line"><span>Nazwa z API</span><b>${escapeHtml(name)}</b></div>
    <div class="data-line"><span>Siła / potęga</span><b>${might == null ? "Brak w odpowiedzi" : fmt(might)}</b></div>
    <div class="data-line"><span>Liczba graczy</span><b>${count == null ? "Brak w odpowiedzi" : fmt(count)}</b></div>`;
  if (status) {
    status.innerHTML = '<i></i> Dane odebrane z API';
    status.style.color = "var(--green)";
    const dot = status.querySelector("i");
    if (dot) dot.style.background = "var(--green)";
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}

function renderMessage(target, message) {
  target.innerHTML = "";
  const box = document.createElement("div");
  box.className = "search-message";
  box.textContent = message;
  target.append(box);
}

async function loadServerAndAlliances() {
  setStatus("Sprawdzanie API serwera PL1…");
  try {
    const servers = await apiGet("/servers");
    if (!Array.isArray(servers) || !servers.includes(SERVER_CODE)) {
      setStatus("API działa, ale PL1 nie jest na liście obsługiwanych serwerów");
      $("#api-status").title = "Sprawdź aktualną listę serwerów w GGE Tracker.";
      ["reborn", "maddevil"].forEach((key) => {
        const status = document.getElementById(key + "-status");
        if (status) status.innerHTML = '<i></i> PL1 niepotwierdzony w API';
      });
      return;
    }
    setStatus("API dostępne · serwer PL1 potwierdzony", true);
    const lookups = [
      { key: "reborn", name: "Reborn" },
      { key: "maddevil", name: "MadDevil" }
    ];
    await Promise.all(lookups.map(async ({ key, name }) => {
      try {
        const data = await apiGet("/alliances/name/" + encodeURIComponent(name), { server: true });
        if (data && (data.found === false || data.code === "ALLIANCE_NOT_FOUND" || data.error)) throw new Error("Nie znaleziono sojuszu");
        renderAllianceData(key, data);
      } catch (error) {
        const status = document.getElementById(key + "-status");
        if (status) status.innerHTML = '<i></i> Nie znaleziono lub API niedostępne';
      }
    }));
  } catch (error) {
    setStatus("API chwilowo niedostępne — dane niepotwierdzone");
    $("#api-status").title = error.message || "Błąd połączenia z API";
    ["reborn", "maddevil"].forEach((key) => {
      const status = document.getElementById(key + "-status");
      if (status) status.innerHTML = '<i></i> Oczekiwanie na odpowiedź API';
    });
  }
}

async function searchAlliance(query) {
  const results = $("#search-results");
  renderMessage(results, "Szukam sojuszy „" + query + "” na serwerze PL1…");
  try {
    const data = await apiGet("/alliances/search?query=" + encodeURIComponent(query), { server: true });
    const suggestions = Array.isArray(data) ? data : (data.suggestions || data.results || []);
    if (!suggestions.length) {
      renderMessage(results, "API nie zwróciło pasujących sojuszy. Sprawdź pisownię albo dostępność PL1.");
      return;
    }
    results.innerHTML = "";
    suggestions.slice(0, 10).forEach((item) => {
      const row = document.createElement("div");
      row.className = "search-result";
      const left = document.createElement("div");
      const name = document.createElement("b");
      name.textContent = item.name || item.alliance_name || "Sojusz";
      const meta = document.createElement("small");
      const parts = [];
      if (item.player_count != null) parts.push("Gracze: " + fmt(item.player_count));
      if (item.might_current != null) parts.push("Potęga: " + fmt(item.might_current));
      meta.textContent = parts.join(" · ") || "Wynik wyszukiwania API";
      left.append(name, meta);
      const link = document.createElement("a");
      link.href = item.id ? "https://gge-tracker.com/alliance/" + encodeURIComponent(item.id) + "?utm_source=ggempire" : "https://gge-tracker.com/";
      link.target = "_blank";
      link.rel = "noreferrer";
      link.textContent = "Profil ↗";
      row.append(left, link);
      results.append(row);
    });
  } catch (error) {
    renderMessage(results, "Nie udało się wyszukać w API. Możliwa przyczyna: PL1 nie jest obsługiwany, limit zapytań albo blokada połączenia z przeglądarki. Sprawdź dokumentację API.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadServerAndAlliances();
  $("#alliance-search-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = $("#alliance-query").value.trim();
    if (query.length >= 2) searchAlliance(query);
  });
  document.querySelectorAll("[data-search-alliance]").forEach((button) => {
    button.addEventListener("click", () => {
      const name = button.getAttribute("data-search-alliance");
      $("#alliance-query").value = name;
      searchAlliance(name);
      $("#search-results").scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  });
  $("#menu-toggle")?.addEventListener("click", () => $(".main-nav")?.classList.toggle("open"));
  document.querySelectorAll(".main-nav a").forEach((link) => link.addEventListener("click", () => $(".main-nav")?.classList.remove("open")));
  initIntelligence();
});

const INTEL_STORAGE_KEY = "ggempire.pl1.intelligence.v1";
function getIntelReports() {
  try {
    const value = JSON.parse(localStorage.getItem(INTEL_STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}
function saveIntelReports(reports) {
  try { localStorage.setItem(INTEL_STORAGE_KEY, JSON.stringify(reports)); return true; }
  catch { alert("Nie udało się zapisać raportu. Sprawdź miejsce w pamięci przeglądarki."); return false; }
}
function intelAgeDays(dateString) {
  const date = new Date(dateString + "T12:00:00");
  if (Number.isNaN(date.getTime())) return Infinity;
  return Math.floor((new Date().setHours(12,0,0,0) - date.getTime()) / 86400000);
}
function initIntelligence() {
  const form = $("#intel-form");
  if (!form) return;
  const dateInput = $("#intel-date");
  if (dateInput && !dateInput.value) dateInput.value = new Date().toLocaleDateString("sv-SE");
  const filter = $("#intel-filter");
  const freshness = $("#intel-fresh-filter");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const fd = new FormData(form);
    const target = String(fd.get("target") || "").trim();
    if (!target) return;
    const reports = getIntelReports();
    reports.push({
      id: (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2),
      target, kind: String(fd.get("kind")), reportType: String(fd.get("reportType")),
      date: String(fd.get("date")), result: String(fd.get("result")),
      strength: String(fd.get("strength") || "").trim(), notes: String(fd.get("notes") || "").trim(),
      createdAt: new Date().toISOString()
    });
    if (saveIntelReports(reports)) {
      form.reset();
      if (dateInput) dateInput.value = new Date().toLocaleDateString("sv-SE");
      renderIntelReports();
      const list = $("#intel-list");
      if (list) list.scrollIntoView({behavior:"smooth", block:"nearest"});
    }
  });
  filter?.addEventListener("input", renderIntelReports);
  freshness?.addEventListener("change", renderIntelReports);
  $("#intel-list")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete-intel]");
    if (!button) return;
    const id = button.getAttribute("data-delete-intel");
    saveIntelReports(getIntelReports().filter((report) => report.id !== id));
    renderIntelReports();
  });
  renderIntelReports();
}
function renderIntelReports() {
  const list = $("#intel-list");
  if (!list) return;
  const reports = getIntelReports().sort((a,b) => String(b.date).localeCompare(String(a.date)) || String(b.createdAt).localeCompare(String(a.createdAt)));
  const query = ($("#intel-filter")?.value || "").trim().toLocaleLowerCase("pl-PL");
  const mode = $("#intel-fresh-filter")?.value || "all";
  const visible = reports.filter((report) => {
    const haystack = [report.target, report.kind, report.reportType, report.result, report.strength, report.notes].join(" ").toLocaleLowerCase("pl-PL");
    const age = intelAgeDays(report.date);
    return (!query || haystack.includes(query)) && (mode === "all" || (mode === "fresh" ? age >= 0 && age <= 7 : age > 7 || age < 0));
  });
  $("#intel-total").textContent = String(reports.length);
  $("#intel-fresh").textContent = String(reports.filter(r => intelAgeDays(r.date) >= 0 && intelAgeDays(r.date) <= 7).length);
  $("#intel-targets").textContent = String(new Set(reports.map(r => r.target.toLocaleLowerCase("pl-PL"))).size);
  if (!visible.length) {
    list.innerHTML = '<div class="intel-empty"><span>⌕</span><b>' + (reports.length ? "Brak pasujących raportów" : "Brak raportów") + '</b><p>' + (reports.length ? "Zmień filtr albo wyszukiwaną frazę." : "Dodaj pierwszy raport, a zobaczysz go tutaj.") + '</p></div>';
    return;
  }
  list.innerHTML = "";
  visible.forEach((report) => {
    const age = intelAgeDays(report.date);
    const stale = age > 7 || age < 0;
    const card = document.createElement("article");
    card.className = "intel-report" + (stale ? " is-stale" : "");
    const top = document.createElement("div"); top.className = "intel-report-top";
    const title = document.createElement("div");
    const target = document.createElement("h4"); target.textContent = report.target;
    const meta = document.createElement("p"); meta.textContent = report.kind + " · " + report.reportType;
    title.append(target,meta);
    const badge = document.createElement("span"); badge.className = "intel-age " + (stale ? "stale" : "fresh");
    badge.textContent = stale ? "Nieaktualny" : "Aktualny";
    top.append(title,badge);
    const details = document.createElement("div"); details.className = "intel-report-details";
    const date = document.createElement("span"); date.textContent = "◷ " + report.date;
    const result = document.createElement("span"); result.textContent = "Wynik: " + report.result;
    details.append(date,result);
    card.append(top,details);
    if (report.strength) { const strength = document.createElement("p"); strength.className = "intel-strength"; strength.textContent = "Siła: " + report.strength; card.append(strength); }
    if (report.notes) { const notes = document.createElement("p"); notes.className = "intel-notes"; notes.textContent = report.notes; card.append(notes); }
    const bottom = document.createElement("div"); bottom.className = "intel-report-bottom";
    const freshnessText = document.createElement("small"); freshnessText.textContent = age === 0 ? "Raport z dziś" : age < 0 ? "Data w przyszłości — sprawdź raport" : "Raport sprzed " + age + " dni";
    const del = document.createElement("button"); del.type = "button"; del.className = "intel-delete"; del.textContent = "Usuń"; del.setAttribute("data-delete-intel", report.id);
    bottom.append(freshnessText,del); card.append(bottom); list.append(card);
  });
}
