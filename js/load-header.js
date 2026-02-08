/**
 * load-header.js - Skript pro načítání hlavičky webu do všech stránek
 * 
 * Použití:
 * 1. Přidat <div id="header-placeholder"></div> na začátek body
 * 2. Přidat <script src="js/load-header.js"></script>
 */

document.addEventListener('DOMContentLoaded', function() {
    var placeholder = document.getElementById('header-placeholder');
    if (!placeholder) return;

    function buildCandidateUrls() {
        var urls = [];
        if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
            urls.push('/header.html');
            urls.push(new URL('header.html', window.location.origin + window.location.pathname).toString());
        }
        var pathParts = window.location.pathname.replace(/\\+/g, '/').split('/').filter(Boolean);
        var depth = pathParts.length > 0 && /\.\w+$/.test(pathParts[pathParts.length - 1]) ? pathParts.length - 1 : pathParts.length;
        var pathToRoot = '';
        for (var i = 0; i < depth; i++) pathToRoot += '../';
        urls.push(pathToRoot + 'header.html');
        if (window.location.protocol === 'file:') urls.push('header.html');
        return urls.filter(function(v, i, a) { return a.indexOf(v) === i; });
    }

    function tryFetch(urls) {
        if (!urls.length) return Promise.reject(new Error('Header not found'));
        var first = urls[0];
        var rest = urls.slice(1);
        return fetch(first, { cache: 'no-cache' })
            .then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
            .catch(function() { return rest.length ? tryFetch(rest) : Promise.reject(new Error('All attempts failed')); });
    }

    tryFetch(buildCandidateUrls())
        .then(function(html) {
            placeholder.innerHTML = html;
            // Re-init Alpine on injected header if Alpine is available
            if (window.Alpine) {
                Alpine.initTree(placeholder);
            }
            // Attach popup openers in header
            placeholder.querySelectorAll('[data-open-popup]').forEach(function(btn) {
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    if (window.ContactPopup) ContactPopup.open();
                });
            });
            // Fix image paths for subfolders
            var depth = window.location.pathname.replace(/\\+/g, '/').split('/').filter(Boolean);
            if (depth.length > 1 && /\.\w+$/.test(depth[depth.length - 1])) depth.pop();
            if (depth.length > 0) {
                var prefix = '';
                for (var i = 0; i < depth.length; i++) prefix += '../';
                placeholder.querySelectorAll('img[src^="images/"]').forEach(function(img) {
                    img.src = prefix + img.getAttribute('src');
                });
                placeholder.querySelectorAll('a[href^="index.html"]').forEach(function(a) {
                    a.href = prefix + a.getAttribute('href');
                });
                placeholder.querySelectorAll('a[href^="blog/"]').forEach(function(a) {
                    a.href = prefix + a.getAttribute('href');
                });
                placeholder.querySelectorAll('a[href="/"]').forEach(function(a) {
                    a.href = prefix + 'index.html';
                });
            }
        })
        .catch(function(err) {
            console.error('Chyba při načítání headeru:', err);
        });
});
