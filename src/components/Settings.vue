<template>
  <div class="raindrop-settings">
    <h2>Sync Settings</h2>
    
    <div class="setting-item">
      <div class="setting-item-info">
        <div class="setting-item-name">API Token</div>
        <div class="setting-item-description">
          Enter your Raindrop.io API token. You can create one from the <a href="https://app.raindrop.io/settings/integrations">integrations settings</a>.
        </div>
      </div>
      <div class="setting-item-control">
        <input type="password" v-model="localSettings.apiToken" @input="updateSettings" placeholder="Enter your token">
      </div>
    </div>

    <div class="setting-item">
      <div class="setting-item-info">
        <div class="setting-item-name">Storage Folder</div>
        <div class="setting-item-description">The folder where your Raindrop bookmarks will be stored.</div>
      </div>
      <div class="setting-item-control">
        <input type="text" v-model="localSettings.storageFolder" @input="updateSettings" placeholder="e.g., Raindrop">
      </div>
    </div>

    <div class="setting-item">
      <div class="setting-item-info">
        <div class="setting-item-name">Cascading Selection</div>
        <div class="setting-item-description">Automatically select/deselect child collections when a parent is selected/deselected.</div>
      </div>
      <div class="setting-item-control">
        <label class="switch">
          <input type="checkbox" v-model="localSettings.cascadeSelection" @change="updateSettings">
          <span class="slider round"></span>
        </label>
      </div>
    </div>

    <h3>Collections to Sync</h3>
    <div v-if="isLoading" class="loading">Loading collections...</div>
    <div v-else-if="error" class="error">{{ error }}</div>
    <div v-else class="collections-tree">
      <!-- Collection tree will be rendered here -->
      <CollectionNode
        v-for="node in collectionTree"
        :key="node.collection._id"
        :node="node"
        :settings="localSettings"
        @toggle-expand="handleToggleExpand"
        @toggle-select="handleToggleSelect"
      />
      <!-- Unsorted collection toggle -->
      <div class="setting-item unsorted-toggle">
        <div class="setting-item-info">
          <div class="setting-item-name">Unsorted</div>
          <div class="setting-item-description">Include bookmarks that are not in any collection.</div>
        </div>
        <div class="setting-item-control">
          <label class="switch">
            <input type="checkbox" :checked="isUnsortedSelected" @change="handleToggleUnsorted">
            <span class="slider round"></span>
          </label>
        </div>
      </div>
    </div>

    <h3>Content Template</h3>
    <div class="setting-item">
      <div class="setting-item-info">
          <div class="setting-item-name">Bookmark Template</div>
          <div class="setting-item-description">Define the template for each bookmark using Handlebars. See plugin documentation for available variables and helpers.</div>
      </div>
    </div>
    <textarea v-model="localSettings.template" @input="updateSettings"></textarea>
    <div class="setting-item-control template-actions">
        <button @click="emit('reset-template')">Reset to Default</button>
    </div>
  </div>
</template>

<script lang="ts" setup>
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
const emit = defineEmits(['update-settings', 'reset-template']);

// Create a local reactive copy of the settings
const localSettings = ref({ ...props.settings });
const isLoading = ref(false);
const error = ref<string | null>(null);
const collections = ref<RaindropCollection[]>([]);

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


// Watch for changes in props and update local state if necessary
watch(() => props.settings, (newSettings) => {
  localSettings.value = { ...newSettings };
});

// Function to emit the updated settings
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
.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--background-modifier-border);
  padding-bottom: 10px;
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
  color: var(--text-muted);
}
.setting-item-control input {
  width: 250px;
}

/* The switch - the box around the slider */
.switch {
  position: relative;
  display: inline-block;
  width: 34px;
  height: 20px;
}

/* Hide default HTML checkbox */
.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

/* The slider */
.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--background-modifier-border);
  -webkit-transition: .2s;
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
  -webkit-transition: .2s;
  transition: .2s;
}

input:checked + .slider {
  background-color: var(--interactive-accent);
}

input:focus + .slider {
  box-shadow: 0 0 1px var(--interactive-accent);
}

input:checked + .slider:before {
  -webkit-transform: translateX(14px);
  -ms-transform: translateX(14px);
  transform: translateX(14px);
}

/* Rounded sliders */
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

h3 {
    margin-top: 30px;
    border-bottom: 1px solid var(--background-modifier-border);
    padding-bottom: 5px;
}
.unsorted-toggle {
    margin-top: 15px;
    padding-top: 15px;
    border-top: 1px solid var(--background-modifier-border);
}
textarea {
    width: 100%;
    height: 200px;
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
</style> 
