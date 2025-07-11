import {
    Notice,
    Plugin,
    PluginSettingTab,
	Setting,
	ToggleComponent,
	TextAreaComponent,
} from 'obsidian';
import { getCollections, getRaindrops, RaindropCollection } from './api';
import * as Handlebars from 'handlebars';
import { App as VueApp, createApp } from "vue";
import Settings from "./components/Settings.vue";

// Remember to rename these classes and interfaces!

export interface RaindropSyncSettings {
	apiToken: string;
	storageFolder: string;
	fileViewStorageFolder: string;
	fileViewIndexFolder: string;
	fileViewDataviewColumns: {
		cover: boolean;
		tags: boolean;
		highlights: boolean;
		notes: boolean;
		type: boolean;
	};
	collectionIds: number[];
	expandedCollectionIds: number[];
	cascadeSelection: boolean;
	template: string;
	fileViewTemplate: string;
	showRibbonList: boolean;
	showRibbonFile: boolean;
	useMarkdownHighlights: boolean;
}

const DEFAULT_SETTINGS: RaindropSyncSettings = {
	apiToken: '',
	storageFolder: 'Raindrop',
	fileViewStorageFolder: 'Raindrop/Items',
	fileViewIndexFolder: 'Raindrop/Index',
	fileViewDataviewColumns: {
		cover: true,
		tags: true,
		highlights: true,
		notes: true,
		type: true,
	},
	collectionIds: [],
	expandedCollectionIds: [],
	cascadeSelection: true,
	template: `- [{{title}}]({{link}}) *{{domain}}*
    {{#if tags.length}}
    - _Tags_: {{formatTags tags}}
    {{/if}}
    {{#if note}}
    - **Note**:
        - {{formatText note}}
    {{/if}}
    {{#if highlights.length}}
    - **Highlights**:
      {{#each highlights}}
        - {{formatHighlightText text}}
          {{#if note}}
            - *Note*:
			    - {{formatText note}}*
          {{/if}}
      {{/each}}
    {{/if}}`,
	fileViewTemplate: `---
title: "{{title}}"
url: "{{link}}"
tags: [{{#each tags}}"{{this}}"{{#unless @last}}, {{/unless}}{{/each}}]
cover: "{{cover}}"
hasHighlights: {{#if highlights.length}}true{{else}}false{{/if}}
hasNotes: {{#if note}}true{{else}}false{{/if}}
raindropId: {{_id}}
raindropLastUpdated: "{{lastUpdate}}"
raindropType: "{{type}}"
raindropCollectionId: {{collection.$id}}
domain: "{{domain}}"
collection: "[[{{collectionPath}}]]"
---

# {{title}}

[{{title}}]({{link}})

> {{{excerpt}}}

{{#if note}}
## Note
{{formatText note}}
{{/if}}

{{#if highlights.length}}
## Highlights
{{#each highlights}}
- {{formatHighlightText text}}
  {{#if note}}
    - *Note*: {{formatText note}}
  {{/if}}
{{/each}}
{{/if}}
`,
	showRibbonList: true,
	showRibbonFile: true,
	useMarkdownHighlights: true,
}

export default class RaindropSyncPlugin extends Plugin {
	settings: RaindropSyncSettings;

