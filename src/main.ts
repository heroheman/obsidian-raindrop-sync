import { Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { getCollections, getRaindrops, RaindropCollection } from './api';
import * as Handlebars from 'handlebars';

// Remember to rename these classes and interfaces!

export interface RaindropSyncSettings {
	apiToken: string;
	storageFolder: string;
	collectionIds: number[];
	template: string;
}

const DEFAULT_SETTINGS: RaindropSyncSettings = {
	apiToken: '',
	storageFolder: 'Raindrop',
	collectionIds: [],
	template: `- [{{title}}]({{link}}) *{{getBaseUrl link}}* - {{formatDate created}}
    {{#if tags.length}}
    - Tags: {{formatTags tags}}
    {{/if}}
    {{#if note}}
    - **Note**: {{{note}}}
    {{/if}}
    {{#if highlights.length}}
    - **Highlights**
    {{#each highlights}}
        - {{{text}}}
        {{#if note}}
            - *Note: {{{note}}}*
        {{/if}}
    {{/each}}
    {{/if}}`
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

		Handlebars.registerHelper('getBaseUrl', function (url: string) {
			if (!url) return '';
			try {
				return new URL(url).hostname;
			} catch (e) {
				return ''; // Return empty string if URL is invalid
			}
		});


		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'sync-raindrop-bookmarks',
			name: 'Sync Raindrop Bookmarks',
			callback: () => this.sync()
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new RaindropSyncSettingTab(this.app, this));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async sync() {
		if (!this.settings.collectionIds || this.settings.collectionIds.length === 0) {
			new Notice('No collections selected to sync.');
			return;
		}
		
		try {
			new Notice('Syncing Raindrop bookmarks...');

			const allApiCollections = await getCollections(this.settings);
			const folder = this.settings.storageFolder;
			
			if (!await this.app.vault.adapter.exists(folder)) {
				await this.app.vault.createFolder(folder);
			}

			const template = Handlebars.compile(this.settings.template);

			const processCollection = async (collection: RaindropCollection | { _id: number, title: string, parent?: any }) => {
				try {
					const raindrops = await getRaindrops(this.settings, collection._id);
					if (!raindrops || raindrops.length === 0) {
						return 0; // Skip empty collections
					}

					let content = '';
					const sanitizedCollectionTitle = collection.title.replace(/[\\/:"*?<>|]/g, '');

					if (collection._id > 0) {
						const parent = allApiCollections.find(p => p._id === collection.parent?.$id);
						const children = allApiCollections.filter(c => c.parent?.$id === collection._id);
						const siblings = parent ? allApiCollections.filter(s => s.parent?.$id === parent._id && s._id !== collection._id) : [];

						const sanitizeForLink = (title: string) => title.replace(/[\\/:"*?<>|]/g, '');

						if (parent) content += `Parent: [[${sanitizeForLink(parent.title)}]]\n`;
						if (siblings.length > 0) content += `Siblings: ${siblings.map(s => `[[${sanitizeForLink(s.title)}]]`).join(' ')}\n`;
						if (children.length > 0) content += `Children: ${children.map(c => `[[${sanitizeForLink(c.title)}]]`).join(' ')}\n`;
						if (content.length > 0) content += `\n---\n\n`;
					}
					
					raindrops.forEach(raindrop => {
						content += template(raindrop) + '\n';
					});

					const filePath = `${folder}/${sanitizedCollectionTitle}.md`;
					await this.app.vault.adapter.write(filePath, content);
					return 1;
				} catch (error) {
					console.error(`Failed to sync collection: ${collection.title}`, error);
					new Notice(`Failed to sync collection: ${collection.title}`);
					return 0;
				}
			};

			const allPossibleCollections = [
				...allApiCollections,
				{ _id: 0, title: 'Unsorted' }
			];

			const collectionsToSync = allPossibleCollections.filter(c => this.settings.collectionIds.includes(c._id));

			if (collectionsToSync.length === 0) {
				new Notice('No collections to sync.');
				return;
			}
			
			const results = await Promise.all(collectionsToSync.map(processCollection));
			const syncedCount = results.reduce((sum, result) => sum + result, 0);

			if (syncedCount > 0) {
				new Notice(`Successfully synced ${syncedCount} collection(s).`);
			} else {
				new Notice('Sync complete, but no collections were updated.');
			}

		} catch (e) {
			new Notice('A critical error occurred during sync. Check your settings and connection.');
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
	
	async display(): Promise<void> {
		const {containerEl} = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Raindrop.io API Token')
			.setDesc('Your personal API token for Raindrop.io.')
			.addText(text => text
				.setPlaceholder('Enter your token')
				.setValue(this.plugin.settings.apiToken)
				.onChange(async (value) => {
					this.plugin.settings.apiToken = value;
					await this.plugin.saveSettings();
					this.display(); // Refresh settings to load collections
				}));

		if (this.plugin.settings.apiToken) {
			new Setting(containerEl)
				.setName('Collections to Sync')
				.setDesc('Select the collections you want to sync.');
			
			const collectionContainer = containerEl.createDiv('raindrop-collection-container');

			try {
				const collections = await getCollections(this.plugin.settings);

				// --- UI for "Unsorted" ---
				new Setting(collectionContainer)
					.setName("Unsorted")
					.setDesc("Bookmarks that aren't in any collection.")
					.addToggle(toggle => toggle
						.setValue(this.plugin.settings.collectionIds.includes(0))
						.onChange(async (value) => {
							const { collectionIds } = this.plugin.settings;
							if (value) {
								if (!collectionIds.includes(0)) collectionIds.push(0);
							} else {
								this.plugin.settings.collectionIds = collectionIds.filter(id => id !== 0);
							}
							await this.plugin.saveSettings();
						}));


				// --- Build Tree from flat list ---
				const nodes: Record<number, CollectionNode> = {};
				collections.forEach(c => {
					nodes[c._id] = { collection: c, children: [] };
				});

				const rootNodes: CollectionNode[] = [];
				collections.forEach(c => {
					const parentId = c.parent?.$id;
					if (parentId && nodes[parentId]) {
						nodes[parentId].children.push(nodes[c._id]);
					} else {
						rootNodes.push(nodes[c._id]);
					}
				});


				// --- Render Tree recursively ---
				const renderNode = (node: CollectionNode, parentEl: HTMLElement) => {
					const itemEl = parentEl.createDiv({ cls: 'raindrop-collection-item' });
					
					new Setting(itemEl)
						.setName(node.collection.title)
						.addToggle(toggle => toggle
							.setValue(this.plugin.settings.collectionIds.includes(node.collection._id))
							.onChange(async (value) => {
								const { collectionIds } = this.plugin.settings;
								if (value) {
									if (!collectionIds.includes(node.collection._id)) collectionIds.push(node.collection._id);
								} else {
									this.plugin.settings.collectionIds = collectionIds.filter(id => id !== node.collection._id);
								}
								await this.plugin.saveSettings();
							})
						);

					if (node.children.length > 0) {
						const childrenEl = itemEl.createDiv({ cls: 'raindrop-collection-children' });
						node.children.forEach(child => renderNode(child, childrenEl));
					}
				};
				
				rootNodes.forEach(node => renderNode(node, collectionContainer));
				
			} catch (e) {
				new Notice('Failed to fetch Raindrop collections. Check your API token.');
				console.error(e);
			}
		}

		new Setting(containerEl)
			.setName('Storage Folder')
			.setDesc('The folder in your vault to store the synchronized bookmarks.')
			.addText(text => text
				.setPlaceholder('e.g., Raindrop')
				.setValue(this.plugin.settings.storageFolder)
				.onChange(async (value) => {
					this.plugin.settings.storageFolder = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Bookmark Template')
			.setDesc('Handlebars template for formatting each bookmark item.')
			.addTextArea(text => {
				text
					.setPlaceholder('Enter your template')
					.setValue(this.plugin.settings.template)
					.onChange(async (value) => {
						this.plugin.settings.template = value;
						await this.plugin.saveSettings();
					});
				text.inputEl.style.height = '200px';
				text.inputEl.style.width = '100%';
			});
	}
}


