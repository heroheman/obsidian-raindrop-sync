<template>
  <div class="collapsible-hint">
    <div class="collapsible-header" @click="toggle">
      <span>{{ title }}</span>
      <span class="chevron" :class="{ open: open }">&#9660;</span>
    </div>
    <transition name="fade">
      <div v-if="open" class="collapsible-content">
        <slot />
      </div>
    </transition>
  </div>
</template>

<script lang="ts">
// Defining the component name is important for recursive components
export default {
  name: 'CollapsibleHint'
}
</script>

<script lang="ts" setup>
import { ref, defineProps } from 'vue';
const props = defineProps<{ title: string }>();
const open = ref(false);
function toggle() {
  open.value = !open.value;
}
</script>

<style scoped>
.collapsible-hint {
  margin: 15px 0;
  border-radius: 4px;
  background: var(--background-secondary);
  color: var(--text-muted);
  font-size: 0.95em;
  box-shadow: none;
}
.collapsible-header {
  cursor: pointer;
  padding: 10px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: space-between;
  user-select: none;
}
.chevron {
  transition: transform 0.2s;
  font-size: 1.1em;
}
.chevron.open {
  transform: rotate(180deg);
}
.collapsible-content {
  padding: 10px 15px 10px 15px;
  border-top: 1px solid var(--background-modifier-border);
  background: var(--background-secondary);
}
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
