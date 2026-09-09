// Vercel serverless function — příjem žádostí o bezplatné prověření zájemce o nájem
// ENV vars:
//   BREVO_API_KEY — pro odesílání transactional e-mailů
//   SCREENING_RECIPIENT_EMAIL — kam chodí interní notifikace (default: kontakt@vzornynajemce.cz)
//   SCREENING_FROM_EMAIL — adresa odesílatele (default: noreply@vzornynajemce.cz)
//
// Pokud BREVO_API_KEY není nastaven, funkce se nezhroutí — submise se zaloguje do Vercel logs
// a vrátí se success. Tím se forms na frontu neblokuje při nedokončeném setupu.

const BREVO_API_KEY = process.env.BREVO_API_KEY;
// Pozor: nepoužíváme ENV var pro sender/recipient — na Vercelu byl v ENV překlep
// (vzronynajemce.cz místo vzornynajemce.cz), který způsoboval odmítnutí odesílání
// v Brevo. Adresy jsou zafixované zde.
const RECIPIENT = 'kontakt@vzornynajemce.cz';
const SENDER_EMAIL = 'kontakt@vzornynajemce.cz';
const SENDER_NAME = 'Vzorný nájemce — Prověření zájemce';

// Verifikace přístupového tokenu (magic link z /api/preverit-request-access)
import crypto from 'crypto';
import { lustraceSearchSubject, summarize, isConfigured as ispisConfigured, isEnabled as ispisEnabled, getState as ispisState } from './_ispis.js';
import { generateReport } from './_pdf-report.js';

// ---- Rate limit vůči zneužití /api/preverit-zajemce ----
// Module-level, přežívá mezi warm invocations. Pro chladný start toleruje bezvadně.
const RL_IP_MAX_PER_HOUR = parseInt(process.env.PREVERIT_RL_IP_PER_HOUR || '5', 10);
const RL_EMAIL_MAX_PER_DAY = parseInt(process.env.PREVERIT_RL_EMAIL_PER_DAY || '3', 10);
const _rlHits = new Map(); // key -> number[] (timestamps ms)

function rlCheck(key, windowMs, max) {
  const now = Date.now();
  const hits = (_rlHits.get(key) || []).filter(t => now - t < windowMs);
  if (hits.length >= max) {
    _rlHits.set(key, hits);
    return { ok: false, retryInMs: windowMs - (now - hits[0]) };
  }
  hits.push(now);
  _rlHits.set(key, hits);
  return { ok: true };
}
const ACCESS_LINK_SECRET = process.env.ACCESS_LINK_SECRET || 'dev-only-secret-please-set-in-vercel-env';

