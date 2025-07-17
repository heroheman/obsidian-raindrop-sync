<template>
  <div class="raindrop-settings">
    <h2>Raindrop Sync</h2>

    <!-- General Settings -->
    <h3>Global</h3>
    <div class="setting-item">
      <div class="setting-item-info">
        <div class="setting-item-name">API Token</div>
        <div class="setting-item-description">
          Enter your Raindrop.io API token. You can create one from the <a href="https://app.raindrop.io/settings/integrations">integrations settings</a>.
        </div>
      </div>
      <div class="setting-item-control">
        <div class="token-row">
          <input type="password" v-model="localSettings.apiToken" @input="() => { updateSettings(); resetTokenStatus(); }" placeholder="Enter your token" aria-label="Raindrop.io API Token">
          <button
            type="button"
            class="test-token-btn"
            :class="{
              success: tokenStatus.status === 'success',
              error: tokenStatus.status === 'error'
            }"
            @click="testApiToken"
            :disabled="isTestingToken"
          >
            <span v-if="tokenStatus.status === 'success'">Success ✅</span>
            <span v-else-if="tokenStatus.status === 'error'">Error ❌</span>
            <span v-else>Token testen</span>
          </button>
        </div>
      </div>
    </div>
    <div class="setting-item">
      <div class="setting-item-info">
        <div class="setting-item-name">Last Sync (List View)</div>
        <div class="setting-item-description">
          The date of the last successful sync for List View. Clear this to force a full sync next time.
        </div>
      </div>
      <div class="setting-item-control">
  <input type="text" :value="formattedLastSyncListView" readonly aria-label="Last Sync Date (List View)">
        <button @click="clearLastSyncListView" class="mod-warning" v-if="localSettings.lastSyncListView">Clear</button>
      </div>
    </div>
    <div class="setting-item">
      <div class="setting-item-info">
        <div class="setting-item-name">Last Sync (File View)</div>
        <div class="setting-item-description">
          The date of the last successful sync for File View. Clear this to force a full sync next time.
        </div>
      </div>
      <div class="setting-item-control">
  <input type="text" :value="formattedLastSyncFileView" readonly aria-label="Last Sync Date (File View)">
        <button @click="clearLastSyncFileView" class="mod-warning" v-if="localSettings.lastSyncFileView">Clear</button>
      </div>
    </div>
    <div class="setting-item">
      <div class="setting-item-info">
        <div class="setting-item-name">Sync only bookmarks with highlights</div>
        <div class="setting-item-description">
          If enabled, only bookmarks that have highlights will be synchronized.
        </div>
      </div>
      <div class="setting-item-control">
        <label class="switch">
          <input type="checkbox" v-model="localSettings.onlyBookmarksWithHighlights" @change="updateSettings" aria-label="Sync only bookmarks with highlights">
          <span class="slider round"></span>
        </label>
      </div>
    </div>

    <!-- Collections Settings -->
    <h3>Collections</h3>
    <div class="setting-item">
      <div class="setting-item-info">
        <div class="setting-item-name">Cascading Selection</div>
        <div class="setting-item-description">Automatically select/deselect child collections when a parent is selected/deselected.</div>
      </div>
      <div class="setting-item-control">
        <label class="switch">
          <input type="checkbox" v-model="localSettings.cascadeSelection" @change="updateSettings" aria-label="Cascading Selection">
          <span class="slider round"></span>
        </label>
      </div>
    </div>
    <div v-if="isLoading" class="loading">Loading collections...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else class="collections-tree">
      <CollectionNode
        v-for="node in collectionTree"
        :key="node.collection._id"
        :node="node"
        :settings="localSettings"
        @toggle-expand="handleToggleExpand"
        @toggle-select="handleToggleSelect"
      />
      <div class="setting-item unsorted-toggle">
        <div class="setting-item-info">
          <div class="setting-item-name">Unsorted</div>
          <div class="setting-item-description">Include bookmarks that are not in any collection.</div>
        </div>
        <div class="setting-item-control">
          <label class="switch">
            <input type="checkbox" :checked="isUnsortedSelected" @change="handleToggleUnsorted" aria-label="Include unsorted bookmarks">
            <span class="slider round"></span>
          </label>
        </div>
      </div>
    </div>
    
    <!-- Highlight Settings -->
    <h3>Highlight Settings</h3>
    <div class="hint-text">
        Note: Changes to highlight settings require a full re-sync of the affected files.
    </div>
    <div class="setting-item">
      <div class="setting-item-info">
        <div class="setting-item-name">Enable Highlights</div>
        <div class="setting-item-description">Render bookmark highlights using <code>&lt;mark&gt;</code> tags or <code>==standard markdown==</code>.</div>
      </div>
      <div class="setting-item-control">
        <label class="switch">
          <input type="checkbox" v-model="localSettings.useMarkdownHighlights" @change="updateSettings" aria-label="Enable Highlights">
          <span class="slider round"></span>
        </label>
      </div>
    </div>
    <div class="setting-item">
      <div class="setting-item-info">
        <div class="setting-item-name">Colored Highlights</div>
        <div class="setting-item-description">Apply "realistic" highlight colors from Raindrop.io. If disabled, a default yellow highlight is used.</div>
      </div>
      <div class="setting-item-control">
        <label class="switch">
          <input type="checkbox" v-model="localSettings.useColoredHighlights" @change="updateSettings" aria-label="Colored Highlights">
          <span class="slider round"></span>
        </label>
      </div>
    </div>

    <!-- View-specific Settings -->
    <h3>View Options</h3>
    <div class="view-switcher">
  <button :class="{ active: settingsView === 'list' }" @click="settingsView = 'list'" aria-label="List View">List View</button>
  <button :class="{ active: settingsView === 'file' }" @click="settingsView = 'file'" aria-label="File View">File View</button>
    </div>

    <div class="hint-text view-description">
      <div v-if="settingsView === 'list'">
        Generates a single Markdown file for each root collection, listing all selected bookmarks hierarchically. This view is ideal for creating simple, readable "Table of Contents" style documents from your bookmarks. It's fast, efficient, and great for overviews.
      </div>
      <div v-if="settingsView === 'file'">
        Creates an individual Markdown file for each bookmark and generates powerful index files with Dataview tables to navigate them. This view treats each bookmark as a separate note in your vault, enabling you to link to them, tag them, and query them using Obsidian's native features and the Dataview plugin. This is the recommended approach for deep integration with your knowledge base.
      </div>
    </div>

    <!-- List View Settings -->
    <div v-if="settingsView === 'list'">
      <div class="setting-item">
        <div class="setting-item-info">
          <div class="setting-item-name">Show Ribbon Icon</div>
          <div class="setting-item-description">Display a ribbon icon to sync bookmarks using the List View. Requires a reload to take effect.</div>
        </div>
        <div class="setting-item-control">
          <label class="switch">
            <input type="checkbox" v-model="localSettings.showRibbonList" @change="updateSettings" aria-label="Show Ribbon Icon (List View)">
            <span class="slider round"></span>
          </label>
        </div>
      </div>
      <div class="setting-item">
        <div class="setting-item-info">
          <div class="setting-item-name">Storage Folder</div>
          <div class="setting-item-description">The folder where your Raindrop bookmarks file will be stored.</div>
        </div>
        <div class="setting-item-control">
          <input type="text" v-model="localSettings.storageFolder" @input="updateSettings" placeholder="e.g., Raindrop" aria-label="Storage Folder">
        </div>
      </div>
      <div class="setting-item">
        <div class="setting-item-info">
            <div class="setting-item-name">Content Template</div>
            <div class="setting-item-description">Define the template for each bookmark using Handlebars.</div>
        </div>
      </div>
      <textarea v-model="localSettings.template" @input="updateSettings"></textarea>
      <div class="hint-text template-help">
        <p><b>Available Variables:</b></p>
        <ul>
          <li><code>_id, title, link, excerpt, note, cover, tags, highlights, created, lastUpdate, type, domain</code></li>
        </ul>
        <p><b>Available Helpers:</b></p>
        <ul>
          <li><code>formatDate date</code>, <code>formatTags tags</code>, <code>formatText text</code>, <code>formatHighlightText highlight</code></li>
          <li><code>raindropUrl .</code> - Direct URL to the Raindrop item</li>
          <li><code>raindropLink .</code> - Markdown link: [View Raindrop](url)</li>
        </ul>
      </div>
      <div class="setting-item-control template-actions">
          <button @click="emit('reset-template')">Reset to Default</button>
      </div>
    </div>

    <!-- File View Settings -->
    <div v-if="settingsView === 'file'">
      <div class="setting-item">
        <div class="setting-item-info">
          <div class="setting-item-name">Show Ribbon Icon</div>
          <div class="setting-item-description">Display a ribbon icon to sync bookmarks using the File View. Requires a reload to take effect.</div>
        </div>
        <div class="setting-item-control">
          <label class="switch">
            <input type="checkbox" v-model="localSettings.showRibbonFile" @change="updateSettings" aria-label="Show Ribbon Icon (File View)">
            <span class="slider round"></span>
          </label>
        </div>
      </div>
      <div class="setting-item">
        <div class="setting-item-info">
          <div class="setting-item-name">Items Storage Folder</div>
          <div class="setting-item-description">The root folder where your individual bookmark files will be stored.</div>
        </div>
        <div class="setting-item-control">
          <input type="text" v-model="localSettings.fileViewStorageFolder" @input="updateSettings" placeholder="e.g., Raindrop/Items" aria-label="Items Storage Folder">
        </div>
      </div>
      <div class="setting-item">
        <div class="setting-item-info">
          <div class="setting-item-name">Index File Folder</div>
          <div class="setting-item-description">The folder where your Dataview index files will be stored.</div>
        </div>
        <div class="setting-item-control">
          <input type="text" v-model="localSettings.fileViewIndexFolder" @input="updateSettings" placeholder="e.g., Raindrop/Index" aria-label="Index File Folder">
        </div>
      </div>
      <h4>Dataview Columns</h4>
      <div class="setting-item">
        <div class="setting-item-info">
          <div class="setting-item-name">Show Cover</div>
          <div class="setting-item-description">Display the cover image in the Dataview table.</div>
        </div>
        <div class="setting-item-control">
          <label class="switch">
            <input type="checkbox" v-model="localSettings.fileViewDataviewColumns.cover" @change="updateSettings" aria-label="Show Cover">
            <span class="slider round"></span>
          </label>
        </div>
      </div>
      <div class="setting-item">
        <div class="setting-item-info">
          <div class="setting-item-name">Show Tags</div>
          <div class="setting-item-description">Display tags in the Dataview table.</div>
        </div>
        <div class="setting-item-control">
          <label class="switch">
            <input type="checkbox" v-model="localSettings.fileViewDataviewColumns.tags" @change="updateSettings" aria-label="Show Tags">
            <span class="slider round"></span>
          </label>
        </div>
      </div>
      <div class="setting-item">
        <div class="setting-item-info">
          <div class="setting-item-name">Show Highlights</div>
          <div class="setting-item-description">Display a checkmark if highlights exist.</div>
        </div>
        <div class="setting-item-control">
          <label class="switch">
            <input type="checkbox" v-model="localSettings.fileViewDataviewColumns.highlights" @change="updateSettings" aria-label="Show Highlights">
            <span class="slider round"></span>
          </label>
        </div>
      </div>
      <div class="setting-item">
        <div class="setting-item-info">
          <div class="setting-item-name">Show Notes</div>
          <div class="setting-item-description">Display a checkmark if notes exist.</div>
        </div>
        <div class="setting-item-control">
          <label class="switch">
            <input type="checkbox" v-model="localSettings.fileViewDataviewColumns.notes" @change="updateSettings" aria-label="Show Notes">
            <span class="slider round"></span>
          </label>
        </div>
      </div>
      <div class="setting-item">
        <div class="setting-item-info">
          <div class="setting-item-name">Show Type</div>
          <div class="setting-item-description">Display the bookmark type (e.g., article, video).</div>
        </div>
        <div class="setting-item-control">
          <label class="switch">
            <input type="checkbox" v-model="localSettings.fileViewDataviewColumns.type" @change="updateSettings" aria-label="Show Type">
            <span class="slider round"></span>
          </label>
        </div>
      </div>
      <h4>File Naming</h4>
      <div class="setting-item">
        <div class="setting-item-info">
          <div class="setting-item-name">Filename Template</div>
          <div class="setting-item-description">Template for generating filenames. Use the same variables as in templates.</div>
        </div>
        <div class="setting-item-control">
          <div class="filename-control">
            <input type="text" v-model="localSettings.fileViewFilenameTemplate" @input="updateSettings" placeholder="{{title}}" aria-label="Filename Template">
          </div>
        </div>
      </div>
      <div class="hint-text">
        <p><b>Available Variables:</b> &#123;&#123;raindropId&#125;&#125;, &#123;&#123;title&#125;&#125;, &#123;&#123;link&#125;&#125;, &#123;&#123;domain&#125;&#125;, &#123;&#123;type&#125;&#125;, &#123;&#123;creationDate&#125;&#125;</p>
        <p><b>Example:</b> &#123;&#123;creationDate&#125;&#125;-&#123;&#123;title&#125;&#125;-&#123;&#123;domain&#125;&#125;</p>
      </div>
	  <div class="setting-item">
		<div class="setting-item-info">
			<div class="setting-item-name">Rename Files</div>
			<div class="setting-item-description">
				<p><b>Rename Files:</b> Updates all existing File View files to match the current filename template. This operation is safe and preserves file content.</p>
			</div>
		</div>
		<div class="setting-item-control">
          <div class="filename-control">
            <button @click="renameFiles" :disabled="isRenamingFiles" class="mod-warning rename-btn">
              {{ isRenamingFiles ? 'Renaming...' : 'Rename Files' }}
            </button>
          </div>
		</div>
	  </div>
      <div class="setting-item">
        <div class="setting-item-info">
          <div class="setting-item-name">Date Format</div>
          <div class="setting-item-description">Format for date fields in filenames and templates.</div>
        </div>
        <div class="setting-item-control">
          <input type="text" v-model="localSettings.fileViewDateFormat" @input="updateSettings" placeholder="YYYY-MM-DD" aria-label="Date Format">
        </div>
      </div>
      <div class="hint-text">
        <p><b>Available Formats:</b> YYYY (year), MM (month), DD (day), HH (hour), mm (minute)</p>
        <p><b>Example:</b> YYYY-MM-DD or YYYY-MM-DD-HH-mm</p>
      </div>
	  <div class="setting-item">
		<div class="setting-item-info">
			<div class="setting-item-name">Rename Files</div>
			<div class="setting-item-description"></div>
		</div>
		<div class="setting-item-control">
          <div class="filename-control">
            <button @click="renameFiles" :disabled="isRenamingFiles" class="mod-warning rename-btn">
              {{ isRenamingFiles ? 'Renaming...' : 'Rename Files' }}
            </button>
          </div>
		</div>
	  </div>
		<div class="hint-text">
			<p><b>Rename Files:</b> Updates all existing File View files to match the current filename template. This operation is safe and preserves file content.</p>
		</div>
      <div class="setting-item">
        <div class="setting-item-info">
            <div class="setting-item-name">Bookmark File Template</div>
            <div class="setting-item-description">Define the template for individual bookmark files. Use YAML frontmatter for Dataview fields.</div>
        </div>
      </div>
      <textarea v-model="localSettings.fileViewTemplate" @input="updateSettings"></textarea>
      <div class="hint-text template-help">
        <p><b>Available Variables (in addition to List View variables):</b></p>
        <ul>
          <li><code>collection</code>, <code>collectionPath</code></li>
        </ul>
        <p><b>Available Helpers:</b></p>
        <ul>
          <li>All helpers from the List View are also available here.</li>
          <li><code>raindropUrl .</code> - Use as YAML frontmatter field and at end of file</li>
          <li><code>raindropLink .</code> - Markdown link for File View content</li>
        </ul>
      </div>
      <div class="setting-item-control template-actions">
          <button @click="emit('reset-file-template')">Reset to Default</button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
