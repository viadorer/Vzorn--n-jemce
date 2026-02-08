# Nastavení EmailJS pro odesílání výsledků bonity

## 1. Registrace (zdarma)
1. Jděte na https://www.emailjs.com a vytvořte účet
2. Zdarma: **200 emailů/měsíc**

## 2. Propojení emailu (Email Service)
1. Dashboard > **Email Services** > Add New Service
2. Vyberte **Gmail** (nebo jiný provider)
3. Přihlaste se svým emailem (např. vzornynajemce@ptf.cz)
4. Zapamatujte si **Service ID** (např. `service_abc123`)

## 3. Vytvoření šablony (Email Template)
1. Dashboard > **Email Templates** > Create New Template
2. **To Email**: `{{to_email}}`
3. **Subject**: `Vyhodnocení bonity nájemníka – {{tenant_name}} ({{date}})`
4. **Content** (zkopírujte):

```
Vyhodnocení bonity nájemníka
============================

Datum: {{date}}
Nájemník: {{tenant_name}}

SKÓRE BONITY: {{score}} / 100 – {{score_text}}

Základní údaje:
- Měsíční nájemné: {{monthly_rent}}
- Hlavní příjem: {{main_income}}
- Typ zaměstnání: {{employment_type}}

Klíčové ukazatele:
- Poměr nájmu k příjmu: {{rent_to_income}}
- Disponibilní příjem: {{disposable_income}}
- Finanční rezerva: {{reserve_months}} měsíců
- Rizikové skóre: {{risk_score}}
- Kontrola v rejstřících: {{registry_status}}

Doporučení:
{{recommendations}}

Rizikové faktory:
{{risk_factors}}

---
Tento report byl vygenerován kalkulačkou bonity na vzornynajemce.cz
Výpočty jsou pouze orientační. Pro garantovaný nájem kontaktujte Vzorný nájemce.
```

5. Uložte šablonu a zapamatujte si **Template ID** (např. `template_xyz789`)

## 4. Získání Public Key
1. Dashboard > **Account** > API Keys
2. Zkopírujte **Public Key** (např. `user_AbCdEfGh123`)

## 5. Vyplnění v kódu
Otevřete `bonita_najemnika.html` a najděte tyto 3 řádky (cca řádek 1475):

```javascript
var EMAILJS_PUBLIC_KEY = 'VASE_PUBLIC_KEY';
var EMAILJS_SERVICE_ID = 'VASE_SERVICE_ID';
var EMAILJS_TEMPLATE_ID = 'VASE_TEMPLATE_ID';
```

Nahraďte je svými hodnotami:

```javascript
var EMAILJS_PUBLIC_KEY = 'user_AbCdEfGh123';
var EMAILJS_SERVICE_ID = 'service_abc123';
var EMAILJS_TEMPLATE_ID = 'template_xyz789';
```

## 6. Zabezpečení (doporučeno)
1. Dashboard > Account > **Allowed Origins**
2. Přidejte svou doménu: `https://vasestranka.github.io`
3. Tím zajistíte, že API klíč funguje jen z vaší stránky

## Hotovo!
Po vyplnění 3 hodnot bude tlačítko "Odeslat výsledky na email" v kalkulačce bonity funkční.
