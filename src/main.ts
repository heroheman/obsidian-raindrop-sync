import {
    Notice,
    Plugin,
    PluginSettingTab,
	Setting,
	ToggleComponent,
	TextAreaComponent,
	App,
} from 'obsidian';
import { getCollections, getRaindrops, RaindropCollection, RaindropItem } from './api';
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
	fileViewFilenameTemplate: string;
	fileViewDateFormat: string;
	showRibbonList: boolean;
	showRibbonFile: boolean;
	useMarkdownHighlights: boolean;
	useColoredHighlights: boolean;
	lastSyncListView?: string;
	lastSyncFileView?: string;
	onlyBookmarksWithHighlights: boolean;
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
	template: `- [{{title}}]({{link}}) (*{{domain}}*)
	- {{raindropLink .}}
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
        - {{formatHighlightText this}}
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
raindropUrl: "{{raindropUrl .}}"
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
- {{formatHighlightText this}}
  {{#if note}}
    - *Note*: {{formatText note}}
  {{/if}}
{{/each}}
{{/if}}

---
{{raindropLink .}}
`,
	fileViewFilenameTemplate: '{{title}}',
	fileViewDateFormat: 'YYYY-MM-DD',
	showRibbonList: true,
	showRibbonFile: true,
	useMarkdownHighlights: true,
	useColoredHighlights: true,
	lastSyncListView: undefined,
	lastSyncFileView: undefined,
	onlyBookmarksWithHighlights: false,
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

		Handlebars.registerHelper('formatHighlightText', (highlight: unknown) => {
			let text: string;
			let color: string | undefined;

			// Handle both string and object inputs for backward compatibility and flexibility
			if (typeof highlight === 'string') {
				text = highlight;
			} else if (typeof highlight === 'object' && highlight !== null && 'text' in highlight) {
				text = (highlight as {text: string}).text;
				color = (highlight as {color?: string}).color;
			} else {
				return new Handlebars.SafeString('');
			}
			
			if (!this.settings.useMarkdownHighlights) {
				return new Handlebars.SafeString(text);
			}

			// Use <mark> tags for highlights
			const wrapInHighlight = (str: string) => {
				if (this.settings.useColoredHighlights && color) {
					// Map raindrop colors to css classes
					const colorMap: { [key: string]: string } = {
						'red': 'coral',
						'green': 'green',
						'yellow': 'yellow',
						'blue': 'blue',
					};
					const colorClass = colorMap[color] || 'yellow';
					return `<mark class="${colorClass}">${str}</mark>`;
				}
				// Default to standard markdown highlight `==text==` which becomes <mark>
				return `==${str}==`;
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

		Handlebars.registerHelper('raindropUrl', function (raindrop: any) {
			if (!raindrop || !raindrop._id) return '';
			return `https://app.raindrop.io/my/0/item/${raindrop._id}`;
		});

		Handlebars.registerHelper('raindropLink', function (raindrop: any) {
			if (!raindrop || !raindrop._id) return '';
			const url = `https://app.raindrop.io/my/0/item/${raindrop._id}`;
			return new Handlebars.SafeString(`[View Raindrop](${url})`);
		});

		// Additional helper for custom date formatting
		Handlebars.registerHelper('formatCustomDate', function (dateStr: string, format: string) {
			// Validate inputs
			if (!dateStr) return '';
			if (!format || typeof format !== 'string') format = 'YYYY-MM-DD';
			
			const date = new Date(dateStr);
			if (isNaN(date.getTime())) return dateStr; // Return original if invalid date
			
			const year = date.getFullYear();
			const month = String(date.getMonth() + 1).padStart(2, '0');
			const day = String(date.getDate()).padStart(2, '0');
			const hours = String(date.getHours()).padStart(2, '0');
			const minutes = String(date.getMinutes()).padStart(2, '0');
			
			return format
				.replace(/YYYY/g, year.toString())
				.replace(/MM/g, month)
				.replace(/DD/g, day)
				.replace(/HH/g, hours)
				.replace(/mm/g, minutes);
		});

		// Helper for creation date in filename templates
		Handlebars.registerHelper('creationDate', function (this: any, format?: string) {
			// Get the date string from context
			const dateStr = this.created || this;
			if (!dateStr) return '';
			
			// Get format from parameter or settings
			let dateFormat = 'YYYY-MM-DD';
			if (typeof format === 'string') {
				dateFormat = format;
			} else if (this.settings?.fileViewDateFormat) {
				dateFormat = this.settings.fileViewDateFormat;
			}
			
			// Use the formatCustomDate helper
			const date = new Date(dateStr);
			if (isNaN(date.getTime())) return dateStr;
			
			const year = date.getFullYear();
			const month = String(date.getMonth() + 1).padStart(2, '0');
			const day = String(date.getDate()).padStart(2, '0');
			const hours = String(date.getHours()).padStart(2, '0');
			const minutes = String(date.getMinutes()).padStart(2, '0');
			
			return dateFormat
				.replace(/YYYY/g, year.toString())
				.replace(/MM/g, month)
				.replace(/DD/g, day)
				.replace(/HH/g, hours)
				.replace(/mm/g, minutes);
		});


		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'sync-raindrop-bookmarks-list-view',
			name: 'Sync Bookmarks (List View)',
			callback: () => this.syncListView()
		});

		this.addCommand({
			id: 'sync-new-raindrop-bookmarks-list-view',
			name: 'Sync New Bookmarks (List View)',
			callback: () => this.syncListView(true)
		});

		this.addCommand({
			id: 'sync-raindrop-bookmarks-file-view',
			name: 'Sync Bookmarks (File View)',
			callback: () => this.syncFileView()
		});

		this.addCommand({
			id: 'sync-new-raindrop-bookmarks-file-view',
			name: 'Sync New Bookmarks (File View)',
			callback: () => this.syncFileView(true)
		});

		this.addCommand({
			id: 'regenerate-raindrop-file-view-index',
			name: 'Regenerate File View Index',
			callback: () => this.generateFileViewIndex()
		});

		this.addCommand({
			id: 'rename-raindrop-files',
			name: 'Rename File View Files',
			callback: () => this.renameFileViewFiles()
		});

		// This adds a ribbon icon for quick access to sync
		if (this.settings.showRibbonList) {
			this.addRibbonIcon('cloud-download', 'Sync Bookmarks (List View)', () => {
				this.syncListView(true);
			});
		}

		if (this.settings.showRibbonFile) {
			this.addRibbonIcon('cloud-download', 'Sync Bookmarks (File View)', () => {
				this.syncFileView(true);
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
		// Ensure new fields are properly defaulted for users with older settings
		if (!this.settings.fileViewFilenameTemplate) {
			this.settings.fileViewFilenameTemplate = DEFAULT_SETTINGS.fileViewFilenameTemplate;
		}
		if (!this.settings.fileViewDateFormat) {
			this.settings.fileViewDateFormat = DEFAULT_SETTINGS.fileViewDateFormat;
		}
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
		// Replace slashes with dash first
		let sanitized = name.replace(/[\\/]/g, '-');
		sanitized = sanitized
			.toLowerCase()
			.replace(/\s+/g, '_') // Replace spaces and whitespace with a single underscore
			.replace(/[^a-z0-9_-]/g, ''); // Allow dash (-) in addition to underscore
		return sanitized.substring(0, 80);
	}

	private generateFileName(raindrop: any): string {
		const template = Handlebars.compile(this.settings.fileViewFilenameTemplate);
		
		// Helper function for date formatting in filename context
		const formatCustomDate = (dateStr: string, format: string) => {
			if (!dateStr) return '';
			if (!format || typeof format !== 'string') format = 'YYYY-MM-DD';
			
			const date = new Date(dateStr);
			if (isNaN(date.getTime())) return dateStr; // Return original if invalid date
			
			const year = date.getFullYear();
			const month = String(date.getMonth() + 1).padStart(2, '0');
			const day = String(date.getDate()).padStart(2, '0');
			const hours = String(date.getHours()).padStart(2, '0');
			const minutes = String(date.getMinutes()).padStart(2, '0');
			
			return format
				.replace(/YYYY/g, year.toString())
				.replace(/MM/g, month)
				.replace(/DD/g, day)
				.replace(/HH/g, hours)
				.replace(/mm/g, minutes);
		};
		
		const filenameData = {
			...raindrop,
			raindropId: raindrop._id,
			title: raindrop.title || 'Untitled',
			link: raindrop.link || '',
			domain: raindrop.domain || '',
			type: raindrop.type || '',
			creationDate: formatCustomDate(raindrop.created || '', this.settings.fileViewDateFormat || 'YYYY-MM-DD'),
		};
		const renderedFilename = template(filenameData);
		return this.sanitizeForFile(renderedFilename);
	}

	private formatCustomDate(dateStr: string, format: string): string {
		const date = new Date(dateStr);
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		const hours = String(date.getHours()).padStart(2, '0');
		const minutes = String(date.getMinutes()).padStart(2, '0');
		
		return format
			.replace(/YYYY/g, year.toString())
			.replace(/MM/g, month)
			.replace(/DD/g, day)
			.replace(/HH/g, hours)
			.replace(/mm/g, minutes);
	}

	async syncListView(incremental = false) {
		if (!this.settings.collectionIds || this.settings.collectionIds.length === 0) {
			new Notice('No collections selected to sync.');
			return;
		}

		if (incremental && !this.settings.lastSyncListView) {
			new Notice('First sync, running a full sync.');
			incremental = false;
		}

		try {
			new Notice(incremental ? 'Syncing new Raindrop bookmarks...' : 'Syncing Raindrop bookmarks...');

			const allApiCollections = await getCollections(this.settings);
			const collectionsMap = new Map(allApiCollections.map(c => [c._id, c]));
			const template = Handlebars.compile(this.settings.template);

			// Highlight-IDs global holen, falls Filter aktiv
			let highlightIdSet: Set<number> | undefined = undefined;
			if (this.settings.onlyBookmarksWithHighlights) {
				const { getAllHighlightRaindropIds } = await import('./api');
				highlightIdSet = await getAllHighlightRaindropIds(this.settings);
			}

			if (incremental) {
				let allNewRaindrops: RaindropItem[] = [];
				for (const collectionId of this.settings.collectionIds) {
					let raindrops = await getRaindrops(this.settings, collectionId, this.settings.lastSyncListView);
					if (highlightIdSet) {
						raindrops = raindrops.filter(r => highlightIdSet!.has(r._id));
					}
					allNewRaindrops.push(...raindrops);
				}

				if (allNewRaindrops.length === 0) {
					new Notice('No new items to sync.');
					return;
				}

				const newItemsByCollection = new Map<string, RaindropItem[]>();
				for (const item of allNewRaindrops) {
					const collectionName = collectionsMap.get(item.collection.$id)?.title || 'Unsorted';
					if (!newItemsByCollection.has(collectionName)) {
						newItemsByCollection.set(collectionName, []);
					}
					newItemsByCollection.get(collectionName)?.push(item);
				}

				let content = `# New Raindrop Items - ${new Date().toLocaleString()}\n\n`;
				for (const [collectionName, items] of newItemsByCollection.entries()) {
					content += `## ${collectionName}\n\n`;
					content += items.map(item => template(item).trim()).join('\n') + '\n\n';
				}
                
				content += `\n---\n*Created at ${new Date().toLocaleString()}*\n`;

				const folder = this.settings.storageFolder;
				const fileName = `Incremental Sync - ${new Date().toISOString().slice(0, 10)}.md`;
				const filePath = `${folder}/${fileName}`;
                
				if (!await this.app.vault.adapter.exists(folder)) {
					await this.app.vault.createFolder(folder);
				}
				await this.app.vault.adapter.write(filePath, content);

				new Notice(`Incremental sync complete. ${allNewRaindrops.length} items synced.`);
			} else {
				// Full Sync Logic
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

				let totalSyncedItems = 0;
				const folder = this.settings.storageFolder;
				if (!await this.app.vault.adapter.exists(folder)) {
					await this.app.vault.createFolder(folder);
				}

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

						let raindrops = await getRaindrops(this.settings, node.collection._id);
						if (highlightIdSet) {
							raindrops = raindrops.filter(r => highlightIdSet!.has(r._id));
						}

						// Sammle Content von Kindern
						let childrenContent = '';
						for (const child of node.children) {
							childrenContent += await processNode(child, level + 1);
						}

						// Nur Content generieren wenn diese Collection oder ihre Kinder Bookmarks haben
						const hasBookmarks = raindrops && raindrops.length > 0;
						const hasChildrenContent = childrenContent.trim().length > 0;

						if (hasBookmarks || hasChildrenContent) {
							toc += `${'  '.repeat(level-1)}- [[#${sanitizedTitle}]]\n`;
							nodeContent += `${'#'.repeat(level)} ${sanitizedTitle}\n\n`;

							if (hasBookmarks) {
								totalSyncedItems += raindrops.length;
								const renderedRaindrops = raindrops.map(raindrop => template(raindrop).trim());
								nodeContent += renderedRaindrops.join('\n') + '\n\n';
							}

							nodeContent += childrenContent;
						}

						return nodeContent;
					};

					content += await processNode(rootNode, 1);

					if (content) {
						const finalContent = toc + '---\n\n' + content + `\n---\n*Created at ${new Date().toLocaleString()}${this.settings.lastSyncListView ? ` / Last updated ${new Date(this.settings.lastSyncListView).toLocaleString()}` : ''}*\n`;
						const fileName = `${rootNode.collection.title.replace(/[\\/:"*?<>|]/g, '')}.md`;
						const filePath = `${folder}/${fileName}`;
						await this.app.vault.adapter.write(filePath, finalContent);
					}
				}

				if (this.settings.collectionIds.includes(0)) {
					let raindrops = await getRaindrops(this.settings, 0);
					if (highlightIdSet) {
						raindrops = raindrops.filter(r => highlightIdSet!.has(r._id));
					}
					if (raindrops && raindrops.length > 0) {
						let unsortedContent = `# Unsorted\n\n`;
						totalSyncedItems += raindrops.length;
						const renderedRaindrops = raindrops.map(raindrop => template(raindrop).trim());
						unsortedContent += renderedRaindrops.join('\n');
						unsortedContent += `\n\n---\n*Created at ${new Date().toLocaleString()}${this.settings.lastSyncListView ? ` / Last updated ${new Date(this.settings.lastSyncListView).toLocaleString()}` : ''}*\n`;
						await this.app.vault.adapter.write(`${folder}/Unsorted.md`, unsortedContent);
					}
				}

				new Notice(`Sync complete. ${totalSyncedItems} items synced.`);
			}

			this.settings.lastSyncListView = new Date().toISOString();
			await this.saveSettings();

		} catch (e) {
			new Notice('A critical error occurred during sync. Check your settings and connection.');
			console.error(e);
		}
	}

	async syncFileView(incremental = false) {
		if (!this.settings.collectionIds || this.settings.collectionIds.length === 0) {
			new Notice('No collections selected to sync.');
			return;
		}

		if (incremental && !this.settings.lastSyncFileView) {
			new Notice('First sync, running a full sync.');
			incremental = false;
		}

		const dataviewApi = (this.app as any).plugins.plugins.dataview?.api;
		if (incremental && !dataviewApi) {
			new Notice('Dataview plugin is required for incremental sync in File View. Please install and enable it.');
			return;
		}

		try {
			new Notice(incremental ? 'Syncing new Raindrop bookmark files...' : 'Syncing Raindrop bookmark files...');

			const allApiCollections = await getCollections(this.settings);
			const template = Handlebars.compile(this.settings.fileViewTemplate);
			const fileViewFolder = this.settings.fileViewStorageFolder;

			// Highlight-IDs global holen, falls Filter aktiv
			let highlightIdSet: Set<number> | undefined = undefined;
			if (this.settings.onlyBookmarksWithHighlights) {
				const { getAllHighlightRaindropIds } = await import('./api');
				highlightIdSet = await getAllHighlightRaindropIds(this.settings);
			}

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

			if (!await this.app.vault.adapter.exists(fileViewFolder)) {
				await this.app.vault.createFolder(fileViewFolder);
			}

			let totalSyncedItems = 0;

			if (incremental) {
				const raindropsToSync = [];
				for (const collectionId of this.settings.collectionIds) {
					let raindrops = await getRaindrops(this.settings, collectionId, this.settings.lastSyncFileView);
					if (highlightIdSet) {
						raindrops = raindrops.filter(r => highlightIdSet!.has(r._id));
					}
					raindropsToSync.push(...raindrops);
				}
                
				totalSyncedItems = raindropsToSync.length;
				if (totalSyncedItems === 0) {
					new Notice('No new items to sync.');
					return;
				}

				for (const raindrop of raindropsToSync) {
					const pages = dataviewApi.pages().where((p: any) => p.raindropId === raindrop._id);
					const [_, collectionPath] = getCollectionPath(raindrop.collection.$id);

					const raindropWithContext = { ...raindrop, collectionPath };
					const renderedContent = template(raindropWithContext);
                    
					const collectionName = collectionsMap.get(raindrop.collection.$id)?.title || 'Unsorted';
					const collectionFolder = `${fileViewFolder}/${this.sanitizeForPath(collectionName)}`;
					const fileName = `${this.generateFileName(raindrop)}.md`;
					const filePath = `${collectionFolder}/${fileName}`;

					if (pages.length > 0) {
						// Item exists, check if it needs to be renamed
						const existingFilePath = pages[0].file.path;
						const existingFileName = existingFilePath.split('/').pop();
						const expectedFileName = `${this.generateFileName(raindrop)}.md`;
						
						if (existingFileName !== expectedFileName) {
							// File needs to be renamed
							const newFilePath = `${collectionFolder}/${expectedFileName}`;
							
							// Ensure collection folder exists
							if (!await this.app.vault.adapter.exists(collectionFolder)) {
								await this.app.vault.createFolder(collectionFolder);
							}
							
							// Write content to new location and delete old file
							await this.app.vault.adapter.write(newFilePath, renderedContent);
							await this.app.vault.adapter.remove(existingFilePath);
						} else {
							// Just update content
							await this.app.vault.adapter.write(existingFilePath, renderedContent);
						}
					} else {
						// New item, create it
						if (!await this.app.vault.adapter.exists(collectionFolder)) {
							await this.app.vault.createFolder(collectionFolder);
						}
						await this.app.vault.adapter.write(filePath, renderedContent);
					}
				}

			} else {
				// Full Sync Logic
				if (!await this.app.vault.adapter.exists(fileViewFolder)) {
					await this.app.vault.createFolder(fileViewFolder);
				}

				const selectedCollections = allApiCollections.filter(c => this.settings.collectionIds.includes(c._id));

				for (const collection of selectedCollections) {
					let raindrops = await getRaindrops(this.settings, collection._id);
					if (highlightIdSet) {
						raindrops = raindrops.filter(r => highlightIdSet!.has(r._id));
					}
					
					// Nur Ordner erstellen und Dateien schreiben wenn Bookmarks vorhanden
					if (raindrops && raindrops.length > 0) {
						const collectionFolder = `${fileViewFolder}/${this.sanitizeForPath(collection.title)}`;
						if (!await this.app.vault.adapter.exists(collectionFolder)) {
							await this.app.vault.createFolder(collectionFolder);
						}

						totalSyncedItems += raindrops.length;
						for (const raindrop of raindrops) {
							const [_, collectionPath] = getCollectionPath(raindrop.collection.$id);
							const raindropWithContext = {
								...raindrop,
								collectionPath,
							};
							const renderedContent = template(raindropWithContext);
							const fileName = `${this.generateFileName(raindrop)}.md`;
							const filePath = `${collectionFolder}/${fileName}`;
							await this.app.vault.adapter.write(filePath, renderedContent);
						}
					}
				}

				// Handle "Unsorted" files creation separately
				if (this.settings.collectionIds.includes(0)) {
					let raindrops = await getRaindrops(this.settings, 0);
					if (highlightIdSet) {
						raindrops = raindrops.filter(r => highlightIdSet!.has(r._id));
					}
					
					// Nur Ordner erstellen wenn Bookmarks vorhanden
					if (raindrops && raindrops.length > 0) {
						const unsortedFolder = `${fileViewFolder}/Unsorted`;
						if (!await this.app.vault.adapter.exists(unsortedFolder)) {
							await this.app.vault.createFolder(unsortedFolder);
						}

						totalSyncedItems += raindrops.length;
						for (const raindrop of raindrops) {
							const raindropWithContext = {
								...raindrop,
								collectionPath: 'Unsorted',
							};
							const renderedContent = template(raindropWithContext);
							const fileName = `${this.generateFileName(raindrop)}.md`;
							const filePath = `${unsortedFolder}/${fileName}`;
							await this.app.vault.adapter.write(filePath, renderedContent);
						}
					}
				}
			}

			// After creating all files, regenerate the index
			await this.generateFileViewIndex();
            
			new Notice(incremental 
				? `Incremental sync complete (File View). ${totalSyncedItems} items synced.`
				: `Sync complete (File View). ${totalSyncedItems} items synced.`
			);

			this.settings.lastSyncFileView = new Date().toISOString();
			await this.saveSettings();

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
			
			if (!await this.app.vault.adapter.exists(fileViewFolder)) {
				await this.app.vault.createFolder(fileViewFolder);
			}
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
				const fromClause = `"${fileViewFolder}/${this.sanitizeForPath(node.collection.title)}"`;
				console.log('Dataview FROM:', fromClause);
				
				// Prüfe ob der Collection-Ordner existiert und Dateien enthält
				const collectionFolder = `${fileViewFolder}/${this.sanitizeForPath(node.collection.title)}`;
				console.log('Collection folder:', collectionFolder);
				let hasFiles = false;
				if (await this.app.vault.adapter.exists(collectionFolder)) {
					try {
						const files = await this.app.vault.adapter.list(collectionFolder);
						hasFiles = files.files && files.files.length > 0;
					} catch (e) {
						hasFiles = false;
					}
				}

				// Sammle Content von Kindern
				let childrenToc = '';
				let childrenContent = '';
				for (const child of node.children) {
					const [childToc, childContent] = await processNode(child, level + 1);
					childrenToc += childToc;
					childrenContent += childContent;
				}

				const hasChildrenContent = childrenContent.trim().length > 0;

				// Nur Content generieren wenn diese Collection Dateien hat oder Kinder Content haben
				if (hasFiles || hasChildrenContent) {
					toc += `${'  '.repeat(level-1)}- [[#${title}]]\n`;
					content += `${'#'.repeat(level)} ${title}\n\n`;

					if (hasFiles) {
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

`;
					}

					toc += childrenToc;
					content += childrenContent;
				}

				return [toc, content];
			};

			for (const rootNode of rootNodes) {
				const [toc, content] = await processNode(rootNode, 1);
				
				if (content) {
					const finalContent = '# Table of Contents\n' + toc + '---\n\n' + content + `\n---\n*Index created at ${new Date().toLocaleString()}${this.settings.lastSyncFileView ? ` / Data last updated ${new Date(this.settings.lastSyncFileView).toLocaleString()}` : ''}*\n`;
					const fileName = `${this.sanitizeForFile(rootNode.collection.title)}.md`;
					const filePath = `${indexFolder}/${fileName}`;
					console.log('Index filePath:', filePath);
					await this.app.vault.adapter.write(filePath, finalContent);
				}
			}

			// Handle "Unsorted" collection
			if (this.settings.collectionIds.includes(0)) {
				const unsortedFolder = `${fileViewFolder}/Unsorted`;
				console.log('Unsorted folder:', unsortedFolder);
				
				// Prüfe ob der Unsorted-Ordner existiert und Dateien enthält
				let hasFiles = false;
				if (await this.app.vault.adapter.exists(unsortedFolder)) {
					try {
						const files = await this.app.vault.adapter.list(unsortedFolder);
						hasFiles = files.files && files.files.length > 0;
					} catch (e) {
						hasFiles = false;
					}
				}

				// Nur Index-Datei erstellen wenn Dateien vorhanden
				if (hasFiles) {
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

---
*Index created at ${new Date().toLocaleString()}${this.settings.lastSyncFileView ? ` / Data last updated ${new Date(this.settings.lastSyncFileView).toLocaleString()}` : ''}*
`;
					const filePath = `${indexFolder}/Unsorted.md`;
					console.log('Unsorted index filePath:', filePath);
					await this.app.vault.adapter.write(filePath, dataviewContent.trim());
				}
			}

			new Notice('File view index regenerated.');
		} catch (e) {
			new Notice('A critical error occurred during index generation. Check your settings and connection.');
			console.error(e);
		}
	}

	async renameFileViewFiles() {
		if (!this.settings.collectionIds || this.settings.collectionIds.length === 0) {
			new Notice('No collections selected.');
			return;
		}

		try {
			new Notice('Starting file rename process...');
			const fileViewFolder = this.settings.fileViewStorageFolder;
			
			// Get all collections for mapping
			const collections = await getCollections(this.settings);
			const collectionsMap = new Map(collections.map(c => [c._id, c]));
			
			let renamedCount = 0;

			// Process each selected collection
			for (const collectionId of this.settings.collectionIds) {
				if (collectionId === 0) continue; // Skip unsorted for now, handle separately
				
				const raindrops = await getRaindrops(this.settings, collectionId);
				const collectionName = collectionsMap.get(collectionId)?.title || 'Unknown';
				const collectionFolder = `${fileViewFolder}/${this.sanitizeForPath(collectionName)}`;
				
				for (const raindrop of raindrops) {
					const newFileName = `${this.generateFileName(raindrop)}.md`;
					const newFilePath = `${collectionFolder}/${newFileName}`;
					
					// Find existing file with raindropId in frontmatter
					const allFiles = this.app.vault.getMarkdownFiles();
					const matchingFiles = allFiles.filter(file => {
						const cache = this.app.metadataCache.getFileCache(file);
						return cache?.frontmatter?.raindropId === raindrop._id;
					});
					
					if (matchingFiles.length > 0) {
						const existingFile = matchingFiles[0];
						const existingFilePath = existingFile.path;
						
						// Only rename if the file path is different
						if (existingFilePath !== newFilePath) {
							// Ensure target directory exists
							if (!await this.app.vault.adapter.exists(collectionFolder)) {
								await this.app.vault.createFolder(collectionFolder);
							}
							
							// Rename the file
							await this.app.vault.rename(existingFile, newFilePath);
							renamedCount++;
						}
					}
				}
			}

			// Handle Unsorted files
			if (this.settings.collectionIds.includes(0)) {
				const raindrops = await getRaindrops(this.settings, 0);
				const unsortedFolder = `${fileViewFolder}/Unsorted`;
				
				for (const raindrop of raindrops) {
					const newFileName = `${this.generateFileName(raindrop)}.md`;
					const newFilePath = `${unsortedFolder}/${newFileName}`;
					
					// Find existing file with raindropId in frontmatter
					const allFiles = this.app.vault.getMarkdownFiles();
					const matchingFiles = allFiles.filter(file => {
						const cache = this.app.metadataCache.getFileCache(file);
						return cache?.frontmatter?.raindropId === raindrop._id;
					});
					
					if (matchingFiles.length > 0) {
						const existingFile = matchingFiles[0];
						const existingFilePath = existingFile.path;
						
						// Only rename if the file path is different
						if (existingFilePath !== newFilePath) {
							// Ensure target directory exists
							if (!await this.app.vault.adapter.exists(unsortedFolder)) {
								await this.app.vault.createFolder(unsortedFolder);
							}
							
							// Rename the file
							await this.app.vault.rename(existingFile, newFilePath);
							renamedCount++;
						}
					}
				}
			}

			new Notice(`File rename complete. ${renamedCount} files renamed.`);
			
			// Regenerate index after renaming
			await this.generateFileViewIndex();
			
		} catch (e) {
			new Notice('A critical error occurred during file rename. Check your settings and connection.');
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
