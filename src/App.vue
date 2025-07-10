<template>
    <h2>Hello,Developer!</h2>
    <Hello></Hello>
    <Hi :hi="hi"></Hi>
</template>

<script setup lang="tsx">
import Hello from "./Hello";
import Hi from "./Hi.vue";
import { ref } from "vue";
let hi = ref("");
</script>

<style scoped>
h2 {
    color: lightcoral;
}
</style>
