import { ref, computed } from "vue";

export function useCrud<T extends { id?: string; name?: string }>() {
  const showModal = ref(false);
  const isEditing = ref(false);
  const editIndex = ref(-1);
  const editId = ref<string | undefined>(undefined);

  const showDeleteConfirm = ref(false);
  const deletingIndex = ref(-1);
  const deletingName = ref("");

  function openNew() {
    isEditing.value = false;
    editIndex.value = -1;
    editId.value = undefined;
    showModal.value = true;
  }

  function openEdit(item: T, index: number) {
    isEditing.value = true;
    editIndex.value = index;
    editId.value = item.id;
    showModal.value = true;
  }

  function closeModal() {
    showModal.value = false;
  }

  function requestDelete(item: T, index: number) {
    deletingIndex.value = index;
    deletingName.value = item.name ?? String(index + 1);
    showDeleteConfirm.value = true;
  }

  function cancelDelete() {
    showDeleteConfirm.value = false;
    deletingIndex.value = -1;
  }

  const modalTitle = computed(() => isEditing.value ? "編輯" : "新增");

  return {
    showModal,
    isEditing,
    editIndex,
    editId,
    showDeleteConfirm,
    deletingIndex,
    deletingName,
    modalTitle,
    openNew,
    openEdit,
    closeModal,
    requestDelete,
    cancelDelete,
  };
}
