// Vercel serverless function — proxy na PTF backend pro detail článku.
// Volá: GET /api/blog-post?slug=<slug>
// Backend: GET /api/blog/:slug?web=vzornynajemce s headerem X-Tenant-Slug

const BACKEND = process.env.PTF_BACKEND_URL || 'https://ptf-production.up.railway.app';
const TENANT  = process.env.PTF_TENANT_SLUG || 'ptf-reality';
const WEB     = 'vzornynajemce';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const slug = (req.query?.slug || '').toString().trim();
  if (!slug || !/^[a-z0-9-]{1,200}$/i.test(slug)) {
    return res.status(400).json({ error: 'Neplatný slug' });
  }

  try {
    const upstream = await fetch(
      `${BACKEND}/api/blog/${encodeURIComponent(slug)}?web=${WEB}`,
      { headers: { 'X-Tenant-Slug': TENANT, Accept: 'application/json' } },
    );
    if (upstream.status === 404) return res.status(404).json({ error: 'Článek nenalezen' });
    if (!upstream.ok) {
      console.error('PTF backend error:', upstream.status);
      return res.status(502).json({ error: 'Backend nedostupný' });
    }
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
    return res.status(200).json(await upstream.json());
  } catch (err) {
    console.error('Blog post proxy error:', err?.message);
    return res.status(502).json({ error: 'Backend nedostupný' });
  }
}
