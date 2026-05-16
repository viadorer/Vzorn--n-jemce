// Vercel serverless function — příjem žádostí o bezplatné prověření zájemce o nájem
// ENV vars:
//   BREVO_API_KEY — pro odesílání transactional e-mailů
//   SCREENING_RECIPIENT_EMAIL — kam chodí interní notifikace (default: info@ptf.cz)
//   SCREENING_FROM_EMAIL — adresa odesílatele (default: noreply@vzornynajemce.cz)
//
// Pokud BREVO_API_KEY není nastaven, funkce se nezhroutí — submise se zaloguje do Vercel logs
// a vrátí se success. Tím se forms na frontu neblokuje při nedokončeném setupu.

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const RECIPIENT = process.env.SCREENING_RECIPIENT_EMAIL || 'info@ptf.cz';
const SENDER_EMAIL = process.env.SCREENING_FROM_EMAIL || 'noreply@vzornynajemce.cz';
const SENDER_NAME = 'Vzorný nájemce — Prověření zájemce';

function cors(req, res) {
  const origin = req.headers.origin || '';
  const allowed = [
    'https://www.vzornynajemce.cz',
    'https://vzornynajemce.cz',
    'http://localhost:3000',
    'http://localhost:8000',
    'http://127.0.0.1:8000',
  ];
  const isVercelPreview = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);
  if (allowed.includes(origin) || isVercelPreview) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
}

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

  // ---- Validation ----
  const errors = [];
  const type = String(data.candidate_type || '').trim();
  if (!['fyzicka', 'osvc', 'firma'].includes(type)) errors.push('Vyberte typ zájemce');

  const candidateName = String(data.candidate_name || '').trim();
  if (candidateName.length < 2 || candidateName.length > 120) errors.push('Jméno zájemce 2–120 znaků');

  if (type === 'fyzicka') {
    const dob = String(data.candidate_dob || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) errors.push('Datum narození ve formátu YYYY-MM-DD');
  } else {
    const ic = String(data.candidate_ic || '').replace(/\s/g, '');
    if (!/^\d{6,10}$/.test(ic)) errors.push('IČ musí být 6–10 číslic');
  }

  const requesterEmail = String(data.requester_email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(requesterEmail) || requesterEmail.length > 200) {
    errors.push('Platný e-mail majitele povinný');
  }

  const requesterName = String(data.requester_name || '').trim().slice(0, 120);
  const requesterPhone = String(data.requester_phone || '').trim().slice(0, 40);
  const phoneDigits = requesterPhone.replace(/\D/g, '');
  if (phoneDigits.length < 9) errors.push('Telefon povinný (alespoň 9 číslic)');
  const propertyLocation = String(data.property_location || '').trim().slice(0, 200);
  const candidateAddress = String(data.candidate_address || '').trim().slice(0, 200);
  const candidateIc = String(data.candidate_ic || '').replace(/\s/g, '').slice(0, 12);
  const candidateDob = String(data.candidate_dob || '').trim().slice(0, 10);

  if (!data.consent_obtained) errors.push('Potvrzení o souhlasu zájemce povinné');
  if (!data.consent_gdpr) errors.push('Souhlas s GDPR povinný');

  // Honeypot anti-spam
  if (data.website && String(data.website).trim() !== '') {
    // pretend success but ignore
    return res.status(200).json({ success: true });
  }

  if (errors.length) {
    return res.status(400).json({ error: 'Validační chyba', details: errors });
  }

  // ---- Compose emails ----
  const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
  const ua = String(req.headers['user-agent'] || '').slice(0, 240);
  const ts = new Date().toISOString();

  const internalSubject = `[Prověření zájemce] ${candidateName} — ${requesterEmail}`;
  const internalText = [
    'Nový request na bezplatné prověření zájemce o nájem',
    '=================================================',
    '',
    'ÚDAJE ZÁJEMCE',
    `  Typ:           ${type}`,
    `  Jméno:         ${candidateName}`,
    candidateDob ? `  Datum nar.:    ${candidateDob}` : '',
    candidateIc ? `  IČ:            ${candidateIc}` : '',
    candidateAddress ? `  Adresa:        ${candidateAddress}` : '',
    '',
    'ÚDAJE ŽADATELE (MAJITEL)',
    `  Telefon:       ${requesterPhone}`,
    `  E-mail:        ${requesterEmail}`,
    requesterName ? `  Jméno:         ${requesterName}` : '',
    propertyLocation ? `  Lokace bytu:   ${propertyLocation}` : '',
    '',
    'SOUHLASY (deklarované majitelem)',
    '  ✓ Má písemný souhlas zájemce s prověřením v rejstřících',
    '  ✓ Souhlasí se zpracováním osobních údajů',
    `  IP:            ${ip}`,
    `  User-Agent:    ${ua}`,
    `  Timestamp:     ${ts}`,
    '',
    'AKCE',
    '  SLA: do 1 hodiny v pracovní době (Po-Pá 9:00-17:00)',
    '       mimo: do dalšího pracovního dne 9:00',
    '',
    '  Rejstříky ke kontrole:',
    '    [ ] ISIR — Insolvenční rejstřík',
    '    [ ] ARES — Administrativní registr',
    '    [ ] CEE — Centrální evidence exekucí',
    '    [ ] Justice.cz — Veřejný rejstřík',
    '',
    '  Po dokončení: PDF report na e-mail majitele.',
    '  GDPR: po doručení reportu data uchovat 30 dní, poté smazat.',
  ].filter(Boolean).join('\n');

  const confirmSubject = 'Přijali jsme váš požadavek na prověření zájemce';
  const confirmText = [
    `Dobrý den${requesterName ? ' ' + requesterName.split(' ')[0] : ''},`,
    '',
    'děkujeme za odeslání žádosti o bezplatné prověření zájemce o nájem.',
    '',
    'CO BUDE DÁL',
    '',
    '  1. Náš tým spustí prověření v rejstřících (ISIR, ARES, Centrální',
    '     evidence exekucí, Justice.cz).',
    '  2. Do 1 hodiny v pracovní době (Po-Pá 9:00-17:00) obdržíte PDF',
    '     report na tento e-mail.',
    '  3. Mimo pracovní dobu se ozveme do dalšího pracovního dne 9:00.',
    '',
    'KOHO PROVĚŘUJEME',
    '',
    `  Jméno: ${candidateName}`,
    candidateDob ? `  Datum narození: ${candidateDob}` : '',
    candidateIc ? `  IČ: ${candidateIc}` : '',
    '',
    'OCHRANA OSOBNÍCH ÚDAJŮ',
    '',
    '  Údaje zájemce i vaše uchováváme po dobu 30 dní pro účely provedení',
    '  prověření a doručení reportu. Po této době je trvale mažeme.',
    '',
    '  Můžete kdykoli odvolat souhlas a nechat údaje smazat ihned',
    '  na adrese vzornynajemce@ptf.cz.',
    '',
    '  Další informace o zpracování:',
    '  https://www.vzornynajemce.cz/gdpr.html',
    '',
    'Pokud máte otázky, odpovězte na tento e-mail',
    'nebo zavolejte +420 603 834 921 (Po-Pá 8:00-17:00).',
    '',
    'S pozdravem,',
    'Tým Vzorný nájemce',
    'www.vzornynajemce.cz',
  ].filter(Boolean).join('\n');

  // ---- Send via Brevo (or skip if not configured) ----
  let internalSent = false, confirmSent = false, errorDetail = null;

  if (BREVO_API_KEY) {
    const headers = {
      'Content-Type': 'application/json',
      'api-key': BREVO_API_KEY,
      'accept': 'application/json',
    };
    try {
      const r1 = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST', headers,
        body: JSON.stringify({
          sender: { email: SENDER_EMAIL, name: SENDER_NAME },
          to: [{ email: RECIPIENT }],
          replyTo: { email: requesterEmail, name: requesterName || requesterEmail },
          subject: internalSubject,
          textContent: internalText,
        }),
      });
      internalSent = r1.ok;
      if (!r1.ok) errorDetail = await r1.text().catch(() => 'brevo-internal-failed');
    } catch (e) {
      errorDetail = String(e).slice(0, 200);
    }

    try {
      const r2 = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST', headers,
        body: JSON.stringify({
          sender: { email: SENDER_EMAIL, name: SENDER_NAME },
          to: [{ email: requesterEmail, name: requesterName || undefined }],
          subject: confirmSubject,
          textContent: confirmText,
        }),
      });
      confirmSent = r2.ok;
    } catch (e) {
      // Confirmation failure is non-fatal — interní lead už proběhl
    }
  } else {
    // Žádný klíč: zalogovat pro audit / pozdější doručení
    console.log('[Preverit] No BREVO_API_KEY — submission logged only:');
    console.log(internalText);
  }

  // Vždy success pro uživatele — interní zpracování může jet asynchronně
  return res.status(200).json({
    success: true,
    message: 'Žádost přijata. Brzy se vám ozveme s PDF reportem.',
    debug: BREVO_API_KEY ? { internalSent, confirmSent, errorDetail } : { reason: 'no-api-key-logged-only' },
  });
}
