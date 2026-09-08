// Jistý nájem kalkulátor — hero widget
// Vzorec: base_rent_per_m² × m² × koeficient_lokality × koeficient_dispozice × koeficient_jistoty
// Výstup: pásmo ±5 % (např. „15 400 – 17 000 Kč / měsíc")
// Uživatel NEVIDÍ vzorec ani %.

(function () {
  'use strict';

  // ==== DATA VRSTVA ====================================================
  // Base rent per m² podle prvních číslic PSČ (odhad tržního nájmu 2026)
  // Doladit podle reálných dat PTF reality — placeholder hodnoty.
  const BASE_PER_M2_BY_PSC_PREFIX = {
    // Praha (1xx xx)
    '10': 420, '11': 480, '12': 440, '13': 410, '14': 380,
    '15': 380, '16': 400, '17': 370, '18': 360, '19': 340,
    // Střední Čechy vč. Berouna (2xx xx)
    '25': 300, '26': 280, '27': 270, '28': 260,
    // Plzeňský kraj (3xx xx)
    '30': 320, '31': 300, '32': 300, '33': 280, '34': 260, '35': 260,
    // Karlovarský (36xx)
    '36': 240,
    // Default
    '_default': 300,
  };

  // Koeficient dispozice (relativní k „2+kk" jako base)
  const DISPOSITION_COEF = {
    '1+kk': 1.20,  // menší m², vyšší cena/m²
    '1+1': 1.15,
    '2+kk': 1.00,
    '2+1': 0.98,
    '3+kk': 0.92,
    '3+1': 0.90,
    '4+kk': 0.85,
    '4+1': 0.85,
    '5+kk': 0.80,
  };

  // „Jistý nájem" koeficient — tajíme před uživatelem
  const JISTY_COEF = 0.80;

  // ==== KALKULACE ====================================================
  function calculate({ psc, disposition, area }) {
    const areaNum = parseFloat(String(area).replace(',', '.').replace(/\s/g, ''));
    const pscClean = String(psc || '').replace(/\s/g, '');
    if (!/^\d{5}$/.test(pscClean) || !areaNum || areaNum < 15 || areaNum > 300) {
      return null;
    }
    if (!DISPOSITION_COEF[disposition]) return null;

    const prefix = pscClean.substring(0, 2);
    const basePerM2 = BASE_PER_M2_BY_PSC_PREFIX[prefix] || BASE_PER_M2_BY_PSC_PREFIX._default;
    const dispCoef = DISPOSITION_COEF[disposition];

    const marketRent = basePerM2 * areaNum * dispCoef;
    const jistyRent = marketRent * JISTY_COEF;

    // Pásmo ±5 %
    const low = Math.round(jistyRent * 0.95 / 100) * 100;
    const high = Math.round(jistyRent * 1.05 / 100) * 100;

    return {
      low,
      high,
      display: `${low.toLocaleString('cs-CZ')} – ${high.toLocaleString('cs-CZ')} Kč`,
    };
  }

  // ==== UI ============================================================
  document.addEventListener('DOMContentLoaded', () => {
    const widget = document.getElementById('jisty-najem-widget');
    if (!widget) return;

    const pscInput = widget.querySelector('[data-jn-psc]');
    const dispButtons = widget.querySelectorAll('[data-jn-disposition]');
    const areaInput = widget.querySelector('[data-jn-area]');
    const resultBox = widget.querySelector('[data-jn-result]');
    const resultText = widget.querySelector('[data-jn-result-text]');
    const submitBtn = widget.querySelector('[data-jn-submit]');
    const wizardStep2 = widget.querySelector('[data-jn-wizard]');
    const emailInput = widget.querySelector('[data-jn-email]');
    const phoneInput = widget.querySelector('[data-jn-phone]');
    const finalBtn = widget.querySelector('[data-jn-final]');
    const successBox = widget.querySelector('[data-jn-success]');

    let selectedDisposition = '2+kk';
    let currentResult = null;

    // Dispozice buttons
    dispButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        dispButtons.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedDisposition = btn.getAttribute('data-jn-disposition');
        recalc();
      });
    });

    function recalc() {
      const result = calculate({
        psc: pscInput.value,
        disposition: selectedDisposition,
        area: areaInput.value,
      });
      currentResult = result;
      if (result) {
        resultText.textContent = result.display;
        resultBox.classList.remove('opacity-40');
        submitBtn.disabled = false;
      } else {
        resultText.textContent = '— — — Kč';
        resultBox.classList.add('opacity-40');
        submitBtn.disabled = true;
      }
    }

    pscInput.addEventListener('input', recalc);
    areaInput.addEventListener('input', recalc);

    submitBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (!currentResult) return;
      wizardStep2.classList.remove('hidden');
      wizardStep2.scrollIntoView({ behavior: 'smooth', block: 'center' });
      emailInput.focus();
    });

    finalBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      const email = emailInput.value.trim();
      const phone = phoneInput.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        emailInput.focus();
        emailInput.classList.add('ring-2', 'ring-red-500');
        return;
      }
      if (phone.replace(/\D/g, '').length < 9) {
        phoneInput.focus();
        phoneInput.classList.add('ring-2', 'ring-red-500');
        return;
      }

      finalBtn.disabled = true;
      finalBtn.textContent = 'Odesíláme…';

      try {
        const res = await fetch('/api/jisty-najem-lead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            psc: pscInput.value,
            disposition: selectedDisposition,
            area: areaInput.value,
            calc_low: currentResult.low,
            calc_high: currentResult.high,
            email,
            phone,
          }),
        });
        // Bez ohledu na výsledek servrové části — pro uživatele success (interní logujeme)
        wizardStep2.classList.add('hidden');
        successBox.classList.remove('hidden');
        successBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (err) {
        console.error('Jistý nájem lead error:', err);
        wizardStep2.classList.add('hidden');
        successBox.classList.remove('hidden');
      }
    });

    // Initial calc
    recalc();
  });
})();
