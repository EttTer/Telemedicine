# Technické předání EasyTelemedicine

Tento dokument popisuje aktuální aplikaci, nikoli právní posudek ani potvrzení připravenosti pro provoz s reálnými pacienty.

## Co lze převzít

Repozitář `EttTer/Telemedicine` obsahuje Next.js 15 aplikaci s Reactem 18 a TypeScriptem, databázové migrace a automatické testy. Hosting nyní zajišťuje Netlify, databázi, přihlášení a soukromé soubory Supabase; videohovory Whereby Embedded. Převzetí vyžaduje dohodu o právech ke kódu a přístupech. Přístup do GitHubu sám nepřevádí účty služeb ani smlouvy.

## Funkční hranice

- Ordinace vytváří konzultace a pacient vstupuje odkazem, vyplní údaje a potvrdí poučení. Odkaz ani tyto údaje samy nepotvrzují totožnost.
- Pracovníci se přihlašují e-mailem a heslem; dvoufaktorové přihlášení není aktivní. Role a ordinace omezují přístup k záznamům.
- Klinický text se ukládá po 5 sekundách bez psaní. Konflikt souběžných verzí zachová rozepsaný text a vyžaduje rozhodnutí uživatele.
- Dokončení ukládá neměnný podklad. Oprava vyžaduje důvod; podklad je určen k přenosu a autorizaci v cílovém systému dokumentace.
- Přílohy PDF/JPG/PNG jsou v soukromém úložišti (nejvýše 3 MB, 10 na konzultaci). Ordinace zpřístupňuje nahrávání. Popis nepozměňuje originál souboru; změna se audituje a po dokončení je blokována.
- Přílohy lze zobrazit přes autentizovaný serverový endpoint. Export obsahuje text a přílohy; zatím není přímé napojení na HealthPro ani ověřený export podle EHDS.
- Přítomnost znamená kontakt čekárny se serverem v posledních 60 sekundách. Neověřuje funkčnost videa. Aplikace automaticky nenahrává hovor.

## Jak spustit a ověřit

1. Použít Node.js 22 a `npm ci`.
2. Doplnit prostředí podle `.env.example`. Privilegovaný klíč Supabase a Whereby klíč patří pouze na server; nezapisovat je do repozitáře ani veřejných proměnných.
3. Pro existující databázi porovnat historii migrací, zálohovat ji a aplikovat jen chybějící migrace v pořadí. Nejstarší migrace předpokládají původní schéma. `supabase/tests/restoration_fixture.sql` slouží pouze jako syntetický testovací základ, nikoli jako produkční instalační migrace. Pro nový samostatný projekt nejprve doplnit a zkontrolovat úplnou inicializační migraci základního schématu.
4. Nastavit URL aplikace (`APP_ORIGIN`), povolené návratové URL Supabase Auth a odpovídající veřejnou adresu. Zkontrolovat Whereby API a životnost místností.
5. Spustit `npm test`, `npm run test:compliance`, `npm run build`. Databázové testy používají lokální PGlite se syntetickými údaji, nikoli živé pacienty.
6. Provést manuální scénář z `DEMO_SCENARIO.md`, zejména skutečné zařízení a dva účastníky hovoru.

## Převod na vlastní infrastrukturu HealthPro

Nejmenší zásah představuje vlastní Supabase projekt při zachování API. Převod na jiný PostgreSQL je možný, vyžaduje však úpravy, protože aplikace používá Supabase Auth, role `anon/authenticated/service_role`, RLS, schéma `auth`, RPC a Storage. Samotný přesun tabulek nestačí.

Při nahrazení Supabase je nutné zachovat ověření pracovníka na serveru, oddělení ordinací, autorizaci každé přílohy, pacientské tokeny a relace, transakční ukládání s kontrolou verze a neměnné dokončené snapshoty. Serverové RPC jsou dostupné pouze servisní roli; nesmějí být zpřístupněny přímo pacientovi nebo anonymnímu klientovi.

Kód serverových rozhraní je v `src/app/api`, databázové workflow v `supabase/migrations`, klientské obrazovky v `src/app` a `src/components`. Textový export vytváří `src/lib/record-text.ts`. Smlouvu budoucího integračního API je třeba navrhnout s HealthPro včetně identifikátorů, oprávnění, přenosu příloh, potvrzení importu a chování při opakovaném požadavku.

## Před provozem s reálnými údaji

Určit provozovatele a odpovědnosti, ověřit smluvní podmínky všech služeb, konfiguraci přístupů, zálohování včetně souborů a obnovu, retenční pravidla a provozní podporu. Projít zabezpečení a právní podmínky skutečného způsobu poskytování péče s příslušnými odborníky. Stav aplikace ani tento dokument takové ověření nenahrazuje.
