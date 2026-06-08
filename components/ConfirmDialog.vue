<script setup lang="ts">
import { AlertTriangle } from "@lucide/vue";

defineProps<{
  modelValue: boolean;
  name?: string;
  message?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  confirm: [];
}>();
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="modal-backdrop" @click.self="emit('update:modelValue', false)">
        <div class="confirm-panel" role="alertdialog" aria-label="確認刪除">
          <div class="confirm-icon"><AlertTriangle :size="32" /></div>
          <h3>確認刪除</h3>
          <p>{{ message ?? `確定要刪除「${name}」嗎？此操作不可恢復。` }}</p>
          <div class="confirm-actions">
            <button class="modal-btn cancel" type="button" @click="emit('update:modelValue', false)">取消</button>
            <button class="modal-btn danger" type="button" @click="emit('confirm')">刪除</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
