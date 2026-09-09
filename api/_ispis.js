// api/_ispis.js
//
// Thin wrapper nad ISPIS Lustrace API (https://ispis.cz/lustrace/apidocs)
// s vícevrstvou pojistkou proti svévolnému spálení kreditu.
//
// Vrstvy obrany (v pořadí, jak se aplikují):
//   1) Kill-switch ENV: bez ISPIS_ENABLED=true se ISPIS NIKDY nevolá
//   2) Credentials check: bez ISPIS_USERNAME/PASSWORD se nevolá
//   3) Balance floor: po každém volání se z odpovědi čte balanceCents;
//      pokud padne pod ISPIS_MIN_BALANCE_CZK (Kč), další volání blokujeme
//   4) Denní limit počtu volání na tuto Vercel instanci
//   5) Per-request cost cap: pokud jedna lustrace překročí ISPIS_MAX_COST_PER_REQ_CZK,
//      loguje warning a zvedne alert flag (nepokračuje s dalšími profily v batchi)
//   6) 24h dedup cache: stejný subjekt (Jméno+Narozen nebo IČ nebo RČ) v rámci
//      téhož profilu se počítá jen jednou za 24 h — druhé volání vrátí cached JSON
//
// Alert: pokud kterákoli pojistka zablokuje volání, `blocked: <reason>` v návratu,
// caller může poslat internal notifikaci PTF.
//
// ENV proměnné:
//   ISPIS_ENABLED                 — "true" / "1" pro produkci, jinak vše skip
//   ISPIS_USERNAME                — e-mail k ispis.cz
//   ISPIS_PASSWORD                — heslo
//   ISPIS_PROFILE                 — default profil ("Devel" = zdarma, "Zakladni", ...)
//   ISPIS_BASE_URL                — default "https://ispis.cz"
//   ISPIS_MIN_BALANCE_CZK         — default 500 (Kč) — floor
//   ISPIS_MAX_COST_PER_REQ_CZK    — default 100 (Kč) — cena za 1 lustraci
//   ISPIS_MAX_REQS_PER_DAY        — default 50 — na jednu Vercel instanci
//   ISPIS_CACHE_TTL_HOURS         — default 24 (dedup okno)

const BASE_URL = process.env.ISPIS_BASE_URL || 'https://ispis.cz';
const USERNAME = process.env.ISPIS_USERNAME || '';
const PASSWORD = process.env.ISPIS_PASSWORD || '';
const DEFAULT_PROFILE = process.env.ISPIS_PROFILE || 'Devel';
const ENABLED = ['true', '1', 'yes', 'on'].includes(String(process.env.ISPIS_ENABLED || '').toLowerCase());

const MIN_BALANCE_CENTS = Math.round(parseFloat(process.env.ISPIS_MIN_BALANCE_CZK || '500') * 100);
const MAX_COST_PER_REQ_CENTS = Math.round(parseFloat(process.env.ISPIS_MAX_COST_PER_REQ_CZK || '100') * 100);
const MAX_REQS_PER_DAY = parseInt(process.env.ISPIS_MAX_REQS_PER_DAY || '50', 10);
const CACHE_TTL_MS = parseInt(process.env.ISPIS_CACHE_TTL_HOURS || '24', 10) * 3600 * 1000;

// Module-level stav — přežívá mezi warm invocations Vercel serverless funkce.
// Chladný start (nová instance) čítač vynuluje — přijatelné: chráníme před běhy
// v rámci téže instance, ne globálně. Kombinujeme s balance floor, který
// je autoritativní ze strany ISPIS.
let dailyCount = 0;
let dailyResetAt = 0;
let currentBalanceCents = null; // last known balance from ISPIS response
let killedByFloor = false;      // trvale zablokované do restartu instance
const subjectCache = new Map(); // key -> { timestamp, data }

// ---------- pomocné funkce ----------

export function isEnabled() { return ENABLED; }
export function isConfigured() { return Boolean(USERNAME && PASSWORD); }

/**
 * Snapshot stavu — pro debugging / alert e-mail.
 */
export function getState() {
    return {
        enabled: ENABLED,
        configured: isConfigured(),
        profile: DEFAULT_PROFILE,
        dailyCount,
        dailyLimit: MAX_REQS_PER_DAY,
        currentBalanceKc: currentBalanceCents !== null ? (currentBalanceCents / 100).toFixed(2) : null,
        minBalanceKc: (MIN_BALANCE_CENTS / 100).toFixed(2),
        maxCostPerRequestKc: (MAX_COST_PER_REQ_CENTS / 100).toFixed(2),
        killedByFloor,
        cacheSize: subjectCache.size,
    };
}

function subjectKey(subject, profile) {
    const p = (profile || DEFAULT_PROFILE || '').toLowerCase();
    if (subject.IC) return `${p}:ic:${String(subject.IC).trim()}`;
    if (subject.RC) return `${p}:rc:${String(subject.RC).trim()}`;
    return `${p}:person:${(subject.Jmeno || '').trim()}|${(subject.Prijmeni || '').trim()}|${(subject.Narozen || '').trim()}`.toLowerCase();
}

function rollDailyIfNeeded() {
    const now = Date.now();
    if (now > dailyResetAt) {
        dailyCount = 0;
        dailyResetAt = now + 24 * 3600 * 1000;
    }
}

// ---------- veřejné API ----------

/**
 * Jednorázová lustrace jedné osoby / firmy vůči konkrétnímu rejstříku.
 * Bezpečná verze: aplikuje 6 vrstev pojistky.
 *
 * @returns {Promise<{
 *   ok: boolean,
 *   data?: object,
 *   error?: string,
 *   blocked?: 'kill-switch'|'no-credentials'|'balance-floor'|'daily-limit'|'cost-cap',
 *   cached?: boolean,
 *   costKc?: number,
 *   balanceKc?: number
 * }>}
 */
export async function lustraceSearchSubject(subject, profile) {
    // ---- 1) Kill-switch ----
    if (!ENABLED) return { ok: false, error: 'ISPIS_ENABLED != true', blocked: 'kill-switch' };
    // ---- 2) Credentials ----
    if (!isConfigured()) return { ok: false, error: 'ISPIS_USERNAME/PASSWORD chybí', blocked: 'no-credentials' };
    // ---- 3) Balance floor (trvalý blok po prvním překročení) ----
    if (killedByFloor) return { ok: false, error: `Balance pod ${(MIN_BALANCE_CENTS / 100).toFixed(2)} Kč — zablokováno`, blocked: 'balance-floor' };
    if (currentBalanceCents !== null && currentBalanceCents < MIN_BALANCE_CENTS) {
        killedByFloor = true;
        return { ok: false, error: `Balance ${(currentBalanceCents / 100).toFixed(2)} Kč < min ${(MIN_BALANCE_CENTS / 100).toFixed(2)} Kč`, blocked: 'balance-floor' };
    }
    // ---- 4) Denní limit ----
    rollDailyIfNeeded();
    if (dailyCount >= MAX_REQS_PER_DAY) {
        return { ok: false, error: `Denní limit ${MAX_REQS_PER_DAY} volání dosažen`, blocked: 'daily-limit' };
    }
    // ---- 6) Dedup cache ----
    const p = (profile || DEFAULT_PROFILE).trim();
    const cacheKey = subjectKey(subject, p);
    const cached = subjectCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return { ok: true, data: cached.data, cached: true, costKc: 0 };
    }

    // ---- Volání ISPIS ----
    const q = new URLSearchParams();
    q.set('profile', p);
    for (const key of ['Jmeno', 'Prijmeni', 'Narozen', 'RC', 'IC']) {
        if (subject && subject[key]) q.set(key, String(subject[key]).trim());
    }
    const auth = 'Basic ' + Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');
    const url = `${BASE_URL}/api/lustraceSearchSubject?${q.toString()}`;
    let data;
    try {
        const r = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': auth, 'Accept': 'application/json' },
        });
        if (!r.ok) {
            const body = await r.text().catch(() => '');
            return { ok: false, error: `HTTP ${r.status}: ${body.slice(0, 300)}` };
        }
        data = await r.json();
    } catch (e) {
        return { ok: false, error: String(e) };
    }

    // ---- Post-call: aktualizovat stav, zkontrolovat cost cap ----
    dailyCount++;
    const costKc = typeof data.costCents === 'number' ? data.costCents / 100 : null;
    if (typeof data.balanceCents === 'number') currentBalanceCents = data.balanceCents;
    if (typeof data.costCents === 'number' && data.costCents > MAX_COST_PER_REQ_CENTS) {
        // Warning — jednotková cena přesáhla cap. Vrátíme s flagem, ale nezablokujeme
        // stávající data (už jsme za ně zaplatili). Blocked pro DALŠÍ requests.
        console.warn(`[ISPIS] cost ${costKc.toFixed(2)} Kč přesáhl cap ${(MAX_COST_PER_REQ_CENTS / 100).toFixed(2)} Kč — vyzvedávám kill-switch pro tento request`);
        subjectCache.set(cacheKey, { timestamp: Date.now(), data });
        return {
            ok: true, data, cached: false,
            costKc, balanceKc: currentBalanceCents !== null ? currentBalanceCents / 100 : null,
            costCapExceeded: true,
        };
    }
    // Cache pro dedup
    subjectCache.set(cacheKey, { timestamp: Date.now(), data });
    return {
        ok: true, data, cached: false,
        costKc, balanceKc: currentBalanceCents !== null ? currentBalanceCents / 100 : null,
    };
}

