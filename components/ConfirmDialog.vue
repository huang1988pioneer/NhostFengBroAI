<script setup lang="ts">
import { AlertTriangle } from "@lucide/vue";

const props = withDefaults(defineProps<{
  modelValue: boolean;
  name?: string;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
}>(), {
  title: "刪除資料",
  confirmText: "確定",
  cancelText: "取消"
});

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  confirm: [];
}>();
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="modal-backdrop" @click.self="emit('update:modelValue', false)">
        <div class="confirm-panel" role="alertdialog" aria-label="確認刪除" aria-modal="true">
          <div class="confirm-header">
            <div class="confirm-icon"><AlertTriangle :size="18" /></div>
            <strong>{{ props.title }}</strong>
          </div>
          <p>{{ props.message ?? `確定要刪除「${props.name}」嗎？此操作不可恢復。` }}</p>
          <div class="confirm-actions">
            <button class="modal-btn confirm" type="button" @click="emit('confirm')">{{ props.confirmText }}</button>
            <button class="modal-btn cancel" type="button" @click="emit('update:modelValue', false)">{{ props.cancelText }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
