# FactGuard – Fake News Detector für Facebook

Eine Chrome Extension, die Facebook-Posts auf Fehlinformationen analysiert und wissenschaftlich fundierte Einschätzungen in einer eleganten Sidebar anzeigt.

---

## Installation (Entwicklermodus)

1. **Extension entpacken**  
   Entpacke den ZIP-Ordner an einem festen Ort (z.B. `~/Extensions/fakenews-detector`)

2. **Chrome öffnen**  
   Navigiere zu `chrome://extensions/`

3. **Entwicklermodus aktivieren**  
   Schalte oben rechts den Schieberegler „Entwicklermodus" ein

4. **Extension laden**  
   Klicke auf „Entpackte Extension laden" und wähle den Ordner `fakenews-detector`

5. **API-Key eintragen**  
   - Klicke auf das FactGuard-Symbol in der Chrome-Toolbar  
   - Trage deinen [Anthropic API-Key](https://console.anthropic.com/settings/keys) ein  
   - Klicke „Einstellungen speichern"

---

## Verwendung

1. **Facebook öffnen** – Die Sidebar erscheint automatisch am rechten Rand
2. **Post finden** – Scrolle durch deinen Feed
3. **Prüfen klicken** – Unter jedem Post erscheint ein „FactGuard prüfen"-Button
4. **Ergebnis lesen** – Die Sidebar zeigt:
   - **Verdict**: Wahr / Teilweise wahr / Falsch / Irreführend / Unbekannt
   - **Konfidenz**: Prozentuales Vertrauen in die Einschätzung
   - **Zusammenfassung**: Kurze Bewertung
   - **Analyse**: Detaillierte Erklärung
   - **Einzelne Behauptungen**: Jede Aussage einzeln bewertet
   - **Relevante Quellen**: Empfehlungen (RKI, WHO, PubMed, etc.)

---

## Wichtige Hinweise

- **Kosten**: Die Extension nutzt die Anthropic Claude API. Pro Analyse entstehen geringe Kosten (~0,001–0,005 €)
- **Datenschutz**: Post-Texte werden zur Analyse an die Anthropic API gesendet. Der API-Key wird nur lokal im Browser gespeichert
- **Genauigkeit**: KI-basierte Faktenprüfung ist ein Hilfsmittel, kein Ersatz für eigenes kritisches Denken
- **Facebook-Kompatibilität**: Facebook ändert regelmäßig sein HTML-Markup. Sollten die Buttons nicht erscheinen, kann ein Update der Selektoren in `content.js` nötig sein

---

## Dateistruktur

```
fakenews-detector/
├── manifest.json       # Extension-Konfiguration (Manifest V3)
├── background.js       # Service Worker (API-Aufrufe)
├── content.js          # Facebook-Integration, Sidebar-Logik
├── sidebar.css         # Sidebar-Styling
├── popup.html          # Einstellungs-Popup
├── popup.js            # Einstellungs-Logik
└── icons/              # Extension-Icons (16x16, 48x48, 128x128 PNG)
```

---

## Anpassungen

### Andere Sprache
Im `background.js` den `systemPrompt` anpassen.

### Andere Websites
In `manifest.json` unter `host_permissions` und `content_scripts.matches` weitere Domains hinzufügen.  
In `content.js` die `postSelectors` für die Ziel-Website anpassen.

### Modell ändern
In `background.js` `"model": "claude-opus-4-5"` gegen ein anderes Modell austauschen (z.B. `claude-haiku-4-5-20251001` für schnellere/günstigere Analysen).
