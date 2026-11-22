/**
 * ptf-lead.js — poptávkové formuláře Vzorného nájemce posílají leady do PTF CRM.
 *
 * Proč (audit 22. 11. 2026): hlavní formulář a popup byly widgety Ecomailu,
 * do CRM nic nedorazilo. Popupy na stránkách Problémový nájemník a Kalkulačka
 * skrytých nákladů neposílaly nikam.
 *
 * Kontrakt je stejný jako u problemovynajemnik.cz (js/leady.js):
 *  - POST https://ptf-production.up.railway.app/api/leads, hlavička X-Tenant-Slug
 *  - first_name, last_name, email, gdpr_consent jsou povinné
 *  - website (návnada) prázdné a _formElapsedMs >= 3000, jinak backend tiše zahodí
 *  - source je slug formuláře; neznámý slug backend uloží do metadata.form a podle
 *    něj určí typ případu (Pronajímatel) a makléře (tenants.settings.prirazeni_formularu)
 *  - tichý zahozený lead vrací id 'ok', skutečný má UUID
 *
 * Použití:
 *  1. Kontejner: <div data-vn-lead="budu_pronajimat_landing"></div>
 *     (nebo staré id f-18-… / f-24-… po widgetu Ecomailu, vyplní se samy)
 *  2. Existující <form data-vn-lead-form="problem_tenant_triage"> s poli name, email, phone, message
 *  3. <script src="/js/ptf-lead.js" defer></script>
 */
