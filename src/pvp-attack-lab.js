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
    const melee = d.melee * d.meleePower * (1+d.meleeBonus+d.commander);
    const ranged = d.ranged * d.rangedPower * (1+d.rangedBonus+d.commander);
    const attack = melee + ranged;
    const defMelee = d.defenderMelee * 100;
    const defRanged = d.defenderRanged * 100 * (1-d.rangedReduction);
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
    $("pvp-army-total").textContent = fmt(troopCount);
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
    form?.addEventListener("input", calculate);
    form?.addEventListener("change", calculate);
    form?.addEventListener("submit", e => { e.preventDefault(); calculate(); });
    $("pvp-reset")?.addEventListener("click", () => { form?.reset(); calculate(); });
    calculate();
  });
})();
