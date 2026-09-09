// api/bonita-request-access.js
//
// POST /api/bonita-request-access
// Body: { email: string }
//
// Přijme e-mail majitele, vygeneruje unikátní HMAC "heslo" platné TTL dnů
// a pošle mu ho e-mailem přes Brevo. Zároveň interně loguje kdo si o heslo
// zažádal (interní notifikace na kontakt@vzornynajemce.cz).
//
// ENV proměnné:
//   BREVO_API_KEY               — Brevo API klíč
//   ACCESS_LINK_SECRET          — HMAC secret (sdílený s ostatními gate endpointy)
//   BONITA_ACCESS_TTL_DAYS      — default 30
//   PUBLIC_BASE_URL             — default https://www.vzornynajemce.cz
//
// Heslo format:  <expHex>.<sigHex>
//   expHex = 8 hex znaků = uint32 unix timestamp
//   sigHex = 12 hex znaků = HMAC-SHA256("bonita:" + email + ":" + expHex, SECRET) první 12
// Celkem 21 znaků — snadné opsat, i když víc než UX ideál (kompromis mezi bezpečností a UX).

import crypto from 'crypto';

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const FROM_EMAIL = 'kontakt@vzornynajemce.cz';
const RECIPIENT_EMAIL = 'kontakt@vzornynajemce.cz';
const SECRET = process.env.ACCESS_LINK_SECRET || 'dev-only-secret-please-set-in-vercel-env';
const TTL_DAYS = parseInt(process.env.BONITA_ACCESS_TTL_DAYS || '30', 10);
const BASE_URL = process.env.PUBLIC_BASE_URL || 'https://www.vzornynajemce.cz';

// ---- Rate-limit (module-level, per-instance) ----
const RL_PER_EMAIL_PER_DAY = parseInt(process.env.BONITA_RL_EMAIL_PER_DAY || '3', 10);
const _rlHits = new Map(); // email -> [timestamp,...]
function rlCheck(key, windowMs, max) {
    const now = Date.now();
    const hits = (_rlHits.get(key) || []).filter(t => now - t < windowMs);
    if (hits.length >= max) { _rlHits.set(key, hits); return false; }
    hits.push(now); _rlHits.set(key, hits); return true;
}

function isValidEmail(e) {
    return typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 200;
}

// URL-safe base64 encoding (bez '+', '/', '=' pro čistý copy-paste)
function b64url(buf) {
    return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Token format: <expHex>.<emailB64url>.<sigHex>
// - stačí opsat jen heslo, backend z něj rozbalí e-mail
function createBonitaPassword(email) {
    const exp = Math.floor(Date.now() / 1000) + TTL_DAYS * 86400;
    const expHex = exp.toString(16).padStart(8, '0');
    const emailB64 = b64url(email.toLowerCase());
    const payload = `bonita:${email.toLowerCase()}:${expHex}`;
    const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('hex').slice(0, 12);
    return { password: `${expHex}.${emailB64}.${sig}`, exp };
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ ok: false, message: 'Method not allowed' });
    }

    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    const email = (body && typeof body.email === 'string') ? body.email.trim() : '';
    if (!isValidEmail(email)) {
        return res.status(400).json({ ok: false, message: 'Zadejte prosím platnou e-mailovou adresu.' });
    }

    // Rate limit per e-mail
    if (!rlCheck(`email:${email.toLowerCase()}`, 24 * 3600 * 1000, RL_PER_EMAIL_PER_DAY)) {
        return res.status(429).json({
            ok: false,
            message: `Denní limit ${RL_PER_EMAIL_PER_DAY} žádostí o heslo je dosažen. Pokud jste e-mail nedostali, zkontrolujte spam a nebo napište na kontakt@vzornynajemce.cz.`
        });
    }

    const { password, exp } = createBonitaPassword(email);
    const magicLink = `${BASE_URL}/bonita_najemnika?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
    const expDate = new Date(exp * 1000).toLocaleDateString('cs-CZ', { timeZone: 'Europe/Prague' });

    const htmlBody = `
