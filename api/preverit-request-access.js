// api/preverit-request-access.js
//
// Vercel serverless funkce: přijímá e-mail majitele, generuje jednorázový
// přístupový token (HMAC) a posílá majiteli magic link vedoucí na
// /preverit-zajemce?token=…&email=…. Volitelně notifikuje interní tým.
//
// ENV proměnné:
//   BREVO_API_KEY         — Brevo API klíč pro odesílání transakčních e-mailů
//   LEAD_FROM_EMAIL       — from adresa (default: kontakt@vzornynajemce.cz)
//   LEAD_RECIPIENT_EMAIL  — interní notifikace (default: kontakt@vzornynajemce.cz)
//   ACCESS_LINK_SECRET    — tajný podpis pro HMAC token
//   ACCESS_LINK_TTL_HOURS — expirace linku v hodinách (default 48)
//   PUBLIC_BASE_URL       — kde běží web (default https://www.vzornynajemce.cz)

import crypto from 'crypto';

const BREVO_API_KEY = process.env.BREVO_API_KEY;
// Pozor: nepoužíváme ENV var pro sender/recipient — na Vercelu byl v ENV překlep
// (vzronynajemce.cz místo vzornynajemce.cz), který způsoboval odmítnutí odesílání
// v Brevo. Adresy jsou zafixované zde.
const FROM_EMAIL = 'kontakt@vzornynajemce.cz';
const RECIPIENT_EMAIL = 'kontakt@vzornynajemce.cz';
const SECRET = process.env.ACCESS_LINK_SECRET || 'dev-only-secret-please-set-in-vercel-env';
const TTL_HOURS = parseInt(process.env.ACCESS_LINK_TTL_HOURS || '48', 10);
const BASE_URL = process.env.PUBLIC_BASE_URL || 'https://www.vzornynajemce.cz';

function isValidEmail(e) {
    return typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && e.length <= 200;
}

function createAccessToken(email) {
    const exp = Math.floor(Date.now() / 1000) + TTL_HOURS * 3600;
    const payload = `${email.toLowerCase()}:${exp}`;
    const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('hex').slice(0, 32);
    return { token: `${exp}.${sig}`, exp };
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ ok: false, message: 'Method not allowed' });
    }

    let body = req.body;
    if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
    }
    const email = (body && typeof body.email === 'string') ? body.email.trim() : '';

    if (!isValidEmail(email)) {
        return res.status(400).json({ ok: false, message: 'Zadejte prosím platnou e-mailovou adresu.' });
    }

    const { token, exp } = createAccessToken(email);
    const link = `${BASE_URL}/preverit-zajemce?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;
    const expDate = new Date(exp * 1000).toLocaleString('cs-CZ', { timeZone: 'Europe/Prague' });

    const htmlBody = `
<!DOCTYPE html><html lang="cs"><head><meta charset="UTF-8"></head><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#FBF7F2;padding:24px;color:#0f172a">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb">
    <div style="padding:32px 32px 8px">
      <div style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#64748b;font-weight:600;margin-bottom:12px">Vzorný nájemce &middot; skupina PTF reality</div>
      <h1 style="font-size:24px;line-height:1.2;margin:0 0 12px;color:#0f172a">Váš přístupový odkaz je připraven</h1>
      <p style="font-size:15px;line-height:1.6;color:#475569;margin:0 0 20px">Klikněte na tlačítko níže, otevře se vám bezpečný formulář, kde vyplníte údaje zájemce o nájem. Do <strong>60 minut v pracovní době</strong> vám pošleme PDF report ze&nbsp;4 rejstříků.</p>
      <p style="margin:0 0 20px"><a href="${link}" style="display:inline-block;padding:14px 28px;background:#E63946;color:#fff;font-weight:600;font-size:15px;border-radius:9999px;text-decoration:none">Otevřít formulář</a></p>
      <p style="font-size:13px;line-height:1.6;color:#64748b;margin:0 0 8px"><strong>Odkaz je platný do:</strong> ${expDate}</p>
      <p style="font-size:13px;line-height:1.6;color:#64748b;margin:0 0 24px">Odkaz otevře jen tato adresa: <strong>${email}</strong></p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
      <div style="font-size:12px;line-height:1.6;color:#94a3b8">Prověření je zdarma, jednou pro majitele. Data se zpracovávají v souladu s&nbsp;GDPR a po&nbsp;30&nbsp;dnech je automaticky mažeme. Pokud jste o&nbsp;odkaz nežádali, e-mail ignorujte.</div>
    </div>
    <div style="padding:16px 32px;background:#f1f5f9;font-size:12px;color:#64748b">PTF reality, s.r.o. &middot; Radyňská 33, Plzeň &middot; Pod Turnovskou tratí 18, Praha</div>
  </div>
</body></html>`.trim();

    const textBody = `Váš přístupový odkaz na prověření zájemce zdarma:\n\n${link}\n\nPlatný do: ${expDate}\nOdkaz otevře jen tato adresa: ${email}\n\nVzorný nájemce, skupina PTF reality, s.r.o.`;

    let sent = false;
    let errorDetail = null;

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
                    subject: 'Váš přístupový odkaz — Prověření zájemce zdarma',
                    htmlContent: htmlBody,
                    textContent: textBody,
                    tags: ['preverit-access-link'],
                }),
            });
            if (r.ok) {
                sent = true;
            } else {
                errorDetail = await r.text();
            }

            // interní notifikace, ať víme kdo si zažádal
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
                    subject: `[Preverit] Nový lead — ${email}`,
                    textContent: `Nový požadavek na přístupový odkaz.\nE-mail: ${email}\nPlatnost odkazu: ${expDate}\n\nOdkaz (nepředávejte třetí straně): ${link}`,
                    tags: ['preverit-access-link-internal'],
                }),
            }).catch(() => {});
        } catch (err) {
            errorDetail = String(err);
        }
    } else {
        console.log('[preverit-request-access] No BREVO_API_KEY — link only logged:');
        console.log({ email, link, exp: expDate });
    }

    return res.status(200).json({
        ok: true,
        sent,
        message: sent
            ? 'Přístupový odkaz jsme poslali na váš e-mail. Zkontrolujte i spam.'
            : 'Poznamenali jsme si vaši žádost. Kontaktujeme vás e-mailem během několika minut.',
        ...(process.env.NODE_ENV !== 'production' && errorDetail ? { debug: errorDetail } : {}),
    });
}
