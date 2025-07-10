# Raindrop Obsidian Plugin

An Obsidian plugin to import and synchronize bookmarks from [Raindrop.io](https://raindrop.io) into your Obsidian Vault.

## ✨ Features

- **🔄 Full Synchronization**: Import all your Raindrop.io bookmarks with one click
- **📁 Hierarchical Organization**: Respects the collection structure from Raindrop.io
- **🎨 Customizable Templates**: Define your own Handlebars templates for displaying your bookmarks
- **🏷️ Tags & Highlights**: Imports tags, notes, and highlights from Raindrop.io
- **⚙️ Smart Selection**: Cascading collection selection for easy management
- **📋 Table of Contents**: Automatic TOC generation for better navigation

## 🚀 Installation

### Manual

1. Download the latest version from the [Releases](https://github.com/your-username/raindrop-obsidian/releases)
2. Unzip the ZIP file into your `.obsidian/plugins/raindrop-sync/` folder
3. Activate the plugin in Obsidian settings under "Community Plugins"

### From the Community Plugin Store

*The plugin is not yet available in the official store - follow the manual installation.*

## ⚙️ Configuration

### 1. Obtain API Token

1. Visit the [Raindrop.io App Settings](https://app.raindrop.io/settings/integrations)
2. Go to "Integrations" → "For Developers"
3. Create a new App Token
4. Copy the generated token

### 2. Configure Plugin

1. Open Obsidian settings
2. Navigate to "Raindrop Sync" in the plugin settings
3. Paste your API token
4. Select the storage folder (default: "Raindrop")
5. Select the collections to be synchronized

## 📖 Usage

### Start Synchronization

- **Command Palette**: `Ctrl/Cmd + P` → "Sync Raindrop Bookmarks"
- **Via the Settings Panel**: Configure your settings first, then run the synchronization

### Collection Selection

- **Single Selection**: Select individual collections
- **Cascading Selection**: Automatic selection of parent/child collections
- **Unsorted**: Special option for bookmarks without a collection

## 🎨 Template System

The plugin uses [Handlebars](https://handlebarsjs.com/) for flexible template creation.

### Available Variables

- `{{title}}` - Title of the bookmark
- `{{link}}` - URL of the bookmark
- `{{excerpt}}` - Description/excerpt
- `{{note}}` - Personal note
- `{{created}}` - Creation date
- `{{tags}}` - Array of tags
- `{{highlights}}` - Array of highlights

### Available Helpers

- `{{formatDate created}}` - Formats date to YYYY-MM-DD
- `{{formatTags tags}}` - Converts tags to #tag format
- `{{getBaseUrl link}}` - Extracts hostname from URL
- `{{formatText text}}` - Formats text with soft breaks and escapes hashtags

### Default Template

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

### Example Output

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

## 📁 File Structure

The plugin creates the following structure:

```
Raindrop/
├── Collection Name 1.md
├── Collection Name 2.md
├── Subcollection Parent.md
└── Unsorted.md
```

Each file contains:
- Automatic table of contents
- Hierarchically organized bookmarks
- Complete metadata

## 🔧 Development

### Prerequisites

- Node.js (v16+)
- pnpm
- TypeScript

### Setup

```bash
# Clone repository
git clone https://github.com/your-username/raindrop-obsidian.git
cd raindrop-obsidian

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

### Build

```bash
# Create production build
pnpm build
```

### Technical Stack

- **TypeScript** - Type-safe development
- **Vue 3** - Reactive UI components
- **Handlebars** - Template engine
- **ESBuild** - Fast build process
- **Obsidian API** - Plugin integration

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📋 Roadmap

- [ ] **Automatic Synchronization**: Scheduled sync intervals
- [ ] **Incremental Sync**: Synchronize only new/changed bookmarks
- [ ] **Bidirectional Sync**: Sync changes from Obsidian back to Raindrop.io
- [ ] **Custom Fields**: Support for custom fields
- [ ] **Export Functions**: Export bookmarks from Obsidian
- [ ] **Search Integration**: Better search integration in Obsidian

## 🐛 Known Issues

- Very large collections (>1000 items) can synchronize slowly
- Special characters in collection names are replaced
- API rate limits can occur with frequent syncs

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgements

- [Raindrop.io](https://raindrop.io) for the excellent API
- [Obsidian](https://obsidian.md) for the powerful plugin architecture  
- [Vue.js Obsidian Starter](https://github.com/guopenghui/obsidian-vue-starter) for the template

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-username/raindrop-obsidian/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/raindrop-obsidian/discussions)
- **Raindrop.io API**: [Developer Documentation](https://developer.raindrop.io/)
- **Obsidian Plugin Development**: [Official Docs](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)

---

**⭐ If this plugin helps you, give it a star on GitHub!**