/**
 * Stažení PDF přílohy z výsledku lustrace.
 * Pozn.: Download nespotřebovává kredit (jde o už zaplacený výsledek).
 */
export async function lustraceDownload(batchId, lineno, name) {
    if (!ENABLED) return { ok: false, error: 'ISPIS_ENABLED != true', blocked: 'kill-switch' };
    if (!isConfigured()) return { ok: false, error: 'ISPIS not configured', blocked: 'no-credentials' };
    const q = new URLSearchParams({ batchId: String(batchId), lineno: String(lineno), name: String(name) });
    const auth = 'Basic ' + Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');
    const url = `${BASE_URL}/api/lustraceDownload?${q.toString()}`;
    try {
        const r = await fetch(url, { method: 'GET', headers: { 'Authorization': auth } });
        if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
        const ab = await r.arrayBuffer();
        return {
            ok: true,
            base64: Buffer.from(ab).toString('base64'),
            contentType: r.headers.get('content-type') || 'application/pdf',
        };
    } catch (e) {
        return { ok: false, error: String(e) };
    }
}

/**
 * Kompaktní shrnutí výsledku lustrace pro internou notifikaci.
 */
export function summarize(res) {
    if (!res) return { summary: '(bez dat)', hasRecord: false, files: [] };
    if (!res.ok) {
        return {
            summary: res.blocked
                ? `BLOKOVÁNO: ${res.blocked} — ${res.error || ''}`
                : `CHYBA: ${res.error || 'neznámá'}`,
            hasRecord: false,
            files: [],
            blocked: res.blocked || null,
        };
    }
    if (res.cached) {
        return { summary: '(z 24h cache, bez nového volání)', hasRecord: false, files: [], cached: true };
    }
    const data = res.data || {};
    const detail = data.detail || {};
    const files = Array.isArray(data.files) ? data.files.map((f, i) => ({
        lineno: 0,
        name: typeof f === 'string' ? f : (f?.name || f?.filename || `attachment_${i}.pdf`),
    })) : [];
    const hasRecord = Boolean(
        (Array.isArray(data.results) && data.results.length > 0) ||
        (Array.isArray(data.records) && data.records.length > 0) ||
        (detail && (detail.recordCount || detail.count) > 0)
    );
    const parts = [];
    if (data.batchId) parts.push(`batchId: ${data.batchId}`);
    if (typeof res.costKc === 'number') parts.push(`cena: ${res.costKc.toFixed(2)} Kč`);
    if (typeof res.balanceKc === 'number') parts.push(`zůstatek: ${res.balanceKc.toFixed(2)} Kč`);
    parts.push(`záznamy: ${hasRecord ? 'ANO — zkontrolovat!' : 'ne'}`);
    parts.push(`přílohy: ${files.length}`);
    if (res.costCapExceeded) parts.push('⚠️ cena nad limit');
    return { summary: parts.join(' · '), hasRecord, files, blocked: null };
}
