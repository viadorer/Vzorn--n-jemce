/**
 * load-footer.js - Skript pro načítání patičky webu do všech stránek
 * 
 * Tento skript automaticky načte obsah souboru footer.html do elementu s ID "footer-placeholder".
 * Pro použití stačí:
 * 1. Přidat tento skript do HTML stránky
 * 2. Přidat element s ID "footer-placeholder" tam, kde má být patička zobrazena
 */

document.addEventListener('DOMContentLoaded', function() {
    const footerPlaceholder = document.getElementById('footer-placeholder');

    if (!footerPlaceholder) {
        console.warn('Element s ID "footer-placeholder" nebyl nalezen. Footer nebude načten.');
        return;
    }

    // Vytvoří seznam možných URL pro načtení footeru v různých prostředích
    function buildCandidateUrls() {
        const urls = [];
        // 1) Absolutní cesta z kořene domény (funguje při nasazení v kořeni)
        if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
            urls.push('/footer.html');
            urls.push(new URL('footer.html', window.location.origin + window.location.pathname).toString());
        }

        // 2) Relativní cesta vypočtená dle hloubky (funguje v podsložkách)
        let pathToRoot = '';
        // odečteme prázdný první segment za počáteční lomítko a případný soubor na konci
        const pathParts = window.location.pathname.replace(/\\+/g, '/').split('/').filter(Boolean);
        const depth = pathParts.length > 0 && /\.\w+$/.test(pathParts[pathParts.length - 1]) ? pathParts.length - 1 : pathParts.length;
        for (let i = 0; i < Math.max(depth - 0, 0); i++) { // depth úrovní zpět
            pathToRoot += '../';
        }
        urls.push(pathToRoot + 'footer.html');

        // 3) file:// prostředí – zkusit prostou relativní cestu
        if (window.location.protocol === 'file:') {
            urls.push('footer.html');
        }

        // Odstranit duplicity při zachování pořadí
        return Array.from(new Set(urls));
    }

    function tryFetchSequential(urls) {
        if (!urls.length) {
            throw new Error('Žádné dostupné cesty pro načtení footeru');
        }
        const [first, ...rest] = urls;
        return fetch(first, { cache: 'no-cache' })
            .then(resp => {
                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                return resp.text();
            })
            .catch(() => {
                if (rest.length) return tryFetchSequential(rest);
                throw new Error('Všechny pokusy o načtení footeru selhaly');
            });
    }

    tryFetchSequential(buildCandidateUrls())
        .then(html => {
            footerPlaceholder.innerHTML = html;
        })
        .catch(error => {
            console.error('Chyba při načítání footeru:', error);
            footerPlaceholder.innerHTML = '<p>Nepodařilo se načíst patičku webu.</p>';
        });
});