// Token-Test-Status
const tokenStatus = ref<{ status: 'idle' | 'success' | 'error' }>({ status: 'idle' });
const isTestingToken = ref(false);

function resetTokenStatus() {
  tokenStatus.value = { status: 'idle' };
}

async function testApiToken() {
  resetTokenStatus();
  if (!localSettings.value.apiToken) {
    tokenStatus.value = { status: 'error' };
    return;
  }
  isTestingToken.value = true;
  try {
    const resp = await fetch('https://api.raindrop.io/rest/v1/user', {
      headers: { 'Authorization': `Bearer ${localSettings.value.apiToken}` }
    });
    if (!resp.ok) {
      tokenStatus.value = { status: 'error' };
      return;
    }
    const data = await resp.json();
    if (data && data.user && data.user.fullName) {
      tokenStatus.value = { status: 'success' };
    } else {
      tokenStatus.value = { status: 'success' };
    }
  } catch (e) {
    tokenStatus.value = { status: 'error' };
  } finally {
    isTestingToken.value = false;
  }
}

// File renaming status and function
const isRenamingFiles = ref(false);

async function renameFiles() {
  isRenamingFiles.value = true;
  try {
    // Use Obsidian's command palette to execute the rename command
    // @ts-ignore - accessing global app from Obsidian
    await (window as any).app.commands.executeCommandById('raindrop-sync:rename-raindrop-files');
  } catch (e) {
    console.error('Error renaming files:', e);
  } finally {
    isRenamingFiles.value = false;
  }
}

