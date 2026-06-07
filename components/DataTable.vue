<script setup lang="ts">
defineProps<{
  rows: unknown[];
  columns: string[];
}>();
</script>

<template>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th v-for="column in columns" :key="column">{{ column }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, index) in rows" :key="index">
          <slot :row="row" />
        </tr>
      </tbody>
    </table>
  </div>
</template>
