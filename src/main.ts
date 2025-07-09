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

// Remember to rename these classes and interfaces!

export interface RaindropSyncSettings {
	apiToken: string;
	storageFolder: string;
	collectionIds: number[];
	expandedCollectionIds: number[];
	cascadeSelection: boolean;
	template: string;
}

const DEFAULT_SETTINGS: RaindropSyncSettings = {
	apiToken: '',
	storageFolder: 'Raindrop',
	collectionIds: [],
	expandedCollectionIds: [],
	cascadeSelection: true,
	template: `- [{{title}}]({{link}}) *{{getBaseUrl link}}*
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

		Handlebars.registerHelper('formatText', function (text: string) {
			if (!text) return '';
			// Escape hashtags to prevent them from being interpreted as Obsidian tags
			let escaped = text.replace(/#/g, '\\#');
			// Split by paragraphs (double newlines or single newlines) and create list items
			const paragraphs = escaped.split(/\n+/).filter(p => p.trim() !== '');
			if (paragraphs.length <= 1) {
				return escaped;
			}
			// Return first paragraph normally, additional paragraphs as sub-list items
			const firstParagraph = paragraphs[0];
			const additionalParagraphs = paragraphs.slice(1).map(p => `            - ${p}`).join('\n');
			return firstParagraph + (additionalParagraphs ? '\n' + additionalParagraphs : '');
		});

		Handlebars.registerHelper('formatHighlightText', function (text: string) {
			if (!text) return '';
			// Escape hashtags to prevent them from being interpreted as Obsidian tags
			let escaped = text.replace(/#/g, '\\#');
			// Split by paragraphs (double newlines or single newlines) and create list items
			const paragraphs = escaped.split(/\n+/).filter(p => p.trim() !== '');
			if (paragraphs.length <= 1) {
				return escaped;
			}
			// Return first paragraph normally, additional paragraphs as sub-list items
			const firstParagraph = paragraphs[0];
			const additionalParagraphs = paragraphs.slice(1).map(p => `        - ${p}`).join('\n');
			return firstParagraph + (additionalParagraphs ? '\n' + additionalParagraphs : '');
		});


		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'sync-raindrop-bookmarks',
			name: 'Sync Raindrop Bookmarks',
			callback: () => this.sync()
		});

		// This adds a ribbon icon for quick access to sync
		this.addRibbonIcon('refresh-cw', 'Sync Raindrop Bookmarks', (evt: MouseEvent) => {
			this.sync();
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
				.setName('Cascade selection')
				.setDesc('Automatically select/deselect parent and child collections.')
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.cascadeSelection)
					.onChange(async (value) => {
						this.plugin.settings.cascadeSelection = value;
						await this.plugin.saveSettings();
					}));


			const collectionContainer = containerEl.createDiv('raindrop-collection-container');

			try {
				const collections = await getCollections(this.plugin.settings);
				const list = collectionContainer.createEl('ul', { cls: 'raindrop-collection-list' });

				// --- UI for "Unsorted" ---
				const unsortedItem = list.createEl('li');
				new Setting(unsortedItem)
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


				// --- Build Tree and helper maps ---
				const nodes: Record<number, CollectionNode> = {};
				const childToParentMap: Record<number, number> = {};
				collections.forEach(c => {
					nodes[c._id] = { collection: c, children: [] };
					if (c.parent?.$id) {
						childToParentMap[c._id] = c.parent.$id;
					}
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
					const itemEl = parentEl.createEl('li');
					const isExpanded = this.plugin.settings.expandedCollectionIds.includes(node.collection._id);

					// Manually create the setting item structure
					const settingItemEl = itemEl.createDiv({ cls: 'setting-item' });
					const settingItemInfoEl = settingItemEl.createDiv({ cls: 'setting-item-info' });
			
					// Our custom name container
					const nameEl = settingItemInfoEl.createDiv({ cls: 'setting-item-name raindrop-custom-name' });

					// Arrow
					const arrowEl = nameEl.createDiv({ cls: 'raindrop-arrow' });
					if (node.children.length > 0) {
						arrowEl.setText(isExpanded ? '▼' : '►');
					} else {
						arrowEl.addClass('raindrop-arrow-spacer');
					}

					// Icon
					if (node.collection.cover && node.collection.cover.length > 0) {
						nameEl.createEl('img', {
							attr: { src: node.collection.cover[0] },
							cls: 'raindrop-icon'
						});
					}
					
					// Title
					nameEl.createSpan({ text: node.collection.title });

					// Child count
					if (node.children.length > 0) {
						nameEl.createSpan({
							text: `(${node.children.length})`,
							cls: 'raindrop-child-count'
						});
					}

					// Control element for the toggle
					const controlEl = settingItemEl.createDiv({ cls: 'setting-item-control' });
					new ToggleComponent(controlEl)
						.setValue(this.plugin.settings.collectionIds.includes(node.collection._id))
						.onChange(async (value) => {
							const { collectionIds, cascadeSelection, expandedCollectionIds } = this.plugin.settings;
							const nodeId = node.collection._id;

							if (cascadeSelection) {
								// Downward cascade
								if (!value) {
									const descendantIds = (function getDescendants(n: CollectionNode): number[] {
										let ids = [n.collection._id];
										n.children.forEach(child => ids = ids.concat(getDescendants(child)));
										return ids;
									})(node);
									this.plugin.settings.collectionIds = collectionIds.filter(id => !descendantIds.includes(id));
								} else {
								// Upward cascade & auto-expand
									if (!collectionIds.includes(nodeId)) collectionIds.push(nodeId);
									let currentId = nodeId;
									while (childToParentMap[currentId]) {
										currentId = childToParentMap[currentId];
										if (!collectionIds.includes(currentId)) collectionIds.push(currentId);
									}
									if (node.children.length > 0 && !expandedCollectionIds.includes(nodeId)) {
										expandedCollectionIds.push(nodeId);
									}
								}
							} else {
								// Original non-cascade behavior
								if (value) {
									if (!collectionIds.includes(nodeId)) collectionIds.push(nodeId);
								} else {
									this.plugin.settings.collectionIds = collectionIds.filter(id => id !== nodeId);
								}
							}
							
							await this.plugin.saveSettings();
							this.display(); // Re-render to show all changes
						});

					// Children
					let childrenEl: HTMLElement | null = null;
					if (node.children.length > 0) {
						childrenEl = itemEl.createEl('ul');
						if (!isExpanded) {
							childrenEl.style.display = 'none';
						}
						node.children
							.sort((a,b) => a.collection.title.localeCompare(b.collection.title))
							.forEach(child => renderNode(child, childrenEl));
					}

					// Click handler for collapsing
					nameEl.onClickEvent(() => {
						if (!childrenEl) return;
						
						const index = this.plugin.settings.expandedCollectionIds.indexOf(node.collection._id);
						if (index > -1) {
							this.plugin.settings.expandedCollectionIds.splice(index, 1);
						} else {
							this.plugin.settings.expandedCollectionIds.push(node.collection._id);
						}
						this.plugin.saveSettings();
						this.display(); // Re-render to show changes
					});
				};
				
				rootNodes.sort((a,b) => a.collection.title.localeCompare(b.collection.title)).forEach(node => renderNode(node, list));
				
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

		const templateSetting = new Setting(containerEl)
			.setName('Bookmark Template')
			.setDesc('')
			.setClass('raindrop-template-setting');
		
		// Create custom layout with 50/50 split
		const templateContainer = templateSetting.settingEl.createDiv({ cls: 'raindrop-template-container' });
		
		// Left side - Description
		const descriptionDiv = templateContainer.createDiv({ cls: 'raindrop-template-description' });
		descriptionDiv.innerHTML = `
			<div class="setting-item-description">
				<strong>Handlebars template for each bookmark item.</strong><br><br>
				
				<strong>Available Variables:</strong><br>
				<code>{{title}}</code> - Bookmark title<br>
				<code>{{link}}</code> - URL of the bookmark<br>
				<code>{{excerpt}}</code> - Description/excerpt<br>
				<code>{{note}}</code> - Personal note<br>
				<code>{{created}}</code> - Creation date<br>
				<code>{{tags}}</code> - Array of tags<br>
				<code>{{highlights}}</code> - Array of highlights<br><br>
				
				<strong>Helper Functions:</strong><br>
				<code>{{formatDate created}}</code> - Formats date as YYYY-MM-DD<br>
				<code>{{formatTags tags}}</code> - Converts tags to #tag format<br>
				<code>{{getBaseUrl link}}</code> - Extracts hostname from URL<br>
				<code>{{formatText text}}</code> - Formats notes with paragraphs as sub-bullets<br>
				<code>{{formatHighlightText text}}</code> - Formats highlights with paragraphs as sub-bullets
			</div>
		`;
		
		// Right side - Textarea
		const textareaDiv = templateContainer.createDiv({ cls: 'raindrop-template-textarea' });
		const textArea = new TextAreaComponent(textareaDiv)
			.setPlaceholder('Enter your template')
			.setValue(this.plugin.settings.template)
			.onChange(async (value: string) => {
				this.plugin.settings.template = value;
				await this.plugin.saveSettings();
			});

		textArea.inputEl.style.height = '200px';
		textArea.inputEl.style.width = '100%';

		// Add reset button as new setting below
		new Setting(containerEl)
			.setName('')
			.setDesc('')
			.addButton(button => button
				.setButtonText('Reset Template to Default')
				.setCta()
				.onClick(async () => {
					this.plugin.settings.template = DEFAULT_SETTINGS.template;
					await this.plugin.saveSettings();
					this.display();
				})
			);
	}

	private createFragmentWithHTML(html: string) {
		const fragment = document.createDocumentFragment();
		const descEl = document.createElement('div');
		descEl.innerHTML = html;
		fragment.appendChild(descEl);
		return fragment;
    }
}