    async onload() {
        await this.loadSettings();

		Handlebars.registerHelper('formatDate', function (dateStr: string) {
			return new Date(dateStr).toISOString().slice(0, 10);
		});

		Handlebars.registerHelper('formatTags', function (tags: string[]) {
			if (!tags || tags.length === 0) {
				return '';
			}
			return tags.map(t => `#${t}`).join(' ');
		});

		Handlebars.registerHelper('formatText', function (text: string) {
			if (!text) return new Handlebars.SafeString('');
			// Escape hashtags to prevent them from being interpreted as Obsidian tags
			let escaped = text.replace(/#/g, '\\#');
			// Split by paragraphs (double newlines or single newlines) and create list items
			const paragraphs = escaped.split(/\n+/).filter(p => p.trim() !== '');
			if (paragraphs.length <= 1) {
				return new Handlebars.SafeString(escaped);
			}
			// Return first paragraph normally, additional paragraphs as sub-list items
			const firstParagraph = paragraphs[0];
			const additionalParagraphs = paragraphs.slice(1).map(p => `            - ${p}`).join('\n');
			return new Handlebars.SafeString(firstParagraph + (additionalParagraphs ? '\n' + additionalParagraphs : ''));
		});

		Handlebars.registerHelper('formatHighlightText', (text: string) => {
			if (!text) return new Handlebars.SafeString('');
			
			// Apply markdown highlight if enabled
			const wrapInHighlight = (str: string) => {
				return this.settings.useMarkdownHighlights ? `==${str}==` : str;
			}

			// Escape hashtags to prevent them from being interpreted as Obsidian tags
			let escaped = text.replace(/#/g, '\\#');
			// Split by paragraphs (double newlines or single newlines) and create list items
			const paragraphs = escaped.split(/\n+/).filter(p => p.trim() !== '');
			
			if (paragraphs.length <= 1) {
				return new Handlebars.SafeString(wrapInHighlight(escaped));
			}

			// Return first paragraph normally, additional paragraphs as sub-list items
			const firstParagraph = wrapInHighlight(paragraphs[0]);
			const additionalParagraphs = paragraphs.slice(1).map(p => `        - ${p}`).join('\n');
			return new Handlebars.SafeString(firstParagraph + (additionalParagraphs ? '\n' + additionalParagraphs : ''));
		});


		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'sync-raindrop-bookmarks-list-view',
			name: 'Sync Bookmarks (List View)',
			callback: () => this.syncListView()
		});

		this.addCommand({
			id: 'sync-raindrop-bookmarks-file-view',
			name: 'Sync Bookmarks (File View)',
			callback: () => this.syncFileView()
		});

		this.addCommand({
			id: 'regenerate-raindrop-file-view-index',
			name: 'Regenerate File View Index',
			callback: () => this.generateFileViewIndex()
		});

		// This adds a ribbon icon for quick access to sync
		if (this.settings.showRibbonList) {
			this.addRibbonIcon('cloud-download', 'Sync Bookmarks (List View)', () => {
				this.syncListView();
			});
		}

		if (this.settings.showRibbonFile) {
			this.addRibbonIcon('cloud-download', 'Sync Bookmarks (File View)', () => {
				this.syncFileView();
			});
		}

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new RaindropSyncSettingTab(this.app, this));
    }

    onunload() {

    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		// Ensure nested objects are properly defaulted for users with older settings
		this.settings.fileViewDataviewColumns = Object.assign(
			{},
			DEFAULT_SETTINGS.fileViewDataviewColumns,
			this.settings.fileViewDataviewColumns
		);
    }

    async saveSettings() {
        await this.saveData(this.settings);
		// Ensure nested objects are properly defaulted for users with older settings
		this.settings.fileViewDataviewColumns = Object.assign(
			{},
			DEFAULT_SETTINGS.fileViewDataviewColumns,
			this.settings.fileViewDataviewColumns
		);
    }

	private sanitizeForPath(name: string) {
		// Only remove characters that are invalid in folder names across OSs
		return name.replace(/[\\/:"*?<>|]/g, '-');
	}

	private sanitizeForFile(name: string) {
		const sanitized = name
			.toLowerCase()
			.replace(/\s+/g, '_') // Replace spaces and whitespace with a single underscore
			.replace(/[^a-z0-9_]/g, ''); // Remove all non-alphanumeric chars except underscore
		return sanitized.substring(0, 80);
	}

	async syncListView() {
		if (!this.settings.collectionIds || this.settings.collectionIds.length === 0) {
			new Notice('No collections selected to sync.');
			return;
		}
		
		try {
			new Notice('Syncing Raindrop bookmarks...');

			const allApiCollections = await getCollections(this.settings);
			
			const nodes: Record<number, CollectionNode> = {};
			allApiCollections.forEach(c => {
				nodes[c._id] = { collection: c, children: [] };
			});

			const rootNodes: CollectionNode[] = [];
			allApiCollections.forEach(c => {
				const parentId = c.parent?.$id;
				if (parentId && nodes[parentId]) {
					nodes[parentId].children.push(nodes[c._id]);
				} else {
					rootNodes.push(nodes[c._id]);
				}
			});

			const folder = this.settings.storageFolder;
			if (!await this.app.vault.adapter.exists(folder)) {
				await this.app.vault.createFolder(folder);
			}

			const template = Handlebars.compile(this.settings.template);
			
			const getSelectedDescendants = (node: CollectionNode): CollectionNode[] => {
				let descendants: CollectionNode[] = [];
				if (this.settings.collectionIds.includes(node.collection._id)) {
					descendants.push(node);
				}
				node.children.forEach(child => {
					descendants = descendants.concat(getSelectedDescendants(child));
				});
				return descendants;
			};

			for (const rootNode of rootNodes) {
				const selectedInTree = getSelectedDescendants(rootNode);
				if (selectedInTree.length === 0) continue;

				let content = '';
				let toc = '# Table of Contents\n';
				
				const processNode = async (node: CollectionNode, level: number): Promise<string> => {
					let nodeContent = '';
					if (!this.settings.collectionIds.includes(node.collection._id)) {
						return '';
					}
					
					const title = node.collection.title;
					const sanitizedTitle = title.replace(/[\\/:"*?<>|]/g, '');
					
					toc += `${'  '.repeat(level-1)}- [[#${sanitizedTitle}]]\n`;
					nodeContent += `${'#'.repeat(level)} ${sanitizedTitle}\n\n`;

					const raindrops = await getRaindrops(this.settings, node.collection._id);
					if (raindrops && raindrops.length > 0) {
						const renderedRaindrops = raindrops.map(raindrop => template(raindrop).trim());
						nodeContent += renderedRaindrops.join('\n') + '\n\n';
					}

					for (const child of node.children) {
						nodeContent += await processNode(child, level + 1);
					}

					return nodeContent;
				};
				
				content += await processNode(rootNode, 1);
				
				if (content) {
					const finalContent = toc + '---\n\n' + content;
					const fileName = `${rootNode.collection.title.replace(/[\\/:"*?<>|]/g, '')}.md`;
					const filePath = `${folder}/${fileName}`;
					await this.app.vault.adapter.write(filePath, finalContent);
				}
			}

			if (this.settings.collectionIds.includes(0)) {
				let unsortedContent = `# Unsorted\n\n`;
				const raindrops = await getRaindrops(this.settings, 0);
				if (raindrops && raindrops.length > 0) {
					const renderedRaindrops = raindrops.map(raindrop => template(raindrop).trim());
					unsortedContent += renderedRaindrops.join('\n');
				}
				await this.app.vault.adapter.write(`${folder}/Unsorted.md`, unsortedContent);
			}

			new Notice(`Sync complete.`);

		} catch (e) {
			new Notice('A critical error occurred during sync. Check your settings and connection.');
			console.error(e);
		}
	}

	async syncFileView() {
		if (!this.settings.collectionIds || this.settings.collectionIds.length === 0) {
			new Notice('No collections selected to sync.');
			return;
		}
		
		try {
			new Notice('Syncing Raindrop bookmark files...');

			const allApiCollections = await getCollections(this.settings);
			const template = Handlebars.compile(this.settings.fileViewTemplate);
			const fileViewFolder = this.settings.fileViewStorageFolder;

			// Create a map for quick lookups
			const collectionsMap = new Map(allApiCollections.map(c => [c._id, c]));
			const getCollectionPath = (collectionId: number): [string, string] => {
				let current = collectionsMap.get(collectionId);
				if (!current) return ["", ""];

				const path: string[] = [];
				let rootCollection = current;

				while(current) {
					path.unshift(current.title);
					const parentId = current.parent?.$id;
					if (parentId && collectionsMap.has(parentId)) {
						rootCollection = collectionsMap.get(parentId)!;
						current = collectionsMap.get(parentId);
					} else {
						current = undefined;
					}
				}
				
				const pathString = path.join(' > ');
				const linkPath = `${this.sanitizeForFile(rootCollection.title)}#${path[path.length - 1]}`;
				return [pathString, linkPath];
			}

			if (!await this.app.vault.adapter.exists(fileViewFolder)) {
				await this.app.vault.createFolder(fileViewFolder);
			}
			
			const selectedCollections = allApiCollections.filter(c => this.settings.collectionIds.includes(c._id));

			for (const collection of selectedCollections) {
				const collectionFolder = `${fileViewFolder}/${this.sanitizeForPath(collection.title)}`;
				if (!await this.app.vault.adapter.exists(collectionFolder)) {
					await this.app.vault.createFolder(collectionFolder);
				}

				const raindrops = await getRaindrops(this.settings, collection._id);
				for (const raindrop of raindrops) {
					const [_, collectionPath] = getCollectionPath(raindrop.collection.$id);
					const raindropWithContext = {
						...raindrop,
						collectionPath,
					};
					const renderedContent = template(raindropWithContext);
					const fileName = `${this.sanitizeForFile(raindrop.title)}.md`;
					const filePath = `${collectionFolder}/${fileName}`;
					await this.app.vault.adapter.write(filePath, renderedContent);
				}
			}

			// Handle "Unsorted" files creation separately
			if (this.settings.collectionIds.includes(0)) {
				const unsortedFolder = `${fileViewFolder}/Unsorted`;
				if (!await this.app.vault.adapter.exists(unsortedFolder)) {
					await this.app.vault.createFolder(unsortedFolder);
				}

				const raindrops = await getRaindrops(this.settings, 0);
				for (const raindrop of raindrops) {
					const raindropWithContext = {
						...raindrop,
						collectionPath: 'Unsorted',
					};
					const renderedContent = template(raindropWithContext);
					const fileName = `${this.sanitizeForFile(raindrop.title)}.md`;
					const filePath = `${unsortedFolder}/${fileName}`;
					await this.app.vault.adapter.write(filePath, renderedContent);
				}
			}

			// After creating all files, regenerate the index
			await this.generateFileViewIndex();
			
			new Notice('Sync complete (File View).');

		} catch (e) {
			new Notice('A critical error occurred during file sync. Check your settings and connection.');
			console.error(e);
		}
	}

	async generateFileViewIndex() {
		if (!this.settings.collectionIds || this.settings.collectionIds.length === 0) {
			new Notice('No collections selected for index.');
			return;
		}

		try {
			new Notice('Generating Raindrop file view index...');

			const allApiCollections = await getCollections(this.settings);
			
			const nodes: Record<number, CollectionNode> = {};
			allApiCollections.forEach(c => {
				nodes[c._id] = { collection: c, children: [] };
			});

			const rootNodes: CollectionNode[] = [];
			allApiCollections.forEach(c => {
				const parentId = c.parent?.$id;
				if (parentId && nodes[parentId]) {
					nodes[parentId].children.push(nodes[c._id]);
				} else {
					rootNodes.push(nodes[c._id]);
				}
			});

			const fileViewFolder = this.settings.fileViewStorageFolder;
			const indexFolder = this.settings.fileViewIndexFolder;
			if (!await this.app.vault.adapter.exists(indexFolder)) {
				await this.app.vault.createFolder(indexFolder);
			}

			const processNode = async (node: CollectionNode, level: number): Promise<[string, string]> => {
				let toc = '';
				let content = '';

				if (!this.settings.collectionIds.includes(node.collection._id)) {
					return ['', ''];
				}
				
				const title = node.collection.title;
				
				toc += `${'  '.repeat(level-1)}- [[#${title}]]\n`;
				content += `${'#'.repeat(level)} ${title}\n\n`;

				const fromClause = `"${fileViewFolder}/${this.sanitizeForPath(node.collection.title)}"`;
				
				const dvSettings = this.settings.fileViewDataviewColumns;
				const columns = [];
				if (dvSettings.cover) {
					columns.push(`choice(length(cover) > 0, "<img src='" + cover + "' width='60'>", "") as "Cover"`);
				}
				columns.push('elink(url, title) as "Title"');
				if (dvSettings.tags) {
					columns.push('tags as "Tags"');
				}
				if (dvSettings.highlights) {
					columns.push('choice(hasHighlights, "✅", "❌") as "Highlights"');
				}
				if (dvSettings.notes) {
					columns.push('choice(hasNotes, "✅", "❌") as "Notes"');
				}
				if (dvSettings.type) {
					columns.push('raindropType as "Type"');
				}
				columns.push('link(file.path, "show") as "Detail"');
				const tableCols = columns.join(',\n    ');

				content += `
\`\`\`dataview
TABLE WITHOUT ID
    ${tableCols}
FROM ${fromClause}
SORT file.ctime DESC
\`\`\`
\n`;

				for (const child of node.children) {
					const [childToc, childContent] = await processNode(child, level + 1);
					toc += childToc;
					content += childContent;
				}

				return [toc, content];
			};

			for (const rootNode of rootNodes) {
				const [toc, content] = await processNode(rootNode, 1);
				
				if (content) {
					const finalContent = '# Table of Contents\n' + toc + '---\n\n' + content;
					const fileName = `${this.sanitizeForFile(rootNode.collection.title)}.md`;
					const filePath = `${indexFolder}/${fileName}`;
					await this.app.vault.adapter.write(filePath, finalContent);
				}
			}

			// Handle "Unsorted" collection
			if (this.settings.collectionIds.includes(0)) {
				const unsortedFolder = `${fileViewFolder}/Unsorted`;
				
				const dvSettings = this.settings.fileViewDataviewColumns;
				const columns = [];
				if (dvSettings.cover) {
					columns.push(`choice(length(cover) > 0, "<img src='" + cover + "' width='60'>", "") as "Cover"`);
				}
				columns.push('elink(url, title) as "Title"');
				if (dvSettings.tags) {
					columns.push('tags as "Tags"');
				}
				if (dvSettings.highlights) {
					columns.push('choice(hasHighlights, "✅", "❌") as "Highlights"');
				}
				if (dvSettings.notes) {
					columns.push('choice(hasNotes, "✅", "❌") as "Notes"');
				}
				if (dvSettings.type) {
					columns.push('raindropType as "Type"');
				}
				columns.push('link(file.path, "show") as "Detail"');
				const tableCols = columns.join(',\n    ');

				const dataviewContent = `
\`\`\`dataview
TABLE WITHOUT ID
    ${tableCols}
FROM "${unsortedFolder}"
SORT file.ctime DESC
\`\`\`
`;
				const filePath = `${indexFolder}/Unsorted.md`;
				await this.app.vault.adapter.write(filePath, dataviewContent.trim());
			}

			new Notice('File view index regenerated.');
		} catch (e) {
			new Notice('A critical error occurred during index generation. Check your settings and connection.');
			console.error(e);
		}
	}
}

interface CollectionNode {
    collection: RaindropCollection;
    children: CollectionNode[];
}

class RaindropSyncSettingTab extends PluginSettingTab {
	plugin: RaindropSyncPlugin;
	vueApp: VueApp;

	display(): void {
		const { containerEl } = this;
		if (this.vueApp) {
			this.vueApp.unmount();
		}
		containerEl.empty();

		const onSettingsUpdate = (newSettings: RaindropSyncSettings) => {
			this.plugin.settings = newSettings;
			this.plugin.saveSettings();
		};

		const onTemplateReset = () => {
			this.plugin.settings.template = DEFAULT_SETTINGS.template;
			this.plugin.saveSettings();
			this.display(); // Re-render the settings tab
		};

		const onFileTemplateReset = () => {
			this.plugin.settings.fileViewTemplate = DEFAULT_SETTINGS.fileViewTemplate;
			this.plugin.saveSettings();
			this.display(); // Re-render the settings tab
		};

		this.vueApp = createApp(Settings, {
			settings: this.plugin.settings,
			onUpdateSettings: onSettingsUpdate,
			onResetTemplate: onTemplateReset,
			onResetFileTemplate: onFileTemplateReset,
		});

		this.vueApp.mount(containerEl);
	}

	hide() {
		if (this.vueApp) {
			this.vueApp.unmount();
		}
	}
}
