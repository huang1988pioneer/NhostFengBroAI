<script setup lang="ts">
import { X } from "@lucide/vue";
import { onMounted, onUnmounted } from "vue";

const props = defineProps<{
  modelValue: boolean;
  title: string;
  saving?: boolean;
  saveLabel?: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  save: [];
}>();

function close() {
  emit("update:modelValue", false);
}

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") close();
}

onMounted(() => window.addEventListener("keydown", onKey));
onUnmounted(() => window.removeEventListener("keydown", onKey));
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="modal-backdrop" @click.self="close">
        <div class="modal-panel" role="dialog" :aria-label="title">
          <div class="modal-header">
            <h2>{{ title }}</h2>
            <button class="modal-close" type="button" :aria-label="'關閉 ' + title" @click="close">
              <X :size="20" />
            </button>
          </div>
          <div class="modal-body">
            <slot />
          </div>
          <div class="modal-footer">
            <button class="modal-btn cancel" type="button" @click="close">取消</button>
            <button class="modal-btn save" type="button" :disabled="saving" @click="emit('save')">
              {{ saving ? "儲存中..." : (saveLabel ?? "儲存") }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
