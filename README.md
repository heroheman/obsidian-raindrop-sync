# Raindrop Obsidian Plugin

Ein Obsidian Plugin zum Importieren und Synchronisieren von Bookmarks aus [Raindrop.io](https://raindrop.io) in dein Obsidian Vault.

## ✨ Features

- **🔄 Vollständige Synchronisation**: Importiere alle deine Raindrop.io Bookmarks mit einem Klick
- **📁 Hierarchische Organisation**: Respektiert die Collection-Struktur aus Raindrop.io
- **🎨 Anpassbare Templates**: Definiere eigene Handlebars-Templates für die Darstellung deiner Bookmarks
- **🏷️ Tags & Highlights**: Importiert Tags, Notizen und Highlights aus Raindrop.io
- **⚙️ Intelligente Auswahl**: Kaskadierte Collection-Auswahl für einfache Verwaltung
- **📋 Inhaltsverzeichnis**: Automatische TOC-Generierung für bessere Navigation

## 🚀 Installation

### Manuell

1. Lade die neueste Version aus den [Releases](https://github.com/your-username/raindrop-obsidian/releases) herunter
2. Entpacke die ZIP-Datei in deinen `.obsidian/plugins/raindrop-sync/` Ordner
3. Aktiviere das Plugin in den Obsidian Einstellungen unter "Community Plugins"

### Aus dem Community Plugin Store

*Das Plugin ist noch nicht im offiziellen Store verfügbar - folge der manuellen Installation.*

## ⚙️ Konfiguration

### 1. API Token erhalten

1. Besuche die [Raindrop.io App Settings](https://app.raindrop.io/settings/integrations)
2. Gehe zu "Integrations" → "For Developers"
3. Erstelle ein neues App Token
4. Kopiere den generierten Token

### 2. Plugin konfigurieren

1. Öffne die Obsidian Einstellungen
2. Navigiere zu "Raindrop Sync" in den Plugin-Einstellungen
3. Füge deinen API Token ein
4. Wähle den Speicherordner (Standard: "Raindrop")
5. Wähle die Collections aus, die synchronisiert werden sollen

## 📖 Verwendung

### Synchronisation starten

- **Command Palette**: `Ctrl/Cmd + P` → "Sync Raindrop Bookmarks"
- **Über das Settings Panel**: Konfiguriere zuerst deine Einstellungen, dann führe die Synchronisation aus

### Collection-Auswahl

- **Einzelauswahl**: Wähle individuelle Collections aus
- **Kaskadierte Auswahl**: Automatische Auswahl von Parent/Child Collections
- **Unsorted**: Spezielle Option für Bookmarks ohne Collection

## 🎨 Template-System

Das Plugin verwendet [Handlebars](https://handlebarsjs.com/) für flexible Template-Erstellung.

### Verfügbare Variablen

- `{{title}}` - Titel des Bookmarks
- `{{link}}` - URL des Bookmarks
- `{{excerpt}}` - Beschreibung/Auszug
- `{{note}}` - Persönliche Notiz
- `{{created}}` - Erstellungsdatum
- `{{tags}}` - Array der Tags
- `{{highlights}}` - Array der Highlights

### Verfügbare Helfer

- `{{formatDate created}}` - Formatiert Datum zu YYYY-MM-DD
- `{{formatTags tags}}` - Konvertiert Tags zu #tag Format
- `{{getBaseUrl link}}` - Extrahiert Hostname aus URL
- `{{formatText text}}` - Formatiert Text mit Soft-Breaks und escaped Hashtags

### Standard Template

```handlebars
- [{{title}}]({{link}}) *{{getBaseUrl link}}* - {{formatDate created}}
    {{#if tags.length}}
    - Tags: {{formatTags tags}}
    {{/if}}
    {{#if note}}
    - **Note**: 
      {{formatText note}}
    {{/if}}
    {{#if highlights.length}}
    - **Highlights**:
      {{#each highlights}}
        - {{formatText text}}
          {{#if note}}
            - *Note: {{formatText note}}*
          {{/if}}
      {{/each}}
    {{/if}}
```

### Beispiel Output

```markdown
- [GitHub - OpenAI API](https://github.com/openai/openai-api) *github.com* - 2024-01-15
    - Tags: #programming #ai #api
    - **Note**: 
      Useful for AI integration projects  
      with multiple lines of text
    - **Highlights**:
        - The OpenAI API can be applied to virtually any task  
          that requires understanding or generating text
          - *Note: Key insight for project planning  
            across different use cases*
```

## 📁 Dateistruktur

Das Plugin erstellt folgende Struktur:

```
Raindrop/
├── Collection Name 1.md
├── Collection Name 2.md
├── Subcollection Parent.md
└── Unsorted.md
```

Jede Datei enthält:
- Automatisches Inhaltsverzeichnis
- Hierarchisch organisierte Bookmarks
- Vollständige Metadaten

## 🔧 Entwicklung

### Voraussetzungen

- Node.js (v16+)
- pnpm
- TypeScript

### Setup

```bash
# Repository klonen
git clone https://github.com/your-username/raindrop-obsidian.git
cd raindrop-obsidian

# Dependencies installieren
pnpm install

# Development Server starten
pnpm dev
```

### Build

```bash
# Produktions-Build erstellen
pnpm build
```

### Technischer Stack

- **TypeScript** - Typsichere Entwicklung
- **Vue 3** - Reaktive UI-Komponenten
- **Handlebars** - Template-Engine
- **ESBuild** - Schneller Build-Prozess
- **Obsidian API** - Plugin-Integration

## 🤝 Contributing

Beiträge sind willkommen! Bitte:

1. Forke das Repository
2. Erstelle einen Feature Branch (`git checkout -b feature/amazing-feature`)
3. Committe deine Änderungen (`git commit -m 'Add amazing feature'`)
4. Pushe den Branch (`git push origin feature/amazing-feature`)
5. Öffne einen Pull Request

## 📋 Roadmap

- [ ] **Automatische Synchronisation**: Geplante Sync-Intervalle
- [ ] **Incremental Sync**: Nur neue/geänderte Bookmarks synchronisieren
- [ ] **Bidirektionale Sync**: Änderungen von Obsidian zurück zu Raindrop.io
- [ ] **Custom Fields**: Unterstützung für benutzerdefinierte Felder
- [ ] **Export Funktionen**: Bookmarks aus Obsidian exportieren
- [ ] **Search Integration**: Bessere Suchintegration in Obsidian

## 🐛 Bekannte Probleme

- Sehr große Collections (>1000 Items) können langsam synchronisieren
- Spezielle Zeichen in Collection-Namen werden ersetzt
- API Rate Limits können bei häufigen Syncs auftreten

## 📄 Lizenz

MIT License - siehe [LICENSE](LICENSE) Datei für Details.

## 🙏 Danksagungen

- [Raindrop.io](https://raindrop.io) für die ausgezeichnete API
- [Obsidian](https://obsidian.md) für die mächtige Plugin-Architektur  
- [Vue.js Obsidian Starter](https://github.com/guopenghui/obsidian-vue-starter) für das Template

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-username/raindrop-obsidian/issues)
- **Diskussionen**: [GitHub Discussions](https://github.com/your-username/raindrop-obsidian/discussions)
- **Raindrop.io API**: [Developer Documentation](https://developer.raindrop.io/)
- **Obsidian Plugin Development**: [Official Docs](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)

---

**⭐ Wenn dir dieses Plugin hilft, gib ihm einen Stern auf GitHub!**