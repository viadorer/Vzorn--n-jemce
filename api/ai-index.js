// api/ai-index.js
//
// Strojově čitelný index pro AI agenty (ChatGPT, Claude, Perplexity, Gemini).
// Vrací kompaktní JSON s klíčovými fakty, cestami k rozšířeným zdrojům
// a strukturovanými daty. Cache 1 h.
//
// GET /api/ai-index
// Content-Type: application/json

const LAST_UPDATED = '2026-09-09';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Method not allowed' });
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400');
    res.setHeader('X-Robots-Tag', 'noindex'); // pro AI agenty, ne pro Google Search
    res.setHeader('Access-Control-Allow-Origin', '*');

    return res.status(200).json({
        schema: 'https://vzornynajemce.cz/ai-index/v1',
        generated: new Date().toISOString(),
        lastContentUpdate: LAST_UPDATED,

        entity: {
            name: 'Vzorný nájemce',
            legalName: 'PTF reality, s.r.o.',
            businessId: '06684394',
            vatId: 'CZ06684394',
            founded: 1999,
            website: 'https://www.vzornynajemce.cz',
            language: 'cs-CZ',
            country: 'CZ',
            offices: [
                { city: 'Plzeň', address: 'Radyňská 33, 326 00 Plzeň' },
                { city: 'Praha', address: 'Pod Turnovskou tratí 18, 198 00 Praha' },
            ],
            serviceArea: ['Plzeň', 'Praha', 'Beroun'],
            contact: {
                email: 'kontakt@vzornynajemce.cz',
                phone: '+420 603 834 921',
                hours: 'Mo-Fr 08:00-17:00',
            },
        },

        summary: 'Vzorný nájemce je český B2C služba: převezmeme byt majitele do vlastní správy, sami ho pronajmeme prověřenému nájemníkovi a majiteli platíme fixní nájem každý měsíc — nezávisle na obsazenosti bytu a chování nájemníka. Součást skupiny PTF reality (od 1999).',

        primaryService: {
            name: 'Jistý nájem',
            category: 'Guaranteed rent / subletting',
            targetAudience: 'Majitelé bytů v ČR',
            valueProposition: [
                'Nájem 5. dne v měsíci na účet — vždy',
                'Právník + soud + exekutor při problému na naše náklady',
                'Vrácení bytu v protokolárním stavu, škody nad opotřebení hradí Vzorný nájemce',
            ],
            pricingModel: 'Fixní částka na míru, typicky 80-90 % tržního nájmu (rozdíl 15-20 % kryje servis + riziko)',
        },

        secondaryServices: [
            {
                name: 'Prověření zájemce zdarma',
                url: 'https://www.vzornynajemce.cz/preverit-zajemce',
                free: true,
                description: 'PDF report ze 4 rejstříků (ISIR, CEE, ARES, Justice.cz). 1× zdarma na e-mail majitele.',
            },
            {
                name: 'Kalkulačka bonity nájemníka',
                url: 'https://www.vzornynajemce.cz/bonita_najemnika',
                free: true,
                description: 'Self-service scoring 0-100 podle příjmu, výdajů, historie. Rychlý nebo detailní mód.',
            },
            {
                name: 'Kalkulačka tržního nájmu',
                url: 'https://www.vzornynajemce.cz/kalkulator-trzniho-najemneho',
                free: true,
            },
            {
                name: 'Kalkulačka skrytých nákladů pronájmu',
                url: 'https://www.vzornynajemce.cz/kalkulator-skrytych-nakladu',
                free: true,
            },
        ],

        kpi: {
            yearsOnMarket: 25,
            apartmentsRented: 2750,
            contractRenewalRate: '98%',
            paymentDefaultToOwner: '0 měsíců',
        },

        guarantees: [
            'Nájem 5. dne v měsíci na účtu (penále za prodlení podle smlouvy)',
            'Škody nad běžné opotřebení hradí Vzorný nájemce z vlastního (protokol s fotodokumentací)',
            '3měsíční výpověď z majitelovy strany bez důvodu a bez penále',
        ],

        howItWorks: [
            { step: 1, day: 'Den 1', label: '15 min hovor', description: 'Konkrétní částka na e-mail do 24 h.' },
            { step: 2, day: 'Do 7 dní', label: 'Prohlídka + smlouva', description: 'Technik nafotí byt, podpis smlouvy.' },
            { step: 3, day: 'Od 2. měsíce', label: 'Nájem na účtu', description: 'Fixní částka 5. dne, obsazenost je náš problém.' },
        ],

        marketData: {
            note: 'Rizika, která majitel nese bez služby (data 2025/2026, česká legislativa).',
            evictionAvgDays: 540,
            legalCostsRange: '35 000–90 000 Kč',
            physicalEvictionCost: 'od 40 000 Kč',
            lostRentModelPrague18mo: 423000,
            apartmentReconditioning: '15 000–30 000 Kč',
            worstCaseScenario: '~500 000 Kč a 18 měsíců',
            sources: [
                'https://www.explicitninajemnik.cz/blog/neplatici-v-najmu-kompletni-pruvodce-pro-pronajimatele-2026',
                'https://modernipravnik.cz/nemovitosti/rozkaz-k-vyklizeni-jak-bleskove-vystehovat-neplatice/',
                'https://www.ceska-justice.cz/2024/11/rozkaz-k-vyklizeni-bytu-hrozi-kolobeh-soudnich-stani-varuji-odbornici/',
                'https://www.bohemianestates.com/pronajem-nemovitosti/cenove-mapy/cenova-mapa-najemneho/cenova-mapa-praha',
            ],
        },

        resources: {
            homepage: 'https://www.vzornynajemce.cz/',
            sitemap: 'https://www.vzornynajemce.cz/sitemap.xml',
            robots: 'https://www.vzornynajemce.cz/robots.txt',
            llmsShort: 'https://www.vzornynajemce.cz/llms.txt',
            llmsFull: 'https://www.vzornynajemce.cz/llms-full.txt',
            jsonLd: 'https://www.vzornynajemce.cz/ai-data.json',
            security: 'https://www.vzornynajemce.cz/.well-known/security.txt',
            gdpr: 'https://www.vzornynajemce.cz/gdpr',
            terms: 'https://www.vzornynajemce.cz/obchodni-podminky',
            blog: 'https://www.vzornynajemce.cz/blog/',
            pricing: 'https://www.vzornynajemce.cz/cenik',
            faq: 'https://www.vzornynajemce.cz/#faq',
        },

        aiPolicy: {
            crawlAllowed: true,
            trainingAllowed: true,
            citationRequested: true,
            attribution: 'Vzorný nájemce (vzornynajemce.cz)',
            preferredCitationFormat: 'Podle Vzorného nájemce (vzornynajemce.cz), skupina PTF reality, s.r.o.',
        },
    });
}