import { defineProps, defineEmits, ref, watch, onMounted, computed } from 'vue';
import type { RaindropSyncSettings } from '../main';
import { getCollections, type RaindropCollection } from '../api';
import CollectionNode from './CollectionNode.vue';
import type { CollectionNode as CollectionNodeType } from './CollectionNode.vue';

// Define props passed from the Obsidian plugin
const props = defineProps<{
  settings: RaindropSyncSettings;
}>();

// Define events that the component can emit
const emit = defineEmits(['update-settings', 'reset-template', 'reset-file-template']);

// Create a local reactive copy of the settings
const localSettings = ref({ ...props.settings });
const isLoading = ref(false);
const error = ref<string | null>(null);
const collections = ref<RaindropCollection[]>([]);
const settingsView = ref<'list' | 'file'>('list');

const collectionTree = computed((): CollectionNodeType[] => {
  const nodes: Record<number, CollectionNodeType> = {};
  collections.value.forEach(c => {
    nodes[c._id] = { collection: { _id: c._id, title: c.title, cover: c.cover }, children: [] };
  });

  const rootNodes: CollectionNodeType[] = [];
  collections.value.forEach(c => {
    const parentId = c.parent?.$id;
    if (parentId && nodes[parentId]) {
      nodes[parentId].children.push(nodes[c._id]);
    } else {
      rootNodes.push(nodes[c._id]);
    }
  });

  return rootNodes;
});

