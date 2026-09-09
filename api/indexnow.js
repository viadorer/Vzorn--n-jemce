// api/indexnow.js
//
// IndexNow protocol — okamžité oznámení Bingu, Yandexu a Seznamu při publish.
// https://www.indexnow.org
//
// Použití:
//   POST /api/indexnow
//   Body: { "urls": ["https://www.vzornynajemce.cz/blog/…"] }
//   nebo: { "url": "https://www.vzornynajemce.cz/blog/…" }
//
// Interní autorizace: hlavička X-IndexNow-Secret === INDEXNOW_TRIGGER_SECRET (ENV)
// Bez ní endpoint akceptuje jen URL na naší doméně (whitelist).
//
// Odesílá na hlavní IndexNow endpoint, který distribuuje mezi Bing, Yandex,
// Seznam.cz, Naver, Yep. Rate-limit: soft, IndexNow doporučuje max 10k URL/den.

const HOST = 'www.vzornynajemce.cz';
const KEY = '8cc2a4e98add5f3f32426828652b141a';
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
const TRIGGER_SECRET = process.env.INDEXNOW_TRIGGER_SECRET || '';

// Whitelist povolených hostů
const ALLOWED_HOSTS = new Set(['www.vzornynajemce.cz', 'vzornynajemce.cz']);

function isValidUrl(u) {
    try {
        const url = new URL(u);
        return url.protocol === 'https:' && ALLOWED_HOSTS.has(url.hostname);
    } catch { return false; }
}

// Rate limit: module-level, per-instance
let dailyCount = 0;
let dailyResetAt = 0;
const DAILY_LIMIT = parseInt(process.env.INDEXNOW_DAILY_LIMIT || '500', 10);

export default async function handler(req, res) {
    // GET → status
    if (req.method === 'GET') {
        return res.status(200).json({
            ok: true,
            protocol: 'IndexNow',
            key: KEY,
            keyLocation: KEY_LOCATION,
            host: HOST,
            dailyLimit: DAILY_LIMIT,
            usedToday: dailyCount,
            docs: 'https://www.indexnow.org',
        });
    }
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'GET, POST');
        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    }

    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }

    // Sanitize URL list
    let urls = [];
    if (Array.isArray(body?.urls)) urls = body.urls;
    else if (typeof body?.url === 'string') urls = [body.url];
    urls = urls.filter(isValidUrl);
    if (urls.length === 0) {
        return res.status(400).json({ ok: false, error: 'No valid URLs (must be https://www.vzornynajemce.cz/…)' });
    }
    if (urls.length > 100) urls = urls.slice(0, 100); // per-request cap

    // Rate limit (denní)
    const now = Date.now();
    if (now > dailyResetAt) { dailyCount = 0; dailyResetAt = now + 24 * 3600 * 1000; }
    if (dailyCount + urls.length > DAILY_LIMIT) {
        return res.status(429).json({ ok: false, error: `Denní limit ${DAILY_LIMIT} URL dosažen (dnes ${dailyCount}).` });
    }

    // Trigger secret check — pokud je nastaven, POST musí přijít s hlavičkou
    if (TRIGGER_SECRET) {
        const provided = req.headers['x-indexnow-secret'] || '';
        if (provided !== TRIGGER_SECRET) {
            return res.status(401).json({ ok: false, error: 'Missing or invalid X-IndexNow-Secret header' });
        }
    }

    // Odeslat do IndexNow
    try {
        const r = await fetch(INDEXNOW_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
            body: JSON.stringify({
                host: HOST,
                key: KEY,
                keyLocation: KEY_LOCATION,
                urlList: urls,
            }),
        });
        dailyCount += urls.length;
        return res.status(200).json({
            ok: true,
            submitted: urls.length,
            usedToday: dailyCount,
            indexNowStatus: r.status,
            urls,
        });
    } catch (e) {
        return res.status(500).json({ ok: false, error: String(e).slice(0, 200) });
    }
}
