/**
 * load-popup.js — Načte sdílený kontaktní popup (contact-popup.html)
 * a inicializuje globální window.ContactPopup { open, close }.
 *
 * Použití:
 *   1. <div id="popup-placeholder"></div>  na konec body
 *   2. <script src="js/load-popup.js"></script>
 *   3. Tlačítka s atributem data-open-popup se automaticky propojí.
 *
 * Pokud window.ContactPopup už existuje (stránka má vlastní inline popup —
 * např. index.html), skript se ukončí a nepřepíše existující.
 */
(function () {
    'use strict';

    if (window.ContactPopup) return;

    const placeholder = document.getElementById('popup-placeholder');
    if (!placeholder) return;

    function buildCandidateUrls() {
        var urls = [];
        if (location.protocol === 'http:' || location.protocol === 'https:') {
            urls.push('/contact-popup.html');
            urls.push(new URL('contact-popup.html', location.origin + location.pathname).toString());
        }
        var parts = location.pathname.replace(/\\+/g, '/').split('/').filter(Boolean);
        var depth = parts.length > 0 && /\.\w+$/.test(parts[parts.length - 1]) ? parts.length - 1 : parts.length;
        var prefix = '';
        for (var i = 0; i < depth; i++) prefix += '../';
        urls.push(prefix + 'contact-popup.html');
        if (location.protocol === 'file:') urls.push('contact-popup.html');
        return Array.from(new Set(urls));
    }

    function tryFetch(urls) {
        if (!urls.length) return Promise.reject(new Error('Popup not found'));
        var first = urls[0];
        var rest = urls.slice(1);
        return fetch(first, { cache: 'no-cache' })
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
            .catch(function () { return rest.length ? tryFetch(rest) : Promise.reject(new Error('Popup load failed')); });
    }

    function defineContactPopup() {
        var widgetContainerId = 'f-24-68ad80a8296783256b609ecdeff8aa3e';

        function resetWidget() {
            var old = document.getElementById(widgetContainerId);
            if (!old) return;
            var parent = old.parentElement;
            old.remove();
            var fresh = document.createElement('div');
            fresh.id = widgetContainerId;
            fresh.className = 'w-full h-full contact-embed';
            parent.appendChild(fresh);
            try { if (typeof window.ecmwidget === 'function') window.ecmwidget('init'); } catch (_) {}
        }

        window.ContactPopup = {
            _dialog: null,
            get dialog() {
                if (!this._dialog) this._dialog = document.getElementById('contact-dialog');
                return this._dialog;
            },
            open: function () {
                var d = this.dialog;
                if (!d) return;
                if (typeof d.showModal === 'function') d.showModal();
                else d.setAttribute('open', '');
                document.body.classList.add('overflow-hidden');
            },
            close: function () {
                var d = this.dialog;
                if (!d) return;
                if (typeof d.close === 'function') d.close();
                else d.removeAttribute('open');
                document.body.classList.remove('overflow-hidden');
            },
        };

        var dialog = document.getElementById('contact-dialog');
        if (dialog) {
            dialog.addEventListener('close', function () {
                document.body.classList.remove('overflow-hidden');
            });
            dialog.addEventListener('click', function (e) {
                if (e.target === dialog) window.ContactPopup.close();
            });
        }

        // Delegated handler: zavírání křížkem + interakce uvnitř embed widgetu
        document.addEventListener('click', function (e) {
            var closeBtn = e.target.closest('[data-popup-close]');
            if (closeBtn) { e.preventDefault(); window.ContactPopup.close(); return; }

            var widgetBtn = e.target.closest('.contact-embed button, .contact-embed a');
            if (widgetBtn) {
                var label = (widgetBtn.textContent || '').trim();
                if (label.indexOf('Zpět na stránku') === 0) {
                    e.preventDefault();
                    window.ContactPopup.close();
                    setTimeout(resetWidget, 50);
                }
            }
        });
    }

    function bindOpeners() {
        document.querySelectorAll('[data-open-popup]').forEach(function (btn) {
            if (btn._popupBound) return;
            btn._popupBound = true;
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                window.ContactPopup && window.ContactPopup.open();
            });
        });
        // Listen for late-added buttons (e.g. rendered by listings.js)
        window.addEventListener('open-contact-popup', function () {
            window.ContactPopup && window.ContactPopup.open();
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        tryFetch(buildCandidateUrls())
            .then(function (html) {
                placeholder.innerHTML = html;
                // Execute any <script> elements that were just injected
                placeholder.querySelectorAll('script').forEach(function (oldScript) {
                    var newScript = document.createElement('script');
                    if (oldScript.src) newScript.src = oldScript.src;
                    else newScript.textContent = oldScript.textContent;
                    oldScript.parentNode.replaceChild(newScript, oldScript);
                });
                defineContactPopup();
                bindOpeners();
            })
            .catch(function (err) {
                console.error('Nepodařilo se načíst kontaktní popup:', err);
            });
    });
})();
