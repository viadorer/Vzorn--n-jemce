// Vercel serverless function — proxy na PTF backend pro výpis nabídek
// ENV vars potřebné na Vercelu:
//   PTF_BACKEND_URL = https://api.ptf.cz   (nebo Railway URL)
//   PTF_TENANT_SLUG = ptf-reality

const BACKEND = process.env.PTF_BACKEND_URL || 'https://ptf-production.up.railway.app';
const TENANT  = process.env.PTF_TENANT_SLUG || 'ptf-reality';

const ALLOWED_FILTERS = new Set([
  'offer_type', 'property_type', 'property_subtype', 'city', 'district', 'disposition',
  'price_min', 'price_max', 'area_min', 'area_max',
  'features', 'agent_id', 'status', 'search', 'is_featured',
  'page', 'limit', 'sort'
]);

export default async function handler(req, res) {
  // CORS — vzornynajemce + lokální dev
  const origin = req.headers.origin || '';
  const allowedOrigins = [
    'https://www.vzornynajemce.cz',
    'https://vzornynajemce.cz',
    'http://localhost:3000',
    'http://localhost:8000',
    'http://127.0.0.1:8000',
  ];
  // Vercel preview deploymenty (*.vercel.app)
  const isVercelPreview = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);
  if (allowedOrigins.includes(origin) || isVercelPreview) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Whitelist query params
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query || {})) {
    if (ALLOWED_FILTERS.has(k) && v != null && v !== '') {
      params.set(k, String(v));
    }
  }
  // Default: vzornynajemce = pronájmy
  if (!params.has('offer_type')) params.set('offer_type', 'pronajem');
  if (!params.has('limit')) params.set('limit', '12');

  const url = `${BACKEND}/api/properties?${params.toString()}`;

  try {
    const upstream = await fetch(url, {
      headers: {
        'X-Tenant-Slug': TENANT,
        'Accept': 'application/json',
      },
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '');
      console.error('PTF backend error:', upstream.status, text.slice(0, 200));
      return res.status(502).json({ error: 'Backend nedostupný', status: upstream.status });
    }

    const data = await upstream.json();
    // Edge cache 60s, SWR 5 min
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json(data);
  } catch (err) {
    console.error('Properties proxy error:', err);
    return res.status(500).json({ error: 'Chyba při načítání nabídek' });
  }
}