<!DOCTYPE html><html lang="cs"><head><meta charset="UTF-8"></head><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#FBF7F2;padding:24px;color:#0f172a">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb">
    <div style="padding:32px 32px 8px">
      <div style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#64748b;font-weight:600;margin-bottom:12px">Vzorný nájemce &middot; kalkulačka bonity</div>
      <h1 style="font-size:24px;line-height:1.2;margin:0 0 12px;color:#0f172a">Vaše přístupové heslo</h1>
      <p style="font-size:15px;line-height:1.6;color:#475569;margin:0 0 20px">Získali jste přístup ke Kalkulačce bonity nájemníka. Můžete použít odkaz níže (odemkne se automaticky), nebo heslo opsat.</p>

      <p style="margin:0 0 20px"><a href="${magicLink}" style="display:inline-block;padding:14px 28px;background:#E63946;color:#fff;font-weight:600;font-size:15px;border-radius:9999px;text-decoration:none">Otevřít kalkulačku</a></p>

      <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;padding:16px 20px;margin:0 0 20px">
        <div style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#64748b;font-weight:600;margin-bottom:8px">Vaše heslo</div>
        <div style="font-family:'SFMono-Regular',Consolas,monospace;font-size:18px;font-weight:600;color:#0f172a;letter-spacing:0.02em;word-break:break-all">${password}</div>
      </div>

      <p style="font-size:13px;line-height:1.6;color:#64748b;margin:0 0 8px"><strong>Platné do:</strong> ${expDate}</p>
      <p style="font-size:13px;line-height:1.6;color:#64748b;margin:0 0 24px"><strong>Váš přihlašovací e-mail:</strong> ${email}</p>

      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
      <div style="font-size:12px;line-height:1.6;color:#94a3b8">Heslo je vázané na tento e-mail. Nesdílejte ho — každý uživatel má vlastní. Pokud jste o&nbsp;heslo nežádali, ignorujte tento e-mail.</div>
    </div>
    <div style="padding:16px 32px;background:#f1f5f9;font-size:12px;color:#64748b">PTF reality, s.r.o. &middot; Radyňská 33, Plzeň &middot; Pod Turnovskou tratí 18, Praha</div>
  </div>
</body></html>`.trim();

    const textBody = `Vaše přístupové heslo ke Kalkulačce bonity nájemníka:\n\n${password}\n\nNebo klikněte na odkaz — kalkulačka se odemkne sama:\n${magicLink}\n\nHeslo je platné do: ${expDate}\nPřihlašovací e-mail: ${email}\n\nVzorný nájemce, skupina PTF reality, s.r.o.`;

    let sent = false, errorDetail = null;

    if (BREVO_API_KEY) {
        try {
            const r = await fetch('https://api.brevo.com/v3/smtp/email', {
                method: 'POST',
                headers: {
                    'accept': 'application/json',
                    'api-key': BREVO_API_KEY,
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    sender: { name: 'Vzorný nájemce', email: FROM_EMAIL },
                    to: [{ email }],
                    replyTo: { email: RECIPIENT_EMAIL },
                    subject: 'Heslo ke Kalkulačce bonity — Vzorný nájemce',
                    htmlContent: htmlBody,
                    textContent: textBody,
                    tags: ['bonita-access-password'],
                }),
            });
            sent = r.ok;
            if (!r.ok) errorDetail = await r.text().catch(() => 'brevo-failed');
        } catch (e) {
            errorDetail = String(e).slice(0, 200);
        }

        // Interní notifikace — kdo si o heslo zažádal
        await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': BREVO_API_KEY,
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                sender: { name: 'Vzorný nájemce', email: FROM_EMAIL },
                to: [{ email: RECIPIENT_EMAIL }],
                subject: `[Bonita] Žádost o heslo — ${email}`,
                textContent: `Nová žádost o přístup ke Kalkulačce bonity.\nE-mail: ${email}\nHeslo platné do: ${expDate}\nTimestamp: ${new Date().toISOString()}\nIP: ${req.headers['x-forwarded-for'] || 'unknown'}`,
                tags: ['bonita-access-internal'],
            }),
        }).catch(() => {});
    } else {
        console.log('[bonita-request-access] No BREVO_API_KEY — password only logged:');
        console.log({ email, password, exp: expDate });
    }

    return res.status(200).json({
        ok: true,
        sent,
        message: sent
            ? 'Přístupové heslo jsme poslali na váš e-mail. Zkontrolujte i spam.'
            : 'Poznamenali jsme si vaši žádost, brzy se ozveme.',
        ...(process.env.NODE_ENV !== 'production' && errorDetail ? { debug: errorDetail } : {}),
    });
}
