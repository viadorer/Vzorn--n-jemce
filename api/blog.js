// Vercel serverless function — proxy na PTF backend pro výpis blogu.
// Volá: GET /api/blog
// Backend: GET /api/blog?web=vzornynajemce s headerem X-Tenant-Slug
//
// Stejný vzor jako na davidchoc.cz: tenant hlavička zůstává na serveru,
// odpověď se cachuje na hraně a mapuje se PŘESNĚ na tvar, se kterým
// odjakživa pracuje js/blog.js — render kód se tak nemusel měnit
// a vzhled výpisu zůstal 1:1 (včetně názvů kategorií pro filtr).

const BACKEND = process.env.PTF_BACKEND_URL || 'https://ptf-production.up.railway.app';
const TENANT  = process.env.PTF_TENANT_SLUG || 'ptf-reality';
const WEB     = 'vzornynajemce';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const upstream = await fetch(`${BACKEND}/api/blog?web=${WEB}&limit=50`, {
      headers: { 'X-Tenant-Slug': TENANT, Accept: 'application/json' },
    });
    if (!upstream.ok) {
      console.error('PTF backend error:', upstream.status);
      return res.status(502).json({ error: 'Backend nedostupný' });
    }
    const data = await upstream.json();

    const posts = (data.data || []).map(p => ({
      id: p.slug,
      title: p.title,
      slug: p.slug,
      date: (p.publishedAt || p.createdAt || '').slice(0, 10),
      readTime: p.readingTimeMinutes ? `${p.readingTimeMinutes} min čtení` : '',
      // Filtr na výpisu porovnává názvy kategorií doslova — PTF je vrací
      // stejné, jaké byly v původních metadatech (import je zachoval).
      category: p.category?.name || 'Ostatní',
      image: p.featuredImageUrl || '/images/og-image.png',
      excerpt: p.excerpt || '',
    }));

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
    return res.status(200).json({ posts });
  } catch (err) {
    console.error('Blog proxy error:', err?.message);
    return res.status(502).json({ error: 'Backend nedostupný' });
  }
}