(function () {
  'use strict';

  var API = 'https://ptf-production.up.railway.app/api/leads';
  var TENANT = 'ptf-reality';
  var STARE_WIDGETY = {
    'f-18-eeb96ecd8eefc15f2198246e728510f1': 'budu_pronajimat_landing',
    'f-24-68ad80a8296783256b609ecdeff8aa3e': 'budu_pronajimat_landing',
  };

  function navstevnik() {
    var q = new URLSearchParams(window.location.search);
    var sirka = window.innerWidth || 0;
    return {
      utmSource: q.get('utm_source') || undefined,
      utmMedium: q.get('utm_medium') || undefined,
      utmCampaign: q.get('utm_campaign') || undefined,
      utmTerm: q.get('utm_term') || undefined,
      utmContent: q.get('utm_content') || undefined,
      landingUrl: window.location.href,
      referrer: document.referrer || undefined,
      deviceType: sirka < 768 ? 'mobile' : (sirka < 1024 ? 'tablet' : 'desktop'),
    };
  }

  function slugStranky() {
    var cesta = window.location.pathname.replace(/^\/+|\/+$/g, '').replace(/\.html$/, '');
    return (cesta || 'home').toLowerCase().replace(/[^a-z0-9/_-]/g, '').slice(0, 60);
  }

  /** Vrací { ulozeno, chyba }. ulozeno = lead je opravdu v databázi. */
  function odeslat(data) {
    var jmeno = (data.name || '').trim();
    if (!jmeno) return Promise.resolve({ ulozeno: false, chyba: 'Vyplňte prosím jméno.' });
    if (!data.gdpr) return Promise.resolve({ ulozeno: false, chyba: 'Potvrďte prosím souhlas se zpracováním údajů.' });
    var telefon = (data.phone || '').trim();
    var email = (data.email || '').trim() || (telefon ? telefon.replace(/\s/g, '') + '@bez-emailu.local' : '');
    if (!email) return Promise.resolve({ ulozeno: false, chyba: 'Vyplňte telefon nebo e-mail, ať se vám máme jak ozvat.' });
    var casti = jmeno.split(/\s+/);
    var telo = {
      first_name: casti[0] || '',
      last_name: casti.slice(1).join(' ') || casti[0] || '',
      email: email,
      phone: telefon || undefined,
      message: (data.message || '').trim() || undefined,
      source: data.source,
      gdpr_consent: true,
      marketing_consent: false,
      website: data.website || '',
      _formElapsedMs: data.elapsed,
      metadata: { form: data.source, stranka: slugStranky(), origin: 'vzornynajemce', web: 'vzornynajemce.cz' },
      visitor_data: navstevnik(),
    };
    return fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tenant-Slug': TENANT },
      body: JSON.stringify(telo),
    }).then(function (res) {
      if (!res.ok) {
        if (res.status === 429) return { ulozeno: false, chyba: 'Odesláno příliš mnoho požadavků. Zkuste to za chvíli, nebo zavolejte.' };
        return res.json().then(function (j) { return { ulozeno: false, chyba: j.error || 'Odeslání se nepodařilo.' }; }, function () { return { ulozeno: false, chyba: 'Odeslání se nepodařilo.' }; });
      }
      return res.json().then(function (v) {
        var ulozeno = !!v.id && v.id !== 'ok';
        if (ulozeno && typeof window.gtag === 'function') {
          try { window.gtag('event', 'generate_lead', { form: data.source }); } catch (e) { /* měření nesmí shodit formulář */ }
        }
        return { ulozeno: ulozeno, chyba: ulozeno ? '' : 'Odeslání se nepodařilo.' };
      });
    }).catch(function () { return { ulozeno: false, chyba: 'Spojení se nepodařilo navázat.' }; });
  }

  var TELEFON = '+420 603 834 921';

  function napojit(form, source) {
    if (form.dataset.vnNapojeno) return;
    form.dataset.vnNapojeno = '1';
    var nacteno = Date.now();
    if (!form.querySelector('input[name="website"]')) {
      var hp = document.createElement('input');
      hp.type = 'text'; hp.name = 'website'; hp.tabIndex = -1; hp.autocomplete = 'off';
      hp.setAttribute('aria-hidden', 'true');
      hp.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;opacity:0';
      form.appendChild(hp);
    }
    var stav = form.querySelector('[data-vn-stav]');
    if (!stav) {
      stav = document.createElement('p');
      stav.setAttribute('data-vn-stav', '');
      stav.setAttribute('role', 'status');
      stav.className = 'text-sm mt-2';
      form.appendChild(stav);
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var tl = form.querySelector('[type="submit"]');
      var puvodni = tl ? tl.innerHTML : '';
      if (tl) { tl.disabled = true; tl.innerHTML = 'Odesílám…'; }
      var f = new FormData(form);
      var gdpr = form.querySelector('input[name="gdpr"]');
      odeslat({
        source: source,
        name: f.get('name'), email: f.get('email'), phone: f.get('phone'), message: f.get('message'),
        gdpr: gdpr ? gdpr.checked : true,
        website: f.get('website'),
        elapsed: Date.now() - nacteno,
      }).then(function (r) {
        if (r.ulozeno) {
          form.innerHTML = '<div class="py-6 text-center"><p class="text-lg font-semibold text-gray-900">Děkujeme, poptávku máme.</p>'
            + '<p class="text-gray-600 mt-2">Ozveme se vám v pracovní dny do 24 hodin.</p></div>';
        } else {
          stav.className = 'text-sm mt-2 text-red-600';
          stav.textContent = r.chyba + ' Případně zavolejte ' + TELEFON + '.';
          if (tl) { tl.disabled = false; tl.innerHTML = puvodni; }
        }
      });
    });
  }

  var POLE = 'w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-900 text-sm focus:outline-none focus:border-[#0D28F2] focus:bg-white';

  function vykreslit(kontejner, source) {
    if (kontejner.dataset.vnVykresleno) return;
    kontejner.dataset.vnVykresleno = '1';
    var id = 'vn' + Math.random().toString(36).slice(2, 8);
    kontejner.innerHTML =
      '<form class="space-y-3" novalidate>'
      + '<div><label for="' + id + 'n" class="block text-sm font-semibold text-gray-700 mb-1">Jméno a příjmení</label>'
      + '<input id="' + id + 'n" name="name" type="text" autocomplete="name" required class="' + POLE + '"></div>'
      + '<div><label for="' + id + 't" class="block text-sm font-semibold text-gray-700 mb-1">Telefon</label>'
      + '<input id="' + id + 't" name="phone" type="tel" autocomplete="tel" class="' + POLE + '"></div>'
      + '<div><label for="' + id + 'e" class="block text-sm font-semibold text-gray-700 mb-1">E-mail</label>'
      + '<input id="' + id + 'e" name="email" type="email" autocomplete="email" class="' + POLE + '"></div>'
      + '<div><label for="' + id + 'm" class="block text-sm font-semibold text-gray-700 mb-1">Byt a co řešíte (nepovinné)</label>'
      + '<textarea id="' + id + 'm" name="message" rows="3" class="' + POLE + '" placeholder="Např. 2+kk Plzeň-Bory, chci pronajímat bez starostí"></textarea></div>'
      + '<label class="flex items-start gap-2 text-xs text-gray-500"><input name="gdpr" type="checkbox" required class="mt-0.5">'
      + '<span>Souhlasím se <a href="/gdpr" class="underline" target="_blank" rel="noopener">zpracováním osobních údajů</a> za účelem odpovědi na poptávku.</span></label>'
      + '<button type="submit" class="w-full bg-[#0D28F2] text-white font-bold rounded-full px-5 py-3 hover:bg-[#0D28F2]/90">Chci nabídku zdarma</button>'
      + '</form>';
    napojit(kontejner.querySelector('form'), source);
  }

  function projit(koren) {
    (koren || document).querySelectorAll('[data-vn-lead]').forEach(function (k) { vykreslit(k, k.getAttribute('data-vn-lead')); });
    Object.keys(STARE_WIDGETY).forEach(function (id) {
      var k = document.getElementById(id);
      if (k && !k.dataset.vnVykresleno) vykreslit(k, STARE_WIDGETY[id]);
    });
    (koren || document).querySelectorAll('form[data-vn-lead-form]').forEach(function (f) { napojit(f, f.getAttribute('data-vn-lead-form')); });
  }

  function start() {
    projit(document);
    // Popup se načítá až po startu (load-popup.js) a po zavření se kontejner vyměňuje.
    new MutationObserver(function () { projit(document); }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
