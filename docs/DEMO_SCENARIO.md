# Ukázková konzultace – pouze fiktivní údaje

Scénář je určen k demonstraci a manuálnímu ověření. Nepoužívat skutečné pacientské údaje ani skutečné lékařské zprávy. Dosavadní automatické testy nepotvrzují úspěšný hovor na konkrétním telefonu.

## Připravit

Oprávněný účet ordinace, prohlížeč pracovníka a samostatný prohlížeč nebo telefon pacienta, kamera a mikrofon. Testovací příloha obsahuje jen text „FIKTIVNÍ UKÁZKA – NEJDE O ZDRAVOTNÍ DOKUMENTACI“. Bez skutečných identifikátorů. Nechat produkční účty a přístupové odkazy neveřejné.

Pacient: **Eva Ukázková**, datum narození **1. 1. 1990**, kontakt **eva@example.invalid**, důvod **Ukázková kontrola**. Tento kontakt je fiktivní, nepoužívat jej pro doručování.

## Průchod a očekávání

1. Ordinace vytvoří konzultaci a otevře pacientský odkaz ve druhém prohlížeči. Pacient vyplní údaje, přečte poučení a vstoupí do čekárny. Na mobilu zkontrolovat, že formulář nepřetéká vodorovně.
2. Ordinace požádá o dokumenty. Pacient nahraje ukázkové PDF nebo obrázek. Nový soubor se zobrazí během dalšího obnovení, dostane označení „Nově nahráno“, náhled a čas/context nahrání.
3. Lékař upraví popis na „Ukázkový dokument“. Původní název zůstane viditelný. Vyzkoušet náhled a stažení, u PDF také náhradní stažení v prohlížeči bez vestavěného prohlížeče PDF.
4. Zahájit hovor. Pacient se připojí a lékař jej vpustí. Na obou zařízeních skutečně ověřit zvuk a obraz. Zapsat použitý telefon/prohlížeč a výsledek. Stav čekárny neslouží jako důkaz funkčnosti videa.
5. Do poznámek napsat „Pouze ukázkový text.“ a vložit osnovu. Původní text zůstane; opakované vložení nevytvoří druhou osnovu. Doplnit fiktivní části anamnéza/nález/závěr/doporučení.
6. Během psaní nevzniká nová verze za každým znakem. Po 5 sekundách bez psaní se ukáže „Uloženo“. „Uložit nyní“ uloží okamžitě. Vyzkoušet změnu ve dvou oknech: konflikt nesmí tiše přepsat rozepsaný text.
7. Zapsat ukázkovou metodu ověření totožnosti a potvrdit ji. V tomto syntetickém scénáři nejde o skutečné ověření pacienta.
8. Při rozepsaných poznámkách vypnout internet. Text musí zůstat v otevřeném okně a aplikace upozornit na výpadek. Neobnovovat celou stránku. Po obnovení připojení počkat na uložení; videohovor případně obnovit samostatným tlačítkem. Zvlášť otestovat zamítnuté oprávnění kamery a jeho opětovné povolení.
9. Ukončit konzultaci a dokončit podklad. Úpravy poznámek a popisů jsou uzamčeny. Opravu otevřít s důvodem, upravit text a znovu dokončit; původní dokončená verze zůstane zachována.
10. Kopírovat/stáhnout text a ZIP. Pacient, důvod a klinický zápis jsou před administrativními údaji. Export obsahuje popis i původní název přílohy a skutečně evidované údaje o totožnosti a hovoru. Nic z ukázky nevkládat do dokumentace skutečného pacienta.

## Zapsat výsledek

Datum, verzi nasazení, zařízení a prohlížeče, výsledek každého kroku a případné chyby. Kontrola přístupu jiné ordinace a role sestry je také součástí automatických databázových testů; před pilotním provozem ověřit reálnou konfiguraci účtů.
