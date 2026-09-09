// api/_pdf-report.js
//
// PDF generátor přes headless Chrome (Puppeteer + @sparticuz/chromium).
// Používá HTML template s Google Fonts (Inter, Playfair) → browser rendering
// = žádný problém s češtinou, kvalitní typografie, snadné úpravy layoutu.
//
// Vercel:  @sparticuz/chromium poskytuje binárku (~50 MB), musí se enable
//          v config maxDuration a memorySize (obojí v Vercel dashboard).
// Lokálně: puppeteer-core hledá Chrome — pokud není, fallback na system
//          (env PUPPETEER_EXECUTABLE_PATH) nebo throw.

import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CORAL = '#E63946';
const SLATE_900 = '#0f172a';
const SLATE_600 = '#475569';
const SLATE_400 = '#94a3b8';
const SLATE_200 = '#e2e8f0';
const IVORY = '#FBF7F2';

function escapeHtml(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtDate(d = new Date()) {
    return d.toLocaleString('cs-CZ', { timeZone: 'Europe/Prague', dateStyle: 'long', timeStyle: 'short' });
}

function refId(d = new Date()) {
    const p = new Intl.DateTimeFormat('cs-CZ', {
        timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }).formatToParts(d).reduce((a, v) => { a[v.type] = v.value; return a; }, {});
    return `VZN-${p.year}${p.month}${p.day}-${p.hour}${p.minute}`;
}

async function loadLogoDataUri() {
    try {
        const buf = await readFile(join(__dirname, '_assets', 'logo.png'));
        return `data:image/png;base64,${buf.toString('base64')}`;
    } catch (_) {
        return '';
    }
}

function renderHtml(input, logoDataUri) {
    const now = new Date();
    const c = input.candidate || {};
    const r = input.requester || {};
    const lustrace = Array.isArray(input.lustrace) ? input.lustrace : [];
    const typeLabel = { fyzicka: 'Fyzická osoba', osvc: 'OSVČ', firma: 'Právnická osoba' }[c.type] || c.type || '—';
    const profileLabels = { ISIR: 'Insolvenční rejstřík (ISIR)', CEE: 'Centrální evidence exekucí (CEE)', Zakladni: 'ARES · základní rejstřík', ExeSR: 'Evidence exekucí SR', Devel: 'ISPIS · Devel (test)' };

    function kv(label, value) {
        if (!value) return '';
        return `<div class="kv"><span class="kv-label">${escapeHtml(label)}</span><span class="kv-val">${escapeHtml(value)}</span></div>`;
    }

    function lustraceRow(l) {
        const profile = profileLabels[l.profile] || l.profile || '—';
        const hasRecord = l.ok && l.data && (
            (Array.isArray(l.data.results) && l.data.results.length > 0) ||
            (Array.isArray(l.data.records) && l.data.records.length > 0) ||
            (l.data.detail && (l.data.detail.recordCount > 0 || l.data.detail.count > 0))
        );
        let status = 'bez záznamu';
        let statusClass = 'ok';
        if (!l.ok) { status = l.blocked ? `nedostupné (${l.blocked})` : 'chyba'; statusClass = 'na'; }
        else if (hasRecord) { status = 'ZÁZNAM NALEZEN — zkontrolovat'; statusClass = 'bad'; }
        const meta = l.data && l.data.batchId ? `<div class="meta">ref: ${escapeHtml(l.data.batchId)}</div>` : '';
        return `
        <div class="lustrace-row">
          <div class="dot ${statusClass}"></div>
          <div class="lustrace-content">
            <div class="lustrace-title">${escapeHtml(profile)}</div>
            ${meta}
          </div>
          <div class="lustrace-status ${statusClass}">${escapeHtml(status)}</div>
        </div>`;
    }

    // Score block (voliteln)
    let scoreBlock = '';
    if (input.score && typeof input.score.total === 'number') {
        const total = Math.max(0, Math.min(100, Math.round(input.score.total)));
        const verdict = total >= 80 ? 'DOPORUČUJEME' : total >= 60 ? 'PŘIJATELNÉ RIZIKO' : total >= 40 ? 'ZVÝŠENÉ RIZIKO' : 'VYSOKÉ RIZIKO';
        const verdictColor = total >= 60 ? '#10b981' : total >= 40 ? '#eab308' : CORAL;
        const factors = Array.isArray(input.score.factors)
            ? input.score.factors.slice(0, 8).map(f => `<li>${escapeHtml(f)}</li>`).join('')
            : '';
        scoreBlock = `
        <div class="section-header">Celkové vyhodnocení</div>
        <div class="score-wrap">
          <div class="score-badge" style="color:${verdictColor}">
            <div class="score-num">${total}</div>
            <div class="score-unit">skóre / 100</div>
          </div>
          <div class="score-text">
            <div class="score-verdict" style="color:${verdictColor}">${escapeHtml(verdict)}</div>
            <div class="score-summary">${escapeHtml(input.score.summary || 'Doporučení najdete v manuálním e-mailu z PTF reality.')}</div>
            ${factors ? `<ul class="score-factors">${factors}</ul>` : ''}
          </div>
        </div>`;
    }

    return `<!DOCTYPE html>
<html lang="cs"><head>
<meta charset="UTF-8">
<title>Prověření zájemce o nájem — Vzorný nájemce</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@1,500&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: A4; margin: 18mm 16mm 20mm 16mm; }
  body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; color: ${SLATE_900}; line-height: 1.4; font-size: 10.5pt; }

  .header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 16px; border-bottom: 1px solid ${SLATE_200}; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand-logo { width: 42px; height: 42px; border-radius: 50%; object-fit: cover; background: ${IVORY}; }
  .brand-name { font-size: 15pt; font-weight: 700; color: ${SLATE_900}; }
  .brand-sub { font-size: 8.5pt; color: ${SLATE_400}; text-transform: uppercase; letter-spacing: 0.14em; margin-top: 2px; }
  .ref { font-size: 8pt; font-weight: 600; color: ${CORAL}; background: ${IVORY}; padding: 6px 12px; border-radius: 999px; }

  h1 { font-size: 22pt; font-weight: 700; margin: 20px 0 6px; }
  .subhead-serif { font-family: 'Playfair Display', Georgia, serif; font-style: italic; font-weight: 500; color: ${CORAL}; font-size: 15pt; }
  .datetime { color: ${SLATE_600}; font-size: 10pt; margin-top: 6px; }

  .section-header { margin-top: 22px; padding-bottom: 6px; border-bottom: 1px solid ${SLATE_200}; font-size: 8.5pt; letter-spacing: 0.16em; text-transform: uppercase; font-weight: 700; color: ${CORAL}; }
  .kv-grid { margin-top: 10px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
  .kv { display: flex; flex-direction: column; }
  .kv-label { font-size: 8pt; color: ${SLATE_400}; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 500; margin-bottom: 2px; }
  .kv-val { font-size: 10.5pt; color: ${SLATE_900}; font-weight: 500; }

  .lustrace-list { margin-top: 12px; }
  .lustrace-row { display: flex; align-items: flex-start; padding: 10px 0; border-bottom: 1px solid ${SLATE_200}; }
  .lustrace-row:last-child { border-bottom: 0; }
  .dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 6px; margin-right: 12px; flex: 0 0 auto; }
  .dot.ok { background: #10b981; }
  .dot.bad { background: ${CORAL}; }
  .dot.na { background: ${SLATE_400}; }
  .lustrace-content { flex: 1; }
  .lustrace-title { font-weight: 600; font-size: 11pt; color: ${SLATE_900}; }
  .meta { color: ${SLATE_400}; font-size: 8pt; margin-top: 2px; font-family: 'SFMono-Regular', Consolas, monospace; }
  .lustrace-status { font-size: 10pt; font-weight: 600; margin-left: 12px; white-space: nowrap; }
  .lustrace-status.ok { color: #10b981; }
  .lustrace-status.bad { color: ${CORAL}; }
  .lustrace-status.na { color: ${SLATE_400}; }

  .score-wrap { display: flex; align-items: flex-start; gap: 20px; margin-top: 14px; }
  .score-badge { background: ${IVORY}; padding: 14px 22px; border-radius: 14px; text-align: center; flex: 0 0 auto; }
  .score-num { font-size: 32pt; font-weight: 700; line-height: 1; }
  .score-unit { font-size: 8pt; color: ${SLATE_600}; margin-top: 4px; letter-spacing: 0.05em; }
  .score-text { flex: 1; padding-top: 4px; }
  .score-verdict { font-size: 13pt; font-weight: 700; margin-bottom: 6px; }
  .score-summary { color: ${SLATE_600}; font-size: 10pt; margin-bottom: 8px; }
  .score-factors { color: ${SLATE_600}; font-size: 9.5pt; margin-left: 18px; }
  .score-factors li { margin-bottom: 2px; }

  .legal { margin-top: 26px; padding: 12px 14px; border-radius: 10px; background: ${IVORY}; color: ${SLATE_600}; font-size: 8.5pt; line-height: 1.55; }

  .footer { position: fixed; bottom: 12mm; left: 16mm; right: 16mm; padding-top: 10px; border-top: 1px solid ${SLATE_200}; font-size: 7.5pt; color: ${SLATE_600}; }
  .footer strong { color: ${SLATE_900}; }
  .footer-brand { color: ${CORAL}; }
</style>
</head><body>

<div class="header">
  <div class="brand">
    ${logoDataUri ? `<img src="${logoDataUri}" alt="" class="brand-logo">` : ''}
    <div>
      <div class="brand-name">Vzorný nájemce</div>
      <div class="brand-sub">Skupina PTF reality &middot; od 1999</div>
    </div>
  </div>
  <div class="ref">${escapeHtml(refId(now))}</div>
</div>

<h1>Prověření zájemce o nájem</h1>
<div class="subhead-serif">Report z veřejných rejstříků České republiky</div>
<div class="datetime">Vypracováno: ${escapeHtml(fmtDate(now))}</div>

<div class="section-header">Zájemce</div>
<div class="kv-grid">
  ${kv('Typ', typeLabel)}
  ${kv(c.type === 'fyzicka' ? 'Jméno' : 'Název', c.name)}
  ${kv('Datum narození', c.dob)}
  ${kv('IČO', c.ic)}
  ${kv('Adresa', c.address)}
</div>

<div class="section-header">Žadatel (majitel bytu)</div>
<div class="kv-grid">
  ${kv('Jméno', r.name)}
  ${kv('E-mail', r.email)}
  ${kv('Telefon', r.phone)}
  ${kv('Lokace bytu', r.propertyLocation)}
</div>

<div class="section-header">Výsledky lustrace ve veřejných rejstřících</div>
<div class="lustrace-list">
  ${lustrace.length ? lustrace.map(lustraceRow).join('') : '<div class="meta" style="padding:12px 0">Lustrace bude doplněna manuálně a přeposlána do 60 minut v pracovní době.</div>'}
</div>

${scoreBlock}

<div class="legal">
  <strong>Právní upozornění a GDPR.</strong>
  Tento report vychází z veřejně dostupných dat oficiálních rejstříků České republiky (ISIR, CEE, ARES, Justice.cz).
  Výsledky jsou platné k datu vypracování a mají orientační charakter — před uzavřením nájemní smlouvy doporučujeme
  individuální posouzení. Osobní údaje zájemce i žadatele uchováváme po dobu 30 dní v souladu s GDPR a poté trvale mažeme.
</div>

<div class="footer">
  <strong>PTF reality, s.r.o.</strong> &middot; IČO 06684394 &middot; Radyňská 33, Plzeň &middot; Pod Turnovskou tratí 18, Praha<br>
  <span class="footer-brand">kontakt@vzornynajemce.cz &middot; +420 603 834 921 &middot; www.vzornynajemce.cz</span>
</div>

</body></html>`;
}

/**
 * @returns {Promise<Buffer>}
 */
export async function generateReport(input) {
    const logoDataUri = await loadLogoDataUri();
    const html = renderHtml(input, logoDataUri);

    // Cesta ke Chromium binárce
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH
        || await chromium.executablePath().catch(() => null);

    if (!executablePath) throw new Error('Chromium binary not available (nastavte PUPPETEER_EXECUTABLE_PATH nebo použijte @sparticuz/chromium na Vercel).');

    const browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: { width: 794, height: 1123, deviceScaleFactor: 2 }, // A4 @96 DPI
        executablePath,
        headless: chromium.headless,
    });

    try {
        const page = await browser.newPage();
        // waitUntil: 'load' čeká na hotové načtení fontů (Google Fonts CDN)
        // s timeoutem 15 s. Pokud fonty selžou, PDF vyrenderujeme s fallbackem.
        await page.setContent(html, { waitUntil: 'load', timeout: 15000 }).catch(() => {});
        // Pauza pro dokončení font renderingu
        await new Promise(r => setTimeout(r, 300));
        const pdf = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
        });
        return Buffer.from(pdf);
    } finally {
        await browser.close();
    }
}
