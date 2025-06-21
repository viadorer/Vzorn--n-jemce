#!/bin/bash

# Skript pro aktualizaci všech HTML souborů - nahrazení původního footeru zástupným elementem
# a přidání skriptu pro načítání footeru

# Seznam HTML souborů kromě footer.html
HTML_FILES=$(find . -name "*.html" -type f -not -path "./footer.html")

# Vzor pro vyhledání začátku a konce footeru
FOOTER_START="<!-- Footer -->"
FOOTER_END="</footer>"

# Nový kód, který nahradí původní footer
REPLACEMENT='<!-- Footer -->
<div id="footer-placeholder"></div>

<!-- Skript pro načítání footeru -->
<script src="js/load-footer.js"></script>'

# Funkce pro relativní cestu k js/load-footer.js
get_relative_path() {
    local file_path=$1
    local dir_depth=$(echo "$file_path" | tr -cd '/' | wc -c)
    
    # Odečteme 1, protože cesta začíná ./
    dir_depth=$((dir_depth - 1))
    
    if [ $dir_depth -eq 0 ]; then
        echo "js/load-footer.js"
    else
        local path=""
        for ((i=0; i<dir_depth; i++)); do
            path="../$path"
        done
        echo "${path}js/load-footer.js"
    fi
}

# Procházení všech HTML souborů
for file in $HTML_FILES; do
    echo "Zpracovávám soubor: $file"
    
    # Získání relativní cesty k js/load-footer.js
    rel_path=$(get_relative_path "$file")
    
    # Vytvoření náhrady s relativní cestou
    replacement_with_path="${FOOTER_START}
<div id=\"footer-placeholder\"></div>

<!-- Skript pro načítání footeru -->
<script src=\"$rel_path\"></script>"
    
    # Kontrola, zda soubor obsahuje footer
    if grep -q "$FOOTER_START" "$file"; then
        # Vytvoření dočasného souboru
        awk -v footer_start="$FOOTER_START" -v replacement="$replacement_with_path" '
        BEGIN {
            found_start = 0;
            found_end = 0;
        }
        {
            if ($0 ~ footer_start && found_start == 0) {
                found_start = 1;
                print replacement;
            }
            else if (found_start == 1 && $0 ~ "</footer>") {
                found_start = 0;
                found_end = 1;
            }
            else if (found_start == 0) {
                print $0;
            }
        }' "$file" > "${file}.tmp"
        
        # Přesun dočasného souboru zpět
        mv "${file}.tmp" "$file"
        echo "  Footer byl aktualizován v souboru $file"
    else
        echo "  Soubor $file neobsahuje footer, přeskakuji..."
    fi
done

echo "Aktualizace footerů dokončena!"
