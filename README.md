# FactGuard – Fake News Detector

Eine Chrome Extension, die Inhalte auf **Facebook**, **Bild.de** und **Nius.de** auf Fehlinformationen analysiert und wissenschaftlich fundierte Einschätzungen in einer eleganten Sidebar anzeigt.

Unterstützt **Anthropic Claude**, **Ollama** (lokal & privat) und **OpenAI-kompatible** Endpunkte.

---

## Installation (Entwicklermodus)

1. **Repository klonen oder ZIP herunterladen**
   ```
   git clone https://github.com/Skub-CL/FactGuard.git
   ```

2. **Chrome öffnen**
   Navigiere zu `chrome://extensions/`

3. **Entwicklermodus aktivieren**
   Schalte oben rechts den Schieberegler „Entwicklermodus" ein

4. **Extension laden**
   Klicke auf „Entpackte Extension laden" und wähle den geklonten Ordner

5. **KI-Provider einrichten**
   Klicke auf das FactGuard-Symbol in der Chrome-Toolbar und wähle einen Provider

---

## Unterstützte Seiten

| Seite | Funktionsweise |
|---|---|
| **Facebook** | „FactGuard prüfen"-Button erscheint unter Text-Posts im Feed |
| **Bild.de** | Button erscheint direkt unter der Artikelüberschrift |
| **Nius.de** | Button erscheint direkt unter der Artikelüberschrift |

---

## KI-Provider

### Anthropic Claude (Cloud)
- API-Key unter [console.anthropic.com](https://console.anthropic.com/settings/keys) erstellen
- Modell wählbar: `claude-sonnet-4-6` (Standard), `claude-opus-4-6`, `claude-haiku-4-5-20251001`
- Kosten: ~0,001–0,005 € pro Analyse
- Post-Texte werden an die Anthropic API gesendet

### Ollama (Lokal & Privat)
- Daten verlassen den eigenen Rechner nicht
- Empfohlene Modelle: `qwen2.5:14b`, `mistral-nemo:latest`, `mistral:latest`
- **Wichtig:** Chrome Extensions senden eine eigene Origin – Ollama muss diese erlauben:

  **Linux (systemd):**
  ```bash
  sudo systemctl edit ollama
  ```
  Folgende Zeile ergänzen:
  ```ini
  [Service]
  Environment="OLLAMA_ORIGINS=*"
  ```
  ```bash
  sudo systemctl restart ollama
  ```

  **Windows:** Systemumgebungsvariable `OLLAMA_ORIGINS` mit Wert `*` setzen, Ollama neu starten.

### OpenAI-kompatibel
- Funktioniert mit OpenAI, Groq, OpenRouter, LM Studio u.a.
- API-Key optional (für lokale Dienste nicht nötig)

---

## Ergebnis-Anzeige

Die Sidebar zeigt nach der Analyse:

- **Verdict**: Wahr / Teilweise wahr / Falsch / Irreführend / Unbekannt
- **Konfidenz**: Prozentuales Vertrauen in die Einschätzung
- **Zusammenfassung**: Kurze Bewertung (max. 2 Sätze)
- **Analyse**: Detaillierte Erklärung mit wissenschaftlichem Hintergrund
- **Einzelne Behauptungen**: Jede Aussage einzeln bewertet
- **Relevante Quellen**: Empfehlungen (RKI, WHO, PubMed, Fact-Checker etc.)
- **Kategorie**: Gesundheit / Politik / Wissenschaft / Wirtschaft / Geschichte / Allgemein

---

## Dateistruktur

```
FactGuard/
├── manifest.json       # Extension-Konfiguration (Manifest V3)
├── background.js       # Service Worker (API-Aufrufe: Anthropic, Ollama, OpenAI)
├── content.js          # Site-Integration (Facebook & Nachrichtenseiten), Sidebar-Logik
├── sidebar.css         # Sidebar-Styling
├── popup.html          # Einstellungs-Popup
├── popup.js            # Einstellungs-Logik
└── icons/              # Extension-Icons (16x16, 48x48, 128x128 PNG)
```

---

## Hinweise

- **Genauigkeit**: KI-basierte Faktenprüfung ist ein Hilfsmittel, kein Ersatz für eigenes kritisches Denken
- **Facebook-Kompatibilität**: Facebook ändert regelmäßig sein HTML-Markup. Sollten Buttons ausbleiben, Extension unter `chrome://extensions/` neu laden
- **Weitere Seiten**: In `manifest.json` Domain ergänzen, in `content.js` wird die News-Logik automatisch für alle Nicht-Facebook-Seiten verwendet