const isUnsortedSelected = computed(() => {
  return localSettings.value.collectionIds.includes(0);
});

const handleToggleUnsorted = () => {
  if (isUnsortedSelected.value) {
    localSettings.value.collectionIds = localSettings.value.collectionIds.filter(id => id !== 0);
  } else {
    localSettings.value.collectionIds.push(0);
  }
  updateSettings();
};

const clearLastSyncListView = () => {
  localSettings.value.lastSyncListView = undefined;
  updateSettings();
};

const clearLastSyncFileView = () => {
  localSettings.value.lastSyncFileView = undefined;
  updateSettings();
};

const formattedLastSyncListView = computed(() => {
  if (!localSettings.value.lastSyncListView) {
    return 'Never synced';
  }
  return new Date(localSettings.value.lastSyncListView).toLocaleString();
});

const formattedLastSyncFileView = computed(() => {
  if (!localSettings.value.lastSyncFileView) {
    return 'Never synced';
  }
  return new Date(localSettings.value.lastSyncFileView).toLocaleString();
});

const handleToggleExpand = (id: number) => {
  const index = localSettings.value.expandedCollectionIds.indexOf(id);
  if (index > -1) {
    localSettings.value.expandedCollectionIds.splice(index, 1);
  } else {
    localSettings.value.expandedCollectionIds.push(id);
  }
  updateSettings();
};