function verifyAccessToken(email, token) {
  if (typeof email !== 'string' || !email || typeof token !== 'string' || !token) return { ok: false, reason: 'missing' };
  const parts = token.split('.');
  if (parts.length !== 2) return { ok: false, reason: 'malformed' };
  const [expStr, sig] = parts;
  const exp = parseInt(expStr, 10);
  if (!Number.isFinite(exp)) return { ok: false, reason: 'malformed' };
  if (exp * 1000 < Date.now()) return { ok: false, reason: 'expired' };
  const payload = `${email.toLowerCase()}:${exp}`;
  const expected = crypto.createHmac('sha256', ACCESS_LINK_SECRET).update(payload).digest('hex').slice(0, 32);
  const a = Buffer.from(sig, 'utf-8');
  const b = Buffer.from(expected, 'utf-8');
  if (a.length !== b.length) return { ok: false, reason: 'invalid' };
  if (!crypto.timingSafeEqual(a, b)) return { ok: false, reason: 'invalid' };
  return { ok: true, expiresAt: exp };
}

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

  // Rate limit: per IP a per e-mail — chrání ISPIS quotu i naši Brevo quotu.
  const clientIp = String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown').split(',')[0].trim();
  const rlIp = rlCheck(`ip:${clientIp}`, 3600 * 1000, RL_IP_MAX_PER_HOUR);
  if (!rlIp.ok) {
    return res.status(429).json({
      error: 'Příliš mnoho požadavků z této IP adresy',
      details: [`Zkuste to znovu za ${Math.ceil(rlIp.retryInMs / 60000)} min. Pokud potřebujete prověřit více zájemců, napište na kontakt@vzornynajemce.cz.`]
    });
  }
  const rlEmail = rlCheck(`email:${String(data.requester_email || '').trim().toLowerCase()}`, 24 * 3600 * 1000, RL_EMAIL_MAX_PER_DAY);
  if (!rlEmail.ok) {
    return res.status(429).json({
      error: 'Denní limit prověření na e-mail dosažen',
      details: [`Bezplatné prověření je 1× denně na e-mail. Pro víc kontaktů napište na kontakt@vzornynajemce.cz.`]
    });
  }

  // Ověření přístupového tokenu (pokud byl poslán z email-gate flow)
  const accessEmail = String(data.access_email || '').trim().toLowerCase();
  const accessToken = String(data.access_token || '').trim();
  let accessVerified = false;
  if (accessEmail || accessToken) {
    const v = verifyAccessToken(accessEmail, accessToken);
    if (!v.ok) {
      return res.status(401).json({
        error: 'Přístupový odkaz vypršel nebo je neplatný',
        details: ['Vyžádejte si nový přístupový odkaz na /preverit-zajemce.']
      });
    }
    // e-mail majitele musí odpovídat tokenu (chrání proti recyklaci)
    if (accessEmail && accessEmail !== requesterEmail) {
      return res.status(401).json({
        error: 'E-mail v odkazu se neshoduje s e-mailem majitele',
        details: ['Použijte e-mail, na který jsme poslali přístupový odkaz.']
      });
    }
    accessVerified = true;
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
    '  na adrese kontakt@vzornynajemce.cz.',
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

  // ---- Auto-lustrace přes ISPIS (defense-in-depth pojistky v _ispis.js) ----
  // Voláme paralelně proti insolvenčnímu rejstříku (ISIR) a evidenci exekucí (CEE).
  // Selhání není fatální — mail chodí i tak. Kill-switch ISPIS_ENABLED=false skipne.
  let ispisText = '';
  let ispisSummary = null;
  let ispisAlert = null;
  if (!ispisEnabled()) {
    ispisText = '\nAUTOMATICKÁ LUSTRACE: ISPIS_ENABLED je vypnutý (kill-switch) — prověření je manuální.\n';
  } else if (!ispisConfigured()) {
    ispisText = '\nAUTOMATICKÁ LUSTRACE: ISPIS_USERNAME/PASSWORD chybí — prověření je manuální.\n';
  } else {
    // Formát datumu pro ISPIS: dd.MM.yyyy
    let narozen = '';
    if (candidateDob && /^\d{4}-\d{2}-\d{2}$/.test(candidateDob)) {
      const [y, m, d] = candidateDob.split('-');
      narozen = `${d}.${m}.${y}`;
    }
    const nameParts = candidateName.split(/\s+/);
    const firstName = nameParts.slice(0, -1).join(' ') || nameParts[0] || '';
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
    const subject = type === 'fyzicka'
      ? { Jmeno: firstName, Prijmeni: lastName, Narozen: narozen }
      : { IC: candidateIc };

    const profiles = type === 'fyzicka' ? ['ISIR', 'CEE'] : ['ISIR', 'Zakladni'];
    try {
      const results = await Promise.allSettled(
        profiles.map(p => lustraceSearchSubject(subject, p).then(r => ({ profile: p, ...r })))
      );
      ispisSummary = results.map(r => r.status === 'fulfilled' ? r.value : { profile: '?', ok: false, error: String(r.reason) });

      // Detekce alarmních stavů (aby PTF věděl v subjectu e-mailu)
      const blocked = ispisSummary.filter(r => r.blocked);
      const costCapHit = ispisSummary.some(r => r.costCapExceeded);
      const hasRecord = ispisSummary.some(r => r.ok && summarize(r).hasRecord);
      if (blocked.length) ispisAlert = `ISPIS BLOCKED: ${blocked.map(r => r.blocked).join(', ')}`;
      else if (costCapHit) ispisAlert = 'ISPIS: cena za lustraci přesáhla limit';
      else if (hasRecord) ispisAlert = 'Zájemce má záznam — zkontrolovat!';

      const state = ispisState();
      ispisText = [
        '',
        'AUTOMATICKÁ LUSTRACE (ISPIS)',
        '=================================================',
        ...ispisSummary.map(r => {
          const s = summarize(r);
          return `  ${r.profile}: ${s.summary}`;
        }),
        '',
        `  Stav quoty: ${state.dailyCount}/${state.dailyLimit} volání dnes · zůstatek ${state.currentBalanceKc ?? '?'} Kč · min ${state.minBalanceKc} Kč`,
        state.killedByFloor ? '  ⚠️ ISPIS zablokován balance floor pro tuto instanci!' : '',
        '',
        '  RAW JSON v Vercel Function logs (Deployments → Functions → preverit-zajemce).',
      ].filter(Boolean).join('\n');
    } catch (e) {
      ispisText = `\nAUTOMATICKÁ LUSTRACE (ISPIS): SELHALA — ${String(e).slice(0, 200)}\n`;
    }
  }

  // ---- Vygenerovat PDF report (fire-and-forget, ale zaručíme dokončení před e-mailem) ----
  let pdfBase64 = null;
  let pdfError = null;
  try {
    const pdfBuffer = await generateReport({
      candidate: {
        type,
        name: candidateName,
        dob: candidateDob,
        ic: candidateIc,
        address: candidateAddress,
      },
      requester: {
        name: requesterName,
        email: requesterEmail,
        phone: requesterPhone,
        propertyLocation,
      },
      lustrace: ispisSummary || [],
    });
    pdfBase64 = pdfBuffer.toString('base64');
  } catch (e) {
    pdfError = String(e).slice(0, 200);
    console.warn('[Preverit] PDF generation failed:', pdfError);
  }

  const pdfAttachment = pdfBase64 ? [{
    name: `preverit-${candidateName.replace(/[^A-Za-zÀ-ž0-9 ]+/g, '').replace(/\s+/g, '-').slice(0, 40) || 'zajemce'}.pdf`,
    content: pdfBase64,
  }] : undefined;

  // ---- Send via Brevo (or skip if not configured) ----
  let internalSent = false, confirmSent = false, errorDetail = null;
  const internalTextWithIspis = internalText + '\n' + ispisText + (pdfError ? `\n\n[PDF] Generace selhala: ${pdfError}` : '\n\n[PDF] V příloze — profi report s brandingem.');

  if (BREVO_API_KEY) {
    const headers = {
      'Content-Type': 'application/json',
      'api-key': BREVO_API_KEY,
      'accept': 'application/json',
    };
    try {
      const alertedSubject = ispisAlert ? `⚠️ ${ispisAlert} — ${internalSubject}` : internalSubject;
      const r1 = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST', headers,
        body: JSON.stringify({
          sender: { email: SENDER_EMAIL, name: SENDER_NAME },
          to: [{ email: RECIPIENT }],
          replyTo: { email: requesterEmail, name: requesterName || requesterEmail },
          subject: alertedSubject,
          textContent: internalTextWithIspis,
          ...(pdfAttachment ? { attachment: pdfAttachment } : {}),
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
    console.log(internalTextWithIspis);
  }

  // Vždy success pro uživatele — interní zpracování může jet asynchronně
  return res.status(200).json({
    success: true,
    message: 'Žádost přijata. Brzy se vám ozveme s PDF reportem.',
    debug: BREVO_API_KEY
      ? { internalSent, confirmSent, errorDetail, ispis: ispisSummary ? ispisSummary.map(r => ({ profile: r.profile, ok: r.ok, error: r.error })) : null }
      : { reason: 'no-api-key-logged-only' },
  });
}
