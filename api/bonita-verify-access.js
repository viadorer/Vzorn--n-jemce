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

// URL-safe base64 decode
function b64urlDecode(s) {
    if (typeof s !== 'string') return '';
    const norm = s.replace(/-/g, '+').replace(/_/g, '/');
    const pad = norm.length % 4 === 0 ? '' : '='.repeat(4 - (norm.length % 4));
    try { return Buffer.from(norm + pad, 'base64').toString('utf-8'); } catch { return ''; }
}

// Ověření hesla — email si extrahujeme z tokenu (uživatel ho nezadává)
// Token format: <expHex>.<emailB64url>.<sigHex>
// Legacy format: <expHex>.<sigHex> (bez emailu) — vyžaduje email argument
function verifyBonitaPassword(password, emailHint) {
    if (typeof password !== 'string' || !password) return { ok: false, reason: 'missing' };
    const parts = password.split('.');
    let expHex, emailFromToken, sig;
    if (parts.length === 3) {
        [expHex, , sig] = parts;
        emailFromToken = b64urlDecode(parts[1]);
    } else if (parts.length === 2 && emailHint) {
        [expHex, sig] = parts;
        emailFromToken = emailHint.toLowerCase();
    } else {
        return { ok: false, reason: 'malformed' };
    }
    if (!emailFromToken || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailFromToken)) return { ok: false, reason: 'malformed' };
    const exp = parseInt(expHex, 16);
    if (!Number.isFinite(exp)) return { ok: false, reason: 'malformed' };
    if (exp * 1000 < Date.now()) return { ok: false, reason: 'expired' };
    const payload = `bonita:${emailFromToken}:${expHex}`;
    const expected = crypto.createHmac('sha256', SECRET).update(payload).digest('hex').slice(0, 12);
    const a = Buffer.from(sig, 'utf-8');
    const b = Buffer.from(expected, 'utf-8');
    if (a.length !== b.length) return { ok: false, reason: 'invalid' };
    if (!crypto.timingSafeEqual(a, b)) return { ok: false, reason: 'invalid' };
    return { ok: true, expiresAt: exp, email: emailFromToken };
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
    const password = (body && typeof body.password === 'string') ? body.password.trim() : '';
    const emailHint = (body && typeof body.email === 'string') ? body.email.trim().toLowerCase() : '';

    // Brute-force protection: 10 pokusů / hod / IP
    const ip = String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown').split(',')[0].trim();
    if (!rlCheck(`ip:${ip}`, 3600 * 1000, 10)) {
        return res.status(429).json({ ok: false, reason: 'rate-limited', message: 'Příliš mnoho pokusů. Zkuste za hodinu.' });
    }

    const result = verifyBonitaPassword(password, emailHint);
    if (!result.ok) return res.status(401).json(result);
    const email = result.email;

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

    return res.status(200).json({ ok: true, expiresAt: result.expiresAt, email });
}

export { verifyBonitaPassword };
