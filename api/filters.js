// Vercel serverless function — proxy na PTF backend pro filter options (města, dispozice, ...)
// Volá: GET /api/filters?offer_type=pronajem
// Backend: GET /api/properties/filters s headerem X-Tenant-Slug

const BACKEND = process.env.PTF_BACKEND_URL || 'https://ptf-production.up.railway.app';
const TENANT  = process.env.PTF_TENANT_SLUG || 'ptf-reality';

const ALLOWED_KEYS = new Set([
  'offer_type', 'property_type', 'city', 'district', 'property_subtype',
]);

export default async function handler(req, res) {
  const origin = req.headers.origin || '';
  const allowedOrigins = [
    'https://www.vzornynajemce.cz',
    'https://vzornynajemce.cz',
    'http://localhost:3000',
    'http://localhost:8000',
    'http://127.0.0.1:8000',
  ];
  const isVercelPreview = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);
  if (allowedOrigins.includes(origin) || isVercelPreview) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query || {})) {
    if (ALLOWED_KEYS.has(k) && v != null && v !== '') params.set(k, String(v));
  }
  if (!params.has('offer_type')) params.set('offer_type', 'pronajem');

  const url = `${BACKEND}/api/properties/filters?${params.toString()}`;

  try {
    const upstream = await fetch(url, {
      headers: { 'X-Tenant-Slug': TENANT, 'Accept': 'application/json' },
    });

    if (!upstream.ok) {
      return res.status(502).json({ error: 'Backend nedostupný', status: upstream.status });
    }

    const data = await upstream.json();
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=1800');
    return res.status(200).json(data);
  } catch (err) {
    console.error('Filters proxy error:', err);
    return res.status(500).json({ error: 'Chyba při načítání filtrů' });
  }
}
