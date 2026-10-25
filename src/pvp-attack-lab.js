/* GGEmpire PvP Attack Lab
 * Original local comparison tool. Estimates are transparent heuristics, not the game's server combat engine.
 */
(() => {
  const $ = (id) => document.getElementById(id);
  const val = (id) => Math.max(0, Number($(id)?.value) || 0);
  const pct = (id) => val(id) / 100;
  const fmt = (n) => Math.round(n).toLocaleString("pl-PL");
  const read = () => ({
    target: $("pvp-target")?.value || "player",
    waves: Math.max(1,val("pvp-attack-waves")), frontSlots: val("pvp-front-slots"), leftSlots: val("pvp-left-slots"), rightSlots: val("pvp-right-slots"), totalTroops: val("pvp-attack-total"), wdShare: Math.min(100,val("pvp-attack-wd-share"))/100,
    defTotal: val("pvp-def-total"), defWdShare: Math.min(100,val("pvp-def-wd-share"))/100, defSlots: val("pvp-def-slots"),
    priority: $("pvp-priority")?.value || "loot",
    melee: val("pvp-melee"), ranged: val("pvp-ranged"),
    meleePower: val("pvp-melee-power"), rangedPower: val("pvp-ranged-power"),
    meleeBonus: pct("pvp-melee-bonus"), rangedBonus: pct("pvp-ranged-bonus"),
    commander: pct("pvp-commander"), waveBonus: val("pvp-wave-bonus"),
    wallReduction: Math.min(1,pct("pvp-wall-reduction")),
    gateReduction: Math.min(1,pct("pvp-gate-reduction")),
    moatReduction: Math.min(1,pct("pvp-moat-reduction")),
    rangedReduction: Math.min(1,pct("pvp-ranged-reduction")),
    lootBonus: pct("pvp-loot-bonus"), lootCapacity: pct("pvp-loot-capacity"),
    gloryBonus: pct("pvp-glory-bonus"), honorBonus: pct("pvp-honor-bonus"),
    wall: val("pvp-wall"), gate: val("pvp-gate"), moat: val("pvp-moat"),
    defenderMelee: val("pvp-def-melee"), defenderRanged: val("pvp-def-ranged"),
    troops: val("pvp-troops"), tools: val("pvp-tools")
  });
  function calculate() {
    const d = read();
    const frontCapacity = d.waves * d.frontSlots;
    const leftCapacity = d.waves * d.leftSlots;
    const rightCapacity = d.waves * d.rightSlots;
    const capacity = frontCapacity + leftCapacity + rightCapacity;
    const troopsUsed = Math.min(d.totalTroops, capacity);
    d.ranged = Math.round(troopsUsed * d.wdShare);
    d.melee = troopsUsed - d.ranged;
    d.defRanged = Math.round(d.defTotal * d.defWdShare);
    d.defenderMelee = d.defTotal - d.defRanged;
    $("pvp-melee").value = d.melee;
    $("pvp-ranged").value = d.ranged;
    $("pvp-def-melee").value = d.defenderMelee;
    $("pvp-def-ranged").value = d.defRanged;
    const melee = d.melee * d.meleePower * (1+d.meleeBonus+d.commander);
    const ranged = d.ranged * d.rangedPower * (1+d.rangedBonus+d.commander);
    const attack = melee + ranged;
    const defMelee = d.defenderMelee * 100;
    const defRanged = d.defRanged * 100 * (1-d.rangedReduction);
    const fort = d.wall*(1-d.wallReduction) + d.gate*(1-d.gateReduction) + d.moat*(1-d.moatReduction);
    const defense = (defMelee+defRanged)*(1+fort/100);
    const ratio = attack+defense ? attack/(attack+defense)*100 : 0;
    const troopCount = d.melee+d.ranged;
    const lootFactor = 1+d.lootBonus;
    const capacityFactor = 1+d.lootCapacity;
    const rewardFactor = d.priority==="glory" ? 1+d.gloryBonus : d.priority==="honor" ? 1+d.honorBonus : lootFactor;
    $("pvp-attack-value").textContent = fmt(attack);
    $("pvp-defense-value").textContent = fmt(defense);
    $("pvp-attack-share").textContent = ratio.toLocaleString("pl-PL",{maximumFractionDigits:1})+"%";
    $("pvp-attack-bar").style.width = ratio+"%";
    $("pvp-defense-bar").style.width = (100-ratio)+"%";
    $("pvp-army-total").textContent = fmt(troopCount)+" (WW "+fmt(d.melee)+" / WD "+fmt(d.ranged)+")";
    $("pvp-wave-capacity").textContent = fmt(capacity)+" · użyto "+fmt(troopsUsed);
    $("pvp-zone-capacity").textContent = "Front "+fmt(frontCapacity)+" / L "+fmt(leftCapacity)+" / P "+fmt(rightCapacity);
    $("pvp-def-total-result").textContent = fmt(d.defTotal)+" (WW "+fmt(d.defenderMelee)+" / WD "+fmt(d.defRanged)+")";
    $("pvp-tools-total").textContent = fmt(d.tools);
    $("pvp-loot-index").textContent = "×"+lootFactor.toLocaleString("pl-PL",{maximumFractionDigits:2});
    $("pvp-capacity-index").textContent = "×"+capacityFactor.toLocaleString("pl-PL",{maximumFractionDigits:2});
    $("pvp-reward-index").textContent = "×"+rewardFactor.toLocaleString("pl-PL",{maximumFractionDigits:2});
    const notes = [];
    if (d.wallReduction < .5 && d.wall>0) notes.push("Sprawdź, czy redukcja muru nie jest zbyt mała.");
    if (d.gate>0 && d.gateReduction===0) notes.push("Brak wpisanej redukcji bramy.");
    if (d.moat>0 && d.moatReduction===0) notes.push("Brak wpisanej redukcji fosy.");
    if (!troopCount) notes.push("Dodaj wojsko atakujące.");
    if (d.priority==="loot" && d.lootBonus===0 && d.lootCapacity===0) notes.push("Nie wpisano premii do łupu ani pojemności łupu.");
    $("pvp-advice").textContent = notes.length ? notes.join(" ") : "Parametry wpisane. Porównaj warianty, zmieniając jedną premię naraz.";
    $("pvp-model-note").textContent = "To jawny model porównawczy: używa wartości wpisanych przez użytkownika, nie odtwarza pełnych zasad rozstrzygania walki, strat, łupu ani nagród przez serwer E4K. Wartości obrony i umocnień są umowne — wpisuj je tylko wtedy, gdy masz odpowiadające im dane z raportu lub symulatora.";
  }
  document.addEventListener("DOMContentLoaded", () => {
    const form = $("pvp-attack-form");
    ["pvp-attack-waves","pvp-front-slots","pvp-left-slots","pvp-right-slots","pvp-attack-total","pvp-attack-wd-share","pvp-def-total","pvp-def-wd-share"].forEach(id => $(id)?.addEventListener("input", calculate));
    form?.addEventListener("input", calculate);
    form?.addEventListener("change", calculate);
    form?.addEventListener("submit", e => { e.preventDefault(); calculate(); });
    $("pvp-load-screenshots")?.addEventListener("click", () => {
      const preset = {
        "pvp-melee-bonus":461, "pvp-ranged-bonus":408, "pvp-commander":40,
        "pvp-wall-reduction":100, "pvp-gate-reduction":100, "pvp-moat-reduction":100,
        "pvp-loot-bonus":60, "pvp-loot-capacity":55, "pvp-glory-bonus":65, "pvp-honor-bonus":55,
        "pvp-wall":50, "pvp-gate":25, "pvp-moat":25,
        "pvp-melee":500, "pvp-ranged":500, "pvp-def-melee":0, "pvp-def-ranged":0,
        "pvp-attack-waves":17, "pvp-front-slots":1026, "pvp-left-slots":329, "pvp-right-slots":329, "pvp-attack-total":28628, "pvp-attack-wd-share":50,
        "pvp-def-total":0, "pvp-def-wd-share":50, "pvp-def-slots":0, "pvp-tools":50
      };
      Object.entries(preset).forEach(([id, value]) => { if ($(id)) $(id).value = value; });
      $("pvp-advice").textContent = "Wczytano odczyt dowódcy Pikabello #35. Zwiad pokazuje brak obrońców w jednym z ekranów, dlatego ustawiono 0 obrońców — potwierdź, że to właściwy cel i świeży raport. 50 narzędzi to przykład z fal, nie automatycznie poprawny zestaw.";
      calculate();
    });
    $("pvp-reset")?.addEventListener("click", () => { form?.reset(); calculate(); });
    calculate();
  });
})();
