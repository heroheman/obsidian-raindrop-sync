# TODO "Syncing in the rain"

- [ ] Add a setting to enable/disable the file view index
- [ ] Readme anpassen
- [ ] Release
- [ ] configure filename pattern
- [x] Hinweis, dass Dataview gebraucht wird
- [x] Double borders wegmachen
- [/] dataview.js Option? Dann kein Reload mehr
- [x] Enable / disable ribbon and commands?
- [ ] Coffee link (BuyMeACoffee/Spendenlink, falls gewünscht)
- [ ] Nur Bookmarks mit Highlights syncen
- [x] Incremental sync
- [ ] Test connection, show username
- [x] In Listview last sync anders speichern
- [ ] Tag filter: https://developer.raindrop.io/v1/filters


# Guidelines-Check (Obsidian Plugin Guidelines)
- [x] Manifest.json: main-Feld ergänzt
- [x] Sicherheit: Keine Telemetrie/Tracking/unsichere Übertragung
- [x] UI/UX: Keine Überlagerung von Core-Elementen
- [x] Settings: Alle Einstellungen über Settings-Panel erreichbar
- [x] API-Nutzung: Nur öffentliche Obsidian-APIs verwendet
- [x] Dateisystem: Keine destruktiven Operationen ohne Rückfrage
- [x] Performance: Keine dauerhaften Hintergrundprozesse
- [x] Kompatibilität: Unterstützt aktuelle Obsidian-Version
- [x] Lizenz: LICENSE-Datei hinzugefügt
- [x] Dokumentation: README vollständig
- [x] Barrierefreiheit: ARIA-Labels/Fokusindikatoren ergänzen
- [x] Keine Werbung/Spendenaufforderungen im Plugin selbst


## Roadmap

# Erweiterte Features 
- [ ] Erweiterbares Template-System: Typ-spezifische Templates (Link, Artikel, Bild, Video, etc.) und on-the-fly Overrides
- [ ] Quick-Import-Funktion: Einzelne Raindrops per URL oder ID importieren
- [ ] Dynamische Collection-Auswahl: Auswahl aus einer Liste, die direkt aus Raindrop.io geladen wird
- [ ] Eigene Tags beim Import automatisch anhängen
- [ ] Konfigurierbares Banner-Feld im Frontmatter
- [ ] Fortschrittliche Fehlerbehandlung: Logging, API-Rate-Limiting, automatische Retries
- [ ] Undo-/Recovery-Funktion für fehlerhafte Importe
- [ ] Erweiterte Highlight-Verarbeitung (z.B. Notizen zu Highlights, UI-Verbesserungen)
- [ ] Optionale Demo-Note/Beispiel-Output generieren
- [ ] Verbesserte UI/UX: Kontextuelle Hilfelinks, Reset-Buttons für Templates, bessere Modallayouts
