// GGEmpire portal for E4K PL1. Live alliance lookup uses the public empire-api endpoint.
const $ = (selector) => document.querySelector(selector);
const E4K_API_BASE = "https://empire-api.fly.dev";
const E4K_SERVER = "EmpirefourkingdomsExGG_2";
const ALLIANCES = [
  { key: "reborn", name: "ReBoRN", aid: 115 },
  { key: "maddevil", name: "MADDEVILS", aid: 41343 }
];
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}
function renderMessage(target, message) {
  if (!target) return;
  target.innerHTML = "";
  const box = document.createElement("div");
  box.className = "search-message";
  box.textContent = message;
  target.append(box);
}
function firstValue(object, keys) {
  for (const key of keys) {
    const value = object?.[key];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}
function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString("pl-PL") : null;
}
async function fetchAlliance(aid) {
  const url = `${E4K_API_BASE}/${E4K_SERVER}/ain/%22AID%22:${encodeURIComponent(aid)}`;
  const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!response.ok) throw new Error("API HTTP " + response.status);
  const data = await response.json();
  if (String(data.return_code) !== "0" || !data.content?.A) throw new Error(data.error || "API nie zwróciło danych sojuszu");
  return data.content.A;
}
function setAlliancePending(key, message) {
  const status = document.getElementById(key + "-status");
  if (status) status.innerHTML = '<i></i> ' + escapeHtml(message);
}
function renderAlliance(key, alliance, fallbackName) {
  const card = document.getElementById(key + "-data");
  const status = document.getElementById(key + "-status");
  const name = firstValue(alliance, ["N", "name", "NAME"]) || fallbackName;
  const members = Array.isArray(alliance.M) ? alliance.M : Array.isArray(alliance.members) ? alliance.members : [];
  const power = firstValue(alliance, ["P", "PO", "PW", "power", "Power", "STR", "S"]);
  const count = firstValue(alliance, ["MC", "MEM", "memberCount", "membersCount"]) ?? (members.length || null);
  if (card) {
    const rows = [
      ["Nazwa z API", String(name)],
      ["Siła / potęga", formatNumber(power) || "Brak pola w odpowiedzi API"],
      ["Liczba graczy", formatNumber(count) || "Brak pola w odpowiedzi API"]
    ];
    card.innerHTML = rows.map(([label, value]) => '<div class="data-line"><span>' + escapeHtml(label) + '</span><b>' + escapeHtml(value) + '</b></div>').join("");
  }
  if (status) status.innerHTML = '<i></i> Dane pobrane z API · ' + new Date().toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  return { name, members };
}
async function connectAllianceData() {
  const status = $("#api-status");
  if (status) status.textContent = "Łączenie z publicznym API E4K…";
  const short = $("#api-stat-short");
  if (short) short.textContent = "E4K API";
  const updated = $("#api-updated");
  if (updated) updated.textContent = "Sprawdzanie…";
  const results = await Promise.allSettled(ALLIANCES.map(async (item) => ({ item, alliance: await fetchAlliance(item.aid) })));
  let connected = 0;
  results.forEach((result, index) => {
    const item = ALLIANCES[index];
    if (result.status === "fulfilled") {
      renderAlliance(item.key, result.value.alliance, item.name);
      connected++;
    } else {
      setAlliancePending(item.key, "API niedostępne lub AID niepotwierdzone");
      const card = document.getElementById(item.key + "-data");
      if (card) {
        const first = card.querySelector(".data-line b");
        if (first) first.textContent = "Brak odpowiedzi API";
      }
    }
  });
  if (status) status.textContent = connected ? "API E4K odpowiada · " + connected + "/2 sojuszy" : "Nie udało się pobrać danych E4K";
  if (short) short.textContent = connected ? "E4K API" : "API offline";
  if (updated) updated.textContent = connected ? new Date().toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }) : "Brak odczytu";
}
async function searchAlliance(query) {
  renderMessage($("#search-results"), "Sprawdzam nazwę w publicznym API E4K…");
  const normalized = query.toLocaleLowerCase("pl-PL");
  const known = ALLIANCES.find((item) => item.name.toLocaleLowerCase("pl-PL").includes(normalized) || normalized.includes(item.name.toLocaleLowerCase("pl-PL")));
  if (known) {
    try {
      const alliance = await fetchAlliance(known.aid);
      renderAlliance(known.key, alliance, known.name);
      renderMessage($("#search-results"), "Pobrano dane sojuszu " + (firstValue(alliance, ["N", "name", "NAME"]) || known.name) + " z API E4K. AID wymaga niezależnego potwierdzenia dla świata PL1.");
    } catch (error) {
      renderMessage($("#search-results"), "Nie udało się pobrać danych: " + error.message + ". Sprawdź ponownie później.");
    }
    return;
  }
  renderMessage($("#search-results"), "Publiczny interfejs API obsługuje wyszukiwanie po AID, ale nie potwierdziliśmy jeszcze metody wyszukiwania dowolnej nazwy sojuszu w E4K PL1. Nie pokazujemy wyników z innych światów jako PL1.");
}
document.addEventListener("DOMContentLoaded", () => {
  connectAllianceData();
  initPlayerProfile();
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
const PLAYER_PROFILE_KEY = "ggempire.e4k.player-profile.v1";
function initPlayerProfile() {
 const form=$("#player-profile-form"); if(!form)return;
 const nickname=$("#player-nickname"), personalId=$("#player-personal-id"), result=$("#player-profile-result"), status=$("#player-link-status");
 function render(){
  let p=null; try{p=JSON.parse(localStorage.getItem(PLAYER_PROFILE_KEY)||"null")}catch{}
  if(!p||!p.nickname){status.textContent="○ Profil niepowiązany";nickname.value="";personalId.value="";result.innerHTML='<span class="profile-result-icon">i</span><div><b>Synchronizacja jeszcze niedostępna</b><p>Nie wykryto oficjalnego logowania ani potwierdzenia własności konta. Możesz zapisać nazwę lokalnie; profil pozostaje niezweryfikowany.</p></div>';return}
  nickname.value=p.nickname;personalId.value=p.personalId||"";status.textContent="○ Profil lokalny · niezweryfikowany";
  result.innerHTML='<span class="profile-result-icon">!</span><div><b>'+escapeHtml(p.nickname)+' · profil zapisany lokalnie</b><p>To nie jest sesja logowania Goodgame i nie potwierdza własności konta. Automatyczne statystyki i historia nie są połączone bez obsługiwanej metody API.</p></div>';
 }
 form.addEventListener("submit",e=>{e.preventDefault();const n=nickname.value.trim();if(!n)return;try{localStorage.setItem(PLAYER_PROFILE_KEY,JSON.stringify({nickname:n,personalId:personalId.value.trim(),savedAt:new Date().toISOString(),verified:false}));render()}catch{alert("Nie udało się zapisać profilu w tej przeglądarce.")}});
 $("#player-profile-clear")?.addEventListener("click",()=>{try{localStorage.removeItem(PLAYER_PROFILE_KEY)}catch{}render()});render();
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
