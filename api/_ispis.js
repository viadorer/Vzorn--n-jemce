// api/_ispis.js
//
// Thin wrapper nad ISPIS Lustrace API (https://ispis.cz/lustrace/apidocs).
// Podporuje jednorázovou lustraci a stažení PDF přílohy.
//
// ENV proměnné:
//   ISPIS_USERNAME       — e-mail (přihlašovací jméno) k ispis.cz
//   ISPIS_PASSWORD       — heslo
//   ISPIS_PROFILE        — default profil (např. "Zakladni", "Devel");
//                          při volání lze přepsat argumentem `profile`
//   ISPIS_BASE_URL       — default "https://ispis.cz"

const BASE_URL = process.env.ISPIS_BASE_URL || 'https://ispis.cz';
const USERNAME = process.env.ISPIS_USERNAME || '';
const PASSWORD = process.env.ISPIS_PASSWORD || '';
const DEFAULT_PROFILE = process.env.ISPIS_PROFILE || 'Devel';

export function isConfigured() {
    return Boolean(USERNAME && PASSWORD);
}

/**
 * Jednorázová lustrace jedné osoby / firmy vůči konkrétnímu rejstříku.
 *
 * @param {object} subject
 * @param {string} [subject.Jmeno]
 * @param {string} [subject.Prijmeni]
 * @param {string} [subject.Narozen]  ve formátu dd.MM.yyyy
 * @param {string} [subject.RC]       rodné číslo (bez lomítka)
 * @param {string} [subject.IC]       IČO (pro OSVČ / právnické osoby)
 * @param {string} [profile]          typ rejstříku (ISIR, CEE, ExeSR, Zakladni, Devel)
 * @returns {Promise<{ok:boolean, data?:object, error?:string}>}
 */
export async function lustraceSearchSubject(subject, profile) {
    if (!isConfigured()) return { ok: false, error: 'ISPIS not configured' };
    const p = (profile || DEFAULT_PROFILE).trim();
    const q = new URLSearchParams();
    q.set('profile', p);
    for (const key of ['Jmeno', 'Prijmeni', 'Narozen', 'RC', 'IC']) {
        if (subject && subject[key]) q.set(key, String(subject[key]).trim());
    }
    const auth = 'Basic ' + Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');
    const url = `${BASE_URL}/api/lustraceSearchSubject?${q.toString()}`;
    try {
        const r = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': auth, 'Accept': 'application/json' },
        });
        if (!r.ok) {
            const body = await r.text().catch(() => '');
            return { ok: false, error: `HTTP ${r.status}: ${body.slice(0, 300)}` };
        }
        const data = await r.json();
        return { ok: true, data };
    } catch (e) {
        return { ok: false, error: String(e) };
    }
}

/**
 * Stažení PDF přílohy z výsledku lustrace.
 * @param {string} batchId
 * @param {number} lineno
 * @param {string} name
 * @returns {Promise<{ok:boolean, base64?:string, contentType?:string, error?:string}>}
 */
export async function lustraceDownload(batchId, lineno, name) {
    if (!isConfigured()) return { ok: false, error: 'ISPIS not configured' };
    const q = new URLSearchParams({ batchId: String(batchId), lineno: String(lineno), name: String(name) });
    const auth = 'Basic ' + Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');
    const url = `${BASE_URL}/api/lustraceDownload?${q.toString()}`;
    try {
        const r = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': auth },
        });
        if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
        const ab = await r.arrayBuffer();
        const contentType = r.headers.get('content-type') || 'application/pdf';
        return { ok: true, base64: Buffer.from(ab).toString('base64'), contentType };
    } catch (e) {
        return { ok: false, error: String(e) };
    }
}

/**
 * Kompaktní shrnutí výsledku lustrace — extrahuje klíčová pole a
 * vrátí čitelný text pro internou notifikaci.
 * @param {object} data — response z lustraceSearchSubject
 * @returns {{summary:string, hasRecord:boolean, files: {lineno:number, name:string}[]}}
 */
export function summarize(data) {
    if (!data || typeof data !== 'object') return { summary: '(bez dat)', hasRecord: false, files: [] };
    const detail = data.detail || {};
    const files = Array.isArray(data.files) ? data.files.map((f, i) => ({
        lineno: 0,
        name: typeof f === 'string' ? f : (f?.name || f?.filename || `attachment_${i}.pdf`),
    })) : [];
    // Heuristika: pokud jsou v odpovědi "výsledky", "records" nebo neprázdné pole,
    // předpokládáme, že osoba má záznam. Skutečnou strukturu ISPIS API vrací,
    // ale tady předáváme raw JSON dál — PTF člověk to zkontroluje.
    const raw = JSON.stringify(detail).length + JSON.stringify(data.results || []).length;
    const hasRecord = Boolean(
        (Array.isArray(data.results) && data.results.length > 0) ||
        (Array.isArray(data.records) && data.records.length > 0) ||
        (detail && (detail.recordCount || detail.count) > 0)
    );
    const parts = [];
    if (data.batchId) parts.push(`batchId: ${data.batchId}`);
    if (typeof data.costCents === 'number') parts.push(`cena: ${(data.costCents / 100).toFixed(2)} Kč`);
    if (typeof data.balanceCents === 'number') parts.push(`zůstatek: ${(data.balanceCents / 100).toFixed(2)} Kč`);
    parts.push(`záznamy: ${hasRecord ? 'ANO — zkontrolovat!' : 'ne'}`);
    parts.push(`přílohy: ${files.length}`);
    return { summary: parts.join(' · '), hasRecord, files, rawSize: raw };
}
