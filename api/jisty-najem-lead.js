// Vercel funkce — příjem leadů z Jistý nájem kalkulátoru v hero
// ENV vars:
//   BREVO_API_KEY — pro Brevo transactional e-mail
//   LEAD_RECIPIENT_EMAIL — kam chodí interní notifikace (default: kontakt@vzornynajemce.cz)
//   LEAD_FROM_EMAIL — adresa odesílatele (default: noreply@vzornynajemce.cz)

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const RECIPIENT = process.env.LEAD_RECIPIENT_EMAIL || 'kontakt@vzornynajemce.cz';
const SENDER_EMAIL = process.env.LEAD_FROM_EMAIL || 'noreply@vzornynajemce.cz';
const SENDER_NAME = 'Vzorný nájemce — Jistý nájem';

function cors(req, res) {
  const origin = req.headers.origin || '';
  const allowed = [
    'https://www.vzornynajemce.cz',
    'https://vzornynajemce.cz',
    'http://localhost:3000',
    'http://localhost:8000',
  ];
  const isVercelPreview = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);
  if (allowed.includes(origin) || isVercelPreview) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
}

export default async function handler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let data;
  try {
    data = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch (e) {
    return res.status(400).json({ error: 'Neplatný JSON' });
  }

  // Validace
  const errors = [];
  const psc = String(data.psc || '').replace(/\s/g, '');
  if (!/^\d{5}$/.test(psc)) errors.push('PSČ musí mít 5 číslic');

  const disposition = String(data.disposition || '');
  if (!/^\d\+(kk|1)$/.test(disposition)) errors.push('Neplatná dispozice');

  const area = parseFloat(String(data.area || '').replace(',', '.'));
  if (!area || area < 15 || area > 300) errors.push('Plocha 15–300 m²');

  const email = String(data.email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 200) errors.push('Platný e-mail povinný');

  const phone = String(data.phone || '').trim();
  const phoneDigits = phone.replace(/\D/g, '');
  if (phoneDigits.length < 9) errors.push('Telefon (alespoň 9 číslic)');

  const calcLow = parseInt(data.calc_low, 10) || 0;
  const calcHigh = parseInt(data.calc_high, 10) || 0;

  if (errors.length) return res.status(400).json({ error: 'Validation error', details: errors });

  const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  const ua = String(req.headers['user-agent'] || '').slice(0, 240);
  const ts = new Date().toISOString();

  // Interní notifikace
  const internalSubject = `[Lead] Jistý nájem: ${disposition} ${area}m² · ${psc} · ${email}`;
  const internalText = [
    'Nový lead z hero kalkulátoru Jistý nájem',
    '========================================',
    '',
    'ÚDAJE BYTU',
    `  PSČ:            ${psc}`,
    `  Dispozice:      ${disposition}`,
    `  Plocha:         ${area} m²`,
    `  Kalkulovaný:    ${calcLow.toLocaleString('cs-CZ')} – ${calcHigh.toLocaleString('cs-CZ')} Kč / měsíc`,
    '',
    'KONTAKT',
    `  E-mail:         ${email}`,
    `  Telefon:        ${phone}`,
    '',
    'META',
    `  IP:             ${ip}`,
    `  User-Agent:     ${ua}`,
    `  Timestamp:      ${ts}`,
    '',
    'AKCE',
    '  SLA: kontaktovat do konce dne v pracovní době.',
    '  Připravit konkrétní nabídku podle typu bytu, lokality a stavu.',
  ].join('\n');

  // Konfirmace klientovi
  const confirmSubject = 'Přijali jsme váš požadavek na výpočet jistého nájmu';
  const confirmText = [
    'Dobrý den,',
    '',
    `děkujeme za odeslání údajů o vašem bytě (${disposition}, ${area} m², PSČ ${psc}).`,
    '',
    `Předběžný odhad jistého nájmu: ${calcLow.toLocaleString('cs-CZ')} – ${calcHigh.toLocaleString('cs-CZ')} Kč / měsíc.`,
    '',
    'CO BUDE DÁL',
    '',
    '  1. Do konce dne v pracovní době vám zavoláme.',
    '  2. Domluvíme si nezávaznou prohlídku ve vašem bytě.',
    '  3. Na základě prohlídky připravíme konkrétní nabídku.',
    '',
    'Pokud potřebujete něco urgentního, zavolejte +420 603 834 921.',
    '',
    'S pozdravem,',
    'Tým Vzorný nájemce · Skupina PTF · Od 1999',
    'www.vzornynajemce.cz',
  ].join('\n');

  let internalSent = false, confirmSent = false;
  if (BREVO_API_KEY) {
    const headers = {
      'Content-Type': 'application/json',
      'api-key': BREVO_API_KEY,
      'accept': 'application/json',
    };
    try {
      const r1 = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sender: { email: SENDER_EMAIL, name: SENDER_NAME },
          to: [{ email: RECIPIENT }],
          replyTo: { email, name: email },
          subject: internalSubject,
          textContent: internalText,
        }),
      });
      internalSent = r1.ok;
    } catch (e) {}
    try {
      const r2 = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sender: { email: SENDER_EMAIL, name: SENDER_NAME },
          to: [{ email }],
          subject: confirmSubject,
          textContent: confirmText,
        }),
      });
      confirmSent = r2.ok;
    } catch (e) {}
  } else {
    console.log('[JistyNajem] No BREVO_API_KEY — logged only');
    console.log(internalText);
  }

  return res.status(200).json({
    success: true,
    message: 'Lead přijat',
    debug: BREVO_API_KEY ? { internalSent, confirmSent } : { reason: 'no-api-key' },
  });
}
