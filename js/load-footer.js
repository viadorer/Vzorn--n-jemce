/**
 * load-footer.js - Skript pro načítání patičky webu do všech stránek
 * 
 * Tento skript automaticky načte obsah souboru footer.html do elementu s ID "footer-placeholder".
 * Pro použití stačí:
 * 1. Přidat tento skript do HTML stránky
 * 2. Přidat element s ID "footer-placeholder" tam, kde má být patička zobrazena
 */

document.addEventListener('DOMContentLoaded', function() {
    // Najít element, kam se má vložit footer
    const footerPlaceholder = document.getElementById('footer-placeholder');
    
    if (footerPlaceholder) {
        // Zjistit relativní cestu k root adresáři
        let pathToRoot = '';
        const pathParts = window.location.pathname.split('/');
        const depth = pathParts.length - 1;
        
        // Pokud jsme v podsložce, potřebujeme cestu zpět do kořene
        if (depth > 1) {
            // Odečteme 1, protože první lomítko vytvoří prázdný element
            for (let i = 0; i < depth - 1; i++) {
                pathToRoot += '../';
            }
        }
        
        // Načíst footer pomocí fetch API
        fetch(pathToRoot + 'footer.html')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Nepodařilo se načíst footer');
                }
                return response.text();
            })
            .then(html => {
                footerPlaceholder.innerHTML = html;
            })
            .catch(error => {
                console.error('Chyba při načítání footeru:', error);
                footerPlaceholder.innerHTML = '<p>Nepodařilo se načíst patičku webu.</p>';
            });
    } else {
        console.warn('Element s ID "footer-placeholder" nebyl nalezen. Footer nebude načten.');
    }
});
