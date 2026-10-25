/* GGEmpire battle lab.
 * The estimator below is deliberately labelled as a simplified comparison model.
 * It is NOT a claim to reproduce Goodgame Empire's proprietary combat engine.
 */
(() => {
  const $ = (id) => document.getElementById(id);
  const number = (id) => Math.max(0, Number($(id)?.value) || 0);
  const fmt = (n) => Math.round(n).toLocaleString("pl-PL");
  function calculate() {
    const atkCount = number("battle-atk-count");
    const atkPower = number("battle-atk-power");
    const atkBonus = number("battle-atk-bonus") / 100;
    const defCount = number("battle-def-count");
    const defPower = number("battle-def-power");
    const defBonus = number("battle-def-bonus") / 100;
    const wall = number("battle-wall") / 100;
    const tools = number("battle-tools") / 100;
    const attack = atkCount * atkPower * (1 + atkBonus);
    const defense = defCount * defPower * (1 + defBonus) * (1 + wall) * (1 + tools);
    const total = attack + defense;
    const ratio = total ? attack / total * 100 : 0;
    $("battle-atk-result").textContent = fmt(attack);
    $("battle-def-result").textContent = fmt(defense);
    $("battle-ratio").textContent = ratio.toLocaleString("pl-PL", {maximumFractionDigits:1}) + "%";
    $("battle-meter-atk").style.width = ratio + "%";
    $("battle-meter-def").style.width = (100-ratio) + "%";
    $("battle-verdict").textContent = attack === defense ? "Nominalny potencjał jest równy." : attack > defense ? "Atak ma większy potencjał nominalny w tym uproszczonym modelu." : "Obrona ma większy potencjał nominalny w tym uproszczonym modelu.";
    $("battle-disclaimer").textContent = "To porównanie arytmetyczne, nie prognoza wyniku bitwy. Wzory i premie nie zostały jeszcze zweryfikowane z kodem lub wiarygodnym zestawem testów GeneralsForum/E4K.";
  }
  document.addEventListener("DOMContentLoaded", () => {
    $("battle-calc-form")?.addEventListener("input", calculate);
    $("battle-calc-form")?.addEventListener("submit", (e) => { e.preventDefault(); calculate(); });
    $("battle-reset")?.addEventListener("click", () => {
      $("battle-calc-form")?.reset();
      calculate();
    });
    calculate();
  });
})();
