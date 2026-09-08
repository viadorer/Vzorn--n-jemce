// api/preverit-verify-access.js
//
// Ověří HMAC token vydaný v /api/preverit-request-access.
// GET /api/preverit-verify-access?email=…&token=…
// Vrací { ok, expiresAt } nebo { ok:false, reason }.

import crypto from 'crypto';

const SECRET = process.env.ACCESS_LINK_SECRET || 'dev-only-secret-please-set-in-vercel-env';

function verifyAccessToken(email, token) {
    if (typeof email !== 'string' || typeof token !== 'string') return { ok: false, reason: 'missing' };
    const parts = token.split('.');
    if (parts.length !== 2) return { ok: false, reason: 'malformed' };
    const [expStr, sig] = parts;
    const exp = parseInt(expStr, 10);
    if (!Number.isFinite(exp)) return { ok: false, reason: 'malformed' };
    if (exp * 1000 < Date.now()) return { ok: false, reason: 'expired' };
    const payload = `${email.toLowerCase()}:${exp}`;
    const expected = crypto.createHmac('sha256', SECRET).update(payload).digest('hex').slice(0, 32);
    const a = Buffer.from(sig, 'utf-8');
    const b = Buffer.from(expected, 'utf-8');
    if (a.length !== b.length) return { ok: false, reason: 'invalid' };
    if (!crypto.timingSafeEqual(a, b)) return { ok: false, reason: 'invalid' };
    return { ok: true, expiresAt: exp };
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ ok: false, reason: 'method' });
    }
    const email = (req.query && typeof req.query.email === 'string') ? req.query.email.trim() : '';
    const token = (req.query && typeof req.query.token === 'string') ? req.query.token.trim() : '';
    const result = verifyAccessToken(email, token);
    if (!result.ok) return res.status(401).json(result);
    return res.status(200).json(result);
}

export { verifyAccessToken };
