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
});
