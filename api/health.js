// api/health.js
// Diagnostika: říká, které ENV vars jsou nastavené a v jakém stavu je ISPIS.
// Nikdy nevrací hodnoty — jen boolean set/missing.
//
// Autorizace: veřejný endpoint, ale bez citlivých údajů.
// GET /api/health           → základní status
// GET /api/health?full=1    → rozšířený stav ISPIS (jen v Preview / Development)

import { getState as ispisState, isEnabled as ispisEnabled, isConfigured as ispisConfigured } from './_ispis.js';

function present(name) {
    const v = process.env[name];
    return typeof v === 'string' && v.length > 0;
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const full = req.query && req.query.full;
    const isProduction = process.env.VERCEL_ENV === 'production';

    const status = {
        ok: true,
        time: new Date().toISOString(),
        vercelEnv: process.env.VERCEL_ENV || 'unknown',
        nodeEnv: process.env.NODE_ENV || 'unknown',
        env: {
            BREVO_API_KEY: present('BREVO_API_KEY'),
            ACCESS_LINK_SECRET: present('ACCESS_LINK_SECRET'),
            ISPIS_USERNAME: present('ISPIS_USERNAME'),
            ISPIS_PASSWORD: present('ISPIS_PASSWORD'),
            ISPIS_ENABLED: process.env.ISPIS_ENABLED === 'true',
            PTF_BACKEND_URL: present('PTF_BACKEND_URL'),
            PTF_TENANT_SLUG: present('PTF_TENANT_SLUG'),
        },
        ispis: {
            enabled: ispisEnabled(),
            configured: ispisConfigured(),
        },
    };

    // Rozšířený stav jen pro non-production (aby produkce neukazovala interní stav)
    if (full && !isProduction) {
        status.ispis = { ...status.ispis, ...ispisState() };
    }

    return res.status(200).json(status);
}
