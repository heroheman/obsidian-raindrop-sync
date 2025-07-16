<template>
  <div class="collection-node">
    <div class="node-self">
      <span class="node-toggle-icon" v-if="node.children.length > 0" @click="emit('toggle-expand', node.collection._id)">
        {{ isExpanded ? '▼' : '▶' }}
      </span>
      <span class="node-toggle-icon" v-else>
		&nbsp;
      </span>
      <img v-if="node.collection.cover?.length > 0" :src="node.collection.cover[0]" class="collection-icon" />
      <div class="node-name">{{ node.collection.title }}</div>
      <div v-if="node.children.length > 0" class="collection-counter">({{ node.children.length }})</div>
      <div class="node-control">
        <label class="switch">
          <input type="checkbox" :checked="isSelected" @change="emit('toggle-select', node, !isSelected)" />
          <span class="slider round"></span>
        </label>
      </div>
    </div>
    <div class="node-children" v-if="isExpanded && node.children.length > 0">
      <!-- Recursive call to render child nodes -->
      <CollectionNode
        v-for="child in node.children"
        :key="child.collection._id"
        :node="child"
        :settings="settings"
        @toggle-expand="(id) => emit('toggle-expand', id)"
        @toggle-select="(node, state) => emit('toggle-select', node, state)"
      />
    </div>
  </div>
</template>

<script lang="ts">
// Defining the component name is important for recursive components
export default {
  name: 'CollectionNode'
}
</script>

<script lang="ts" setup>
import { defineProps, defineEmits, computed } from 'vue';
import type { RaindropSyncSettings } from '../main';

// Define a type for the hierarchical node structure
export interface CollectionNode {
  collection: {
    _id: number;
    title: string;
    cover?: string[];
  };
  children: CollectionNode[];
}

const props = defineProps<{
  node: CollectionNode;
  settings: RaindropSyncSettings;
}>();

const emit = defineEmits<{
  (e: 'toggle-expand', id: number): void;
  (e: 'toggle-select', node: CollectionNode, state: boolean): void;
}>();

const isExpanded = computed(() => {
  return props.settings.expandedCollectionIds.includes(props.node.collection._id);
});

const isSelected = computed(() => {
  return props.settings.collectionIds.includes(props.node.collection._id);
});
</script>

<style scoped>
.collection-node {
  margin-left: 10px;
}
.node-self {
  display: flex;
  align-items: center;
  padding: 2px 0;
}
.node-toggle-icon {
  cursor: pointer;
  width: 20px;
  text-align: center;
  margin-right: 5px;
}
.node-name {
  flex-grow: 1;
}
.collection-icon {
  width: 18px;
  height: 18px;
  margin-right: 8px;
  border-radius: 3px;
}
.collection-counter {
  font-size: 0.8em;
  color: var(--text-muted);
  margin-right: 10px;
}
.node-control {
  padding-right: 5px;
}
.node-children {
  border-left: 1px solid var(--background-modifier-border);
  padding-left: 10px;
  margin-left: 10px;
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
</style> 