const handleToggleSelect = (node: CollectionNodeType, state: boolean) => {
  const getDescendantIds = (n: CollectionNodeType): number[] => {
    let ids = [n.collection._id];
    n.children.forEach(child => ids = ids.concat(getDescendantIds(child)));
    return ids;
  };

  if (localSettings.value.cascadeSelection) {
    const descendantIds = getDescendantIds(node);
    if (state) {
      localSettings.value.collectionIds = [...new Set([...localSettings.value.collectionIds, ...descendantIds])];
    } else {
      localSettings.value.collectionIds = localSettings.value.collectionIds.filter(id => !descendantIds.includes(id));
    }
  } else {
    if (state) {
      if (!localSettings.value.collectionIds.includes(node.collection._id)) {
        localSettings.value.collectionIds.push(node.collection._id);
      }
    } else {
      localSettings.value.collectionIds = localSettings.value.collectionIds.filter(id => id !== node.collection._id);
    }
  }
  updateSettings();
};

watch(() => props.settings, (newSettings) => {
  localSettings.value = { ...newSettings };
});

// Function to update settings and emit to the plugin
const updateSettings = () => {
  emit('update-settings', localSettings.value);
};

const fetchCollections = async () => {
  if (!localSettings.value.apiToken) {
    error.value = "API token is not set. Please add your token to load collections.";
    return;
  }

  isLoading.value = true;
  error.value = null;
  try {
    collections.value = await getCollections(localSettings.value);
  } catch (e) {
    console.error("Failed to load Raindrop collections:", e);
    error.value = "Failed to load collections. Check your API token and network connection.";
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  fetchCollections();
});
</script>

