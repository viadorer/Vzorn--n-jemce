// api/bonita-verify-access.js
//
// POST /api/bonita-verify-access
// Body: { email, password }
// Vrací { ok, expiresAt } nebo { ok:false, reason }
//
// Zároveň loguje úspěšné odemknutí (interní notifikace) — víme, kdo právě
// s nástrojem pracuje.

import crypto from 'crypto';

const SECRET = process.env.ACCESS_LINK_SECRET || 'dev-only-secret-please-set-in-vercel-env';
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const FROM_EMAIL = 'kontakt@vzornynajemce.cz';
const RECIPIENT_EMAIL = 'kontakt@vzornynajemce.cz';

function verifyBonitaPassword(email, password) {
    if (typeof email !== 'string' || !email || typeof password !== 'string' || !password) {
        return { ok: false, reason: 'missing' };
    }
    const parts = password.split('.');
    if (parts.length !== 2) return { ok: false, reason: 'malformed' };
    const [expHex, sig] = parts;
    const exp = parseInt(expHex, 16);
    if (!Number.isFinite(exp)) return { ok: false, reason: 'malformed' };
    if (exp * 1000 < Date.now()) return { ok: false, reason: 'expired' };
    const payload = `bonita:${email.toLowerCase()}:${expHex}`;
    const expected = crypto.createHmac('sha256', SECRET).update(payload).digest('hex').slice(0, 12);
    const a = Buffer.from(sig, 'utf-8');
    const b = Buffer.from(expected, 'utf-8');
    if (a.length !== b.length) return { ok: false, reason: 'invalid' };
    if (!crypto.timingSafeEqual(a, b)) return { ok: false, reason: 'invalid' };
    return { ok: true, expiresAt: exp };
}

// Rate limit for verify — chrání proti brute-force uhádnutí hesla
const _rlHits = new Map();
function rlCheck(key, windowMs, max) {
    const now = Date.now();
    const hits = (_rlHits.get(key) || []).filter(t => now - t < windowMs);
    if (hits.length >= max) { _rlHits.set(key, hits); return false; }
    hits.push(now); _rlHits.set(key, hits); return true;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ ok: false, reason: 'method' });
    }

    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    const email = (body && typeof body.email === 'string') ? body.email.trim().toLowerCase() : '';
    const password = (body && typeof body.password === 'string') ? body.password.trim() : '';

    // Brute-force protection: 10 pokusů / hod / IP
    const ip = String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown').split(',')[0].trim();
    if (!rlCheck(`ip:${ip}`, 3600 * 1000, 10)) {
        return res.status(429).json({ ok: false, reason: 'rate-limited', message: 'Příliš mnoho pokusů. Zkuste za hodinu.' });
    }

    const result = verifyBonitaPassword(email, password);
    if (!result.ok) return res.status(401).json(result);

    // Log úspěšného odemknutí — interní notifikace (fire-and-forget)
    if (BREVO_API_KEY) {
        fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': BREVO_API_KEY,
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                sender: { name: 'Vzorný nájemce', email: FROM_EMAIL },
                to: [{ email: RECIPIENT_EMAIL }],
                subject: `[Bonita] Kalkulačka odemčena — ${email}`,
                textContent: `Uživatel ${email} právě odemkl Kalkulačku bonity.\nIP: ${ip}\nHeslo platné do: ${new Date(result.expiresAt * 1000).toISOString()}\nTimestamp: ${new Date().toISOString()}`,
                tags: ['bonita-unlock'],
            }),
        }).catch(() => {}); // fire-and-forget, nezablokovat response
    } else {
        console.log(`[bonita-verify-access] Unlock ${email} from ${ip}`);
    }

    return res.status(200).json({ ok: true, expiresAt: result.expiresAt });
}

export { verifyBonitaPassword };