<style scoped>
/* Token-Test-Button und Status */
.token-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.test-token-btn {
  padding: 4px 10px;
  font-size: 0.95em;
  border-radius: 4px;
  border: 1px solid var(--background-modifier-border, #ccc);
  background: var(--background-secondary, #f5f5f5);
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}
.test-token-btn.success {
  background: #2e7d32 !important;
  color: #fff;
  border-color: #2e7d32;
}
.test-token-btn.error {
  background: #c62828 !important;
  color: #fff;
  border-color: #c62828;
}
.test-token-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--background-modifier-border);
  border-top: none; /* Ensure no top border */
  padding-bottom: 10px;
}
/* No border on the last setting item in a group */
.collections-tree .setting-item:last-of-type,
.view-switcher + div > .setting-item:last-of-type {
  border-bottom: none;
}
.setting-item-info {
  flex-grow: 1;
}
.setting-item-name {
  font-size: 1.1em;
  font-weight: bold;
}
.setting-item-description {
  font-size: 0.9em;
  font-style: italic;
  color: var(--text-muted);
}
.hint-text {
  font-size: 0.9em;
  font-style: italic;
  color: var(--text-muted);
  background-color: var(--background-secondary);
  padding: 10px;
  border-radius: 4px;
  margin: 15px 0;
  width: 100%;
}
.view-description {
  margin-top: -5px;
}
.template-help {
  margin-top: -10px;
  margin-bottom: 10px;
}
.template-help ul {
  list-style-type: disc;
  padding-left: 20px;
  margin: 10px 0;
}
.template-help li {
  margin-bottom: 5px;
}
.setting-item-control input {
  width: 250px;
}
.switch {
  position: relative;
  display: inline-block;
  width: 34px;
  height: 20px;
}
.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

/* Sichtbarer Fokus-Indikator für Tastatur-Navigation */
.switch input:focus-visible + .slider {
  outline: 2px solid var(--color-accent, #3a8bfd);
  outline-offset: 2px;
}
.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--background-modifier-border);
  transition: .2s;
}
.slider:before {
  position: absolute;
  content: "";
  height: 12px;
  width: 12px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  transition: .2s;
}
input:checked + .slider {
  background-color: var(--interactive-accent);
}
input:focus + .slider {
  box-shadow: 0 0 1px var(--interactive-accent);
}
input:checked + .slider:before {
  transform: translateX(14px);
}
.slider.round {
  border-radius: 20px;
}
.slider.round:before {
  border-radius: 50%;
}
.template-actions {
  text-align: right;
  margin-top: 10px;
}
h3, h4 {
  margin-top: 45px;
  margin-bottom: 25px;
  border-bottom: 1px solid var(--background-modifier-border);
  padding-bottom: 10px;
}
.unsorted-toggle {
  border-top: none;
  padding-top: 15px;
  margin-top: 15px;
}
textarea {
  width: 100%;
  min-height: 200px;
  margin-bottom: 10px;
  font-family: monospace;
  background-color: var(--background-secondary);
  color: var(--text-normal);
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  padding: 5px;
}
a {
  color: var(--text-accent);
}
.view-switcher {
  display: flex;
  margin-top: 45px;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--background-modifier-border);
  padding-bottom: 10px;
}
.view-switcher button {
  flex-grow: 1;
  padding: 10px;
  cursor: pointer;
  background-color: transparent;
  border: none;
  border-bottom: 2px solid transparent;
}
.view-switcher button.active {
  border-bottom-color: var(--interactive-accent);
  color: var(--text-normal);
}
.template-help code {
  font-family: var(--font-monospace);
  font-size: 0.9em;
  color: var(--text-accent);
}

.filename-control {
  display: flex;
  gap: 8px;
  align-items: center;
}

.filename-control input {
  flex: 1;
}

.rename-btn {
  padding: 4px 10px;
  font-size: 0.9em;
  white-space: nowrap;
}
</style>
