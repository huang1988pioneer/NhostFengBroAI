<script setup lang="ts">
import {
  BarChart3,
  BookOpenText,
  Boxes,
  CalendarClock,
  Camera,
  CircleDollarSign,
  CreditCard,
  Download,
  FileAudio,
  FileText,
  FolderOpen,
  Home,
  Image,
  Info,
  Landmark,
  Menu,
  Music,
  Package,
  Play,
  Search,
  Settings,
  Sparkles,
  Star,
  TrendingUp,
  Upload,
  Utensils,
  WalletCards,
  Wrench,
  X
} from "@lucide/vue";
import type { Component } from "vue";
import { fallbackDataset, type Article, type Bank, type FengbroDataset, type Food, type Routine, type Subscription, type MediaItem, type MediaLibrary, type FinanceWatch } from "~/data/fengbro";
import { fetchNhostDataset, type NhostConnection, type NhostLoadResult } from "~/utils/nhostData";
import { createNhostTablesSql, nhostTableSchemas } from "~/utils/nhostSchema";
import {
  exportSubscriptions, importSubscriptions,
  exportFoods, importFoods,
  exportArticles, importArticles,
  exportCommonAccounts, importCommonAccounts,
  exportBanks, importBanks,
  exportRoutines, importRoutines,
  readFileAsText
} from "~/utils/csvUtils";
import type { CommonAccount } from "~/data/fengbro";
import {
  upsertSubscriptions,
  upsertFoods,
  upsertArticles,
  upsertCommonAccounts,
  upsertBanks,
  upsertRoutines
} from "~/utils/nhostMutations";
import { deleteRecordsByName, insertRecord, updateRecord } from "~/utils/nhostCrud";

type MenuItem = {
  id: string;
  label: string;
  subtitle?: string;
  icon: Component;
  children?: MenuItem[];
};

type QuickForm = {
  subscriptionName: string;
  subscriptionDate: string;
  subscriptionPrice: number;
  foodName: string;
  foodAmount: number;
  foodDate: string;
  foodPhoto: string;
  noteTitle: string;
  noteContent: string;
  commonName: string;
  commonSite: string;
  commonNote: string;
  mediaName: string;
  mediaUrl: string;
  mediaNote: string;
  bankName: string;
  bankDeposit: number;
  bankAccount: string;
  bankCard: string;
  routineName: string;
  routineDate: string;
  routineNote: string;
  routinePhoto: string;
};

type CrudField = {
  key: string;
  label: string;
  type?: "text" | "number" | "date" | "boolean" | "json";
};

type CrudConfig = {
  table: string;
  label: string;
  filename: string;
  fields: CrudField[];
};

type CrudResponse = {
  ok: boolean;
  rows?: Array<Record<string, unknown>>;
  row?: Record<string, unknown> | null;
  affectedRows?: number;
};

type OptimisticCrudRow = Record<string, unknown> & {
  id: string;
  isOptimistic?: boolean;
};

const menuItems: MenuItem[] = [
  { id: "home", label: "首頁", icon: Home },
  { id: "dashboard", label: "總覽", icon: BarChart3 },
  { id: "subscription", label: "訂閱", icon: CreditCard },
  { id: "food", label: "食品庫存", subtitle: "保存期限與數量", icon: Package },
  { id: "notes", label: "筆記", icon: FileText },
  { id: "common", label: "常用帳號", icon: Star },
  { id: "images", label: "圖片", icon: Image },
  { id: "videos", label: "影片", icon: Play },
  { id: "music", label: "音樂", icon: Music },
  { id: "documents", label: "文件", icon: FolderOpen },
  { id: "podcast", label: "Podcast", icon: FileAudio },
  { id: "bank", label: "銀行", subtitle: "帳戶與卡片", icon: Landmark },
  { id: "routine", label: "例行事項", icon: CalendarClock },
  {
    id: "tools",
    label: "工具",
    icon: Wrench,
    children: [
      { id: "price-compare", label: "價格比較", icon: TrendingUp },
      { id: "phone-compare", label: "手機比較", icon: Boxes },
      { id: "fengbro-tube", label: "FengBro Tube", icon: Play },
      { id: "fengbro-finance", label: "金融追蹤", icon: CircleDollarSign }
    ]
  },
  { id: "settings", label: "設定", icon: Settings },
  { id: "about", label: "關於", icon: Info }
];

const currentModule = ref("home");
const isSidebarOpen = ref(false);
const expandedMenus = ref<string[]>(["tools"]);
const query = ref("");
const activeTool = ref("price-compare");
const dataSource = ref<"loading" | "nhost" | "fallback" | "error" | "empty">("loading");
const nhostError = ref("");
const sourceMessage = ref("甇???? Nhost GraphQL...");
const loadedTables = ref<string[]>([]);
const resolvedTableNames = ref<Record<string, string>>({});
const tableSql = createNhostTablesSql;
const tableGenerationStatus = ref("");
const isGeneratingTables = ref(false);
const settingsStatus = ref("");
const connectionTestStatus = ref("");
const connectionTestOk = ref<boolean | null>(null);
const isTestingConnection = ref(false);
const isSecretVisible = ref(false);
const nhostSettings = reactive({
  graphqlUrl: "",
  adminSecret: "",
  authorization: ""
});
const nhostSettingsStorageKey = "fengbro-nhost-settings";

const emptyMedia: MediaLibrary = { images: [], videos: [], music: [], documents: [], podcasts: [] };
const subscriptions = ref<Subscription[]>([]);
const foods = ref<Food[]>([]);
const articles = ref<Article[]>([]);
const banks = ref<Bank[]>([]);
const routines = ref<Routine[]>([]);
const commonAccounts = ref<CommonAccount[]>([]);
const mediaSeed = ref<MediaLibrary>({ ...emptyMedia });
const financeWatch = ref<FinanceWatch[]>([]);

const csvToast = ref<{ message: string; isError: boolean } | null>(null);
let csvToastTimer: ReturnType<typeof setTimeout> | null = null;
const csvImporting = ref("");

// Delete confirmation dialog state
const showDeleteConfirm = ref(false);
const deleteTarget = ref<{
  name: string;
  action: () => Promise<void>;
} | null>(null);

const quickForm = reactive<QuickForm>({
  subscriptionName: "",
  subscriptionDate: "",
  subscriptionPrice: 0,
  foodName: "",
  foodAmount: 1,
  foodDate: "",
  foodPhoto: "",
  noteTitle: "",
  noteContent: "",
  commonName: "",
  commonSite: "",
  commonNote: "",
  mediaName: "",
  mediaUrl: "",
  mediaNote: "",
  bankName: "",
  bankDeposit: 0,
  bankAccount: "",
  bankCard: "",
  routineName: "",
  routineDate: "",
  routineNote: "",
  routinePhoto: ""
});

const crudConfigs: CrudConfig[] = [
  {
    table: "subscription",
    label: "??閮",
    filename: "appwrite-subscription.csv",
    fields: [
      { key: "name", label: "?迂" },
      { key: "site", label: "蝬脩?" },
      { key: "price", label: "?寞", type: "number" },
      { key: "nextdate", label: "銝活?交?", type: "date" },
      { key: "note", label: "?酉" },
      { key: "account", label: "撣唾?" },
      { key: "currency", label: "撟?" },
      { key: "continue", label: "??", type: "boolean" }
    ]
  },
  {
    table: "food",
    label: "??憌?",
    filename: "appwrite-food.csv",
    fields: [
      { key: "name", label: "?迂" },
      { key: "amount", label: "?賊?", type: "number" },
      { key: "todate", label: "靽???", type: "date" },
      { key: "photo", label: "?抒?" },
      { key: "price", label: "?寞", type: "number" },
      { key: "shop", label: "??" }
    ]
  },
  {
    table: "article",
    label: "??蝑?",
    filename: "appwrite-article.csv",
    fields: [
      { key: "title", label: "璅?" },
      { key: "content", label: "?批捆" },
      { key: "category", label: "??" },
      { key: "newDate", label: "?交?", type: "date" }
    ]
  },
  {
    table: "commonaccount",
    label: "??撣貊",
    filename: "appwrite-commonaccount.csv",
    fields: [
      { key: "name", label: "撣唾?" },
      { key: "sites", label: "蝡 JSON", type: "json" },
      { key: "note", label: "?酉" }
    ]
  },
  {
    table: "image",
    label: "????",
    filename: "appwrite-image.csv",
    fields: [
      { key: "name", label: "?迂" },
      { key: "url", label: "URL" },
      { key: "note", label: "?酉" }
    ]
  },
  {
    table: "video",
    label: "??敶梁?",
    filename: "appwrite-video.csv",
    fields: [
      { key: "name", label: "名稱" },
      { key: "url", label: "URL" },
      { key: "note", label: "備註" }
    ]
  },
  {
    table: "music",
    label: "音樂",
    filename: "appwrite-music.csv",
    fields: [
      { key: "name", label: "名稱" },
      { key: "url", label: "URL" },
      { key: "note", label: "備註" }
    ]
  },
  {
    table: "commondocument",
    label: "文件",
    filename: "appwrite-commondocument.csv",
    fields: [
      { key: "name", label: "名稱" },
      { key: "url", label: "URL" },
      { key: "note", label: "備註" }
    ]
  },
  {
    table: "podcast",
    label: "Podcast",
    filename: "appwrite-podcast.csv",
    fields: [
      { key: "name", label: "名稱" },
      { key: "url", label: "URL" },
      { key: "note", label: "備註" }
    ]
  },
  {
    table: "bank",
    label: "銀行",
    filename: "appwrite-bank.csv",
    fields: [
      { key: "name", label: "名稱" },
      { key: "deposit", label: "存款", type: "number" },
      { key: "site", label: "網站" },
      { key: "withdrawals", label: "提款", type: "number" },
      { key: "transfer", label: "轉帳", type: "number" },
      { key: "activity", label: "活動" },
      { key: "card", label: "卡片" },
      { key: "account", label: "帳號" }
    ]
  },
  {
    table: "routine",
    label: "例行事項",
    filename: "appwrite-routine.csv",
    fields: [
      { key: "name", label: "名稱" },
      { key: "note", label: "備註" },
      { key: "lastdate1", label: "日期1", type: "date" },
      { key: "lastdate2", label: "日期2", type: "date" },
      { key: "lastdate3", label: "日期3", type: "date" },
      { key: "link", label: "連結" },
      { key: "photo", label: "圖片" }
    ]
  }
];

const activeCrudTable = ref("subscription");
const crudRows = ref<Array<Record<string, unknown>>>([]);
const crudDraft = reactive<Record<string, string>>({});
const editingCrudId = ref("");
const crudStatus = ref("");
const isCrudBusy = ref(false);
const crudFileInput = ref<HTMLInputElement | null>(null);
const isMediaUploading = ref(false);
const mediaUploadInput = ref<HTMLInputElement | null>(null);
const isFoodPhotoUploading = ref(false);
const foodPhotoInput = ref<HTMLInputElement | null>(null);
const isRoutinePhotoUploading = ref(false);
const routinePhotoInput = ref<HTMLInputElement | null>(null);

// ?? Module-level edit state ???????????????????????????????????????????????????
const editingSubId = ref("");
const editingFoodId = ref("");
const editingNoteId = ref("");
const editingBankId = ref("");
const editingRoutineId = ref("");
const editingCommonId = ref("");
const submitting = ref(false);

const activeItem = computed(() => findMenuItem(currentModule.value) ?? menuItems[0]);
const activeCrudConfig = computed(() => crudConfigs.find((config) => config.table === activeCrudTable.value) || crudConfigs[0]);
const recurringSubscriptions = computed(() => subscriptions.value.filter((item) => item.continue).length);
const totalTwdSubscriptions = computed(() => subscriptions.value.filter((item) => item.currency === "TWD").reduce((sum, item) => sum + item.price, 0));
const totalUsdSubscriptions = computed(() => subscriptions.value.filter((item) => item.currency === "USD").reduce((sum, item) => sum + item.price, 0));
const totalBankDeposit = computed(() => banks.value.reduce((sum, item) => sum + item.deposit, 0));
const foodUnits = computed(() => foods.value.reduce((sum, item) => sum + item.amount, 0));
const latestArticles = computed(() => [...articles.value].sort((a, b) => b.newDate.localeCompare(a.newDate)).slice(0, 5));
const sortedSubscriptions = computed(() => sortSubscriptionsByNextDate(subscriptions.value));
const filteredSubscriptions = computed(() => filterRows(sortedSubscriptions.value, query.value));
const filteredFoods = computed(() => filterRows(foods.value, query.value));
const filteredArticles = computed(() => filterRows(articles.value, query.value));
const filteredRoutines = computed(() => filterRows(routines.value, query.value));
const filteredBanks = computed(() => filterRows(banks.value, query.value));
const filteredAccounts = computed(() => filterRows(commonAccounts.value, query.value));
const filteredFinanceWatch = computed(() => filterRows(financeWatch.value, query.value));
const activeMediaItems = computed(() => {
  const key = currentModule.value === "podcast" ? "podcasts" : currentModule.value;
  if (key === "images" || key === "videos" || key === "music" || key === "documents" || key === "podcasts") {
    return mediaSeed.value[key];
  }
  return [];
});
const activeMediaIcon = computed<Component>(() => {
  const icons: Record<string, Component> = {
    images: Camera,
    videos: Play,
    music: Music,
    documents: BookOpenText,
    podcast: FileAudio
  };
  return icons[currentModule.value] ?? FolderOpen;
});
const activeMediaAccept = computed(() => {
  if (currentModule.value === "images") return "image/*";
  if (currentModule.value === "videos") return "video/*";
  if (currentModule.value === "music" || currentModule.value === "podcast") return "audio/*";
  return "*/*";
});
const activeMediaUploadLabel = computed(() => {
  if (currentModule.value === "images") return "上傳圖片";
  if (currentModule.value === "videos") return "上傳影片";
  if (currentModule.value === "music") return "上傳音樂";
  if (currentModule.value === "podcast") return "上傳 Podcast";
  return "上傳文件";
});
const statusLabel = computed(() => {
  if (dataSource.value === "nhost") return "Nhost 實際資料";
  if (dataSource.value === "loading") return "載入中";
  if (dataSource.value === "error") return "資料載入失敗";
  if (dataSource.value === "empty") return "資料庫無資料";
  return "備援資料";
});

onMounted(() => {
  loadStoredNhostSettings();
  loadNhostData();
});

function clearAllData() {
  subscriptions.value = [];
  foods.value = [];
  articles.value = [];
  banks.value = [];
  routines.value = [];
  commonAccounts.value = [];
  mediaSeed.value = { ...emptyMedia };
  financeWatch.value = [];
}

function applyDataset(dataset: FengbroDataset) {
  subscriptions.value = dataset.subscriptions;
  foods.value = dataset.foods;
  articles.value = dataset.articles;
  banks.value = dataset.banks;
  routines.value = dataset.routines;
  commonAccounts.value = dataset.commonAccounts;
  mediaSeed.value = dataset.mediaSeed;
  financeWatch.value = dataset.financeWatch;
}

function datasetKeysWithData(dataset: FengbroDataset) {
  const keys: string[] = [];
  if (dataset.subscriptions.length) keys.push("subscriptions");
  if (dataset.foods.length) keys.push("foods");
  if (dataset.articles.length) keys.push("articles");
  if (dataset.banks.length) keys.push("banks");
  if (dataset.routines.length) keys.push("routines");
  if (dataset.commonAccounts.length) keys.push("commonAccounts");
  if (dataset.financeWatch.length) keys.push("financeWatch");
  if (Object.values(dataset.mediaSeed).some((items) => items.length)) keys.push("mediaSeed");
  return keys;
}

function isValidRecordId(id: unknown): id is string {
  // Optimistic IDs are only valid after the real database row has been created.
  return typeof id === "string" && id.trim().length > 0;
}

function canWriteToDatabase(): boolean {
  const conn = getNhostConnection();
  if (!conn.graphqlUrl) {
    showCsvToast("請先在設定頁輸入 Nhost GraphQL URL。", true);
    return false;
  }
  if (dataSource.value === "error") {
    showCsvToast("資料載入失敗，請先確認 Nhost 設定或重新載入。", true);
    return false;
  }
  return true;
}

async function loadNhostData() {
  dataSource.value = "loading";
  nhostError.value = "";
  sourceMessage.value = "正在載入 Nhost GraphQL...";

  try {
    const result: NhostLoadResult = await fetchNhostDataset(fallbackDataset, getNhostConnection());
    const { dataset, loadedKeys, resolvedTables } = result;
    loadedTables.value = loadedKeys.map(String);
    resolvedTableNames.value = resolvedTables;
    applyDataset(dataset);

    const populatedKeys = datasetKeysWithData(dataset);
    if (populatedKeys.length) {
      dataSource.value = "nhost";
      sourceMessage.value = `Nhost 實際資料：已從 Nhost 載入 ${populatedKeys.length} 組資料：${populatedKeys.join(", ")}`;
    } else {
      dataSource.value = "empty";
      sourceMessage.value = "資料庫無資料，請新增資料或匯入 CSV。";
    }
  } catch (error) {
    clearAllData();
    resolvedTableNames.value = {};
    dataSource.value = "error";
    nhostError.value = error instanceof Error ? error.message : "資料載入失敗";
    sourceMessage.value = nhostError.value;
  }
}

function findMenuItem(id: string, items: MenuItem[] = menuItems): MenuItem | undefined {
  for (const item of items) {
    if (item.id === id) return item;
    const child = item.children ? findMenuItem(id, item.children) : undefined;
    if (child) return child;
  }
}

function navigate(id: string) {
  const item = findMenuItem(id);
  if (!item) return;

  if (item.children?.length) {
    expandedMenus.value = expandedMenus.value.includes(item.id)
      ? expandedMenus.value.filter((menuId) => menuId !== item.id)
      : [...expandedMenus.value, item.id];
    return;
  }

  if (["price-compare", "phone-compare", "fengbro-tube", "fengbro-finance"].includes(id)) {
    activeTool.value = id;
  }

  currentModule.value = id;
  isSidebarOpen.value = false;
}

function filterRows<T>(rows: T[], keyword: string): T[] {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) return rows;
  return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(normalized));
}

function getNhostConnection(): NhostConnection {
  const config = useRuntimeConfig();
  const graphqlUrl = nhostSettings.graphqlUrl.trim() || (config.public.nhostGraphqlUrl as string) || "";
  const adminSecret = nhostSettings.adminSecret.trim();
  const authorization = nhostSettings.authorization.trim();

  return {
    graphqlUrl: graphqlUrl || undefined,
    adminSecret: adminSecret || undefined,
    authorization: authorization || undefined
  };
}

function loadStoredNhostSettings() {
  if (!import.meta.client) return;

  const raw = localStorage.getItem(nhostSettingsStorageKey);
  if (!raw) return;

  try {
    const stored = JSON.parse(raw) as Partial<typeof nhostSettings>;
    nhostSettings.graphqlUrl = stored.graphqlUrl || "";
    nhostSettings.authorization = stored.authorization || "";
    nhostSettings.adminSecret = stored.adminSecret || "";
  } catch {
    localStorage.removeItem(nhostSettingsStorageKey);
  }
}

function saveNhostSettings() {
  if (!import.meta.client) return;

  const payload = {
    graphqlUrl: nhostSettings.graphqlUrl.trim(),
    authorization: nhostSettings.authorization.trim(),
    adminSecret: nhostSettings.adminSecret.trim()
  };

  localStorage.setItem(nhostSettingsStorageKey, JSON.stringify(payload));
  settingsStatus.value = "已儲存 Nhost API 資訊。";
}

function clearNhostSettings() {
  if (import.meta.client) {
    localStorage.removeItem(nhostSettingsStorageKey);
  }

  nhostSettings.graphqlUrl = "";
  nhostSettings.adminSecret = "";
  nhostSettings.authorization = "";
  settingsStatus.value = "已清除本機儲存的 Nhost API 資訊。";
}

async function saveAndReloadNhostSettings() {
  saveNhostSettings();
  await loadNhostData();
}

async function testNhostConnection() {
  connectionTestStatus.value = "正在測試 Nhost GraphQL 連線...";
  connectionTestOk.value = null;
  isTestingConnection.value = true;

  try {
    const result = await $fetch<{
      ok: boolean;
      error?: string;
      hint?: string;
      queryType: string;
      rootFields: number;
      sampleFields: string[];
    }>("/api/nhost/test-connection", {
      method: "POST",
      body: getNhostConnection()
    });

    connectionTestOk.value = result.ok;
    connectionTestStatus.value = result.ok
      ? `連線成功：${result.queryType} 可用，找到 ${result.rootFields} 個 root fields${result.sampleFields.length ? `（${result.sampleFields.join(", ")}）` : ""}`
      : `連線失敗：${result.error || "未知錯誤"}${result.hint ? `，${result.hint}` : ""}`;
  } catch (error) {
    connectionTestOk.value = false;
    connectionTestStatus.value =
      error instanceof Error ? `連線失敗：${error.message}` : "連線失敗：Nhost 測試 API 無法回應。";
  } finally {
    isTestingConnection.value = false;
  }
}

function daysUntil(date: string) {
  if (!date) return "-";
  const today = new Date();
  const target = new Date(`${date}T00:00:00+08:00`);
  const diff = Math.ceil((target.getTime() - today.getTime()) / 86400000);
  if (Number.isNaN(diff)) return "-";
  if (diff < 0) return `已過 ${Math.abs(diff)} 天`;
  if (diff === 0) return "今天";
  return `${diff} 天`;
}

function sortSubscriptionsByNextDate(rows: Subscription[]) {
  return [...rows].sort((a, b) => {
    const dateDiff = subscriptionDateSortValue(a.nextdate) - subscriptionDateSortValue(b.nextdate);
    if (dateDiff !== 0) return dateDiff;
    return a.name.localeCompare(b.name, "zh-Hant");
  });
}

function subscriptionDateSortValue(date: string) {
  if (!date) return Number.MAX_SAFE_INTEGER;
  const time = new Date(`${date}T00:00:00+08:00`).getTime();
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
}

function money(amount: number, currency = "TWD") {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "TWD" ? 0 : 2
  }).format(amount);
}

function resolveTableName(crudTable: string): string {
  const keyMap: Record<string, string> = {
    subscription: "subscriptions",
    food: "foods",
    article: "articles",
    bank: "banks",
    routine: "routines",
    commonaccount: "commonAccounts",
    image: "images",
    video: "videos",
    music: "music",
    commondocument: "documents",
    podcast: "podcasts"
  };
  const datasetKey = keyMap[crudTable];
  return datasetKey ? (resolvedTableNames.value[datasetKey] || crudTable) : crudTable;
}

async function createWithNhost(table: string, object: Record<string, unknown>): Promise<string | false> {
  if (!canWriteToDatabase()) return false;
  const conn = getNhostConnection();
  const actualTable = resolveTableName(table);
  try {
    const result = await insertRecord(conn, actualTable, object);
    if (result.ok && isValidRecordId(result.id)) {
      showCsvToast(`已新增：${result.message}`);
      return result.id;
    }
    showCsvToast(`新增失敗：${result.message}`, true);
    return false;
  } catch (error) {
    showCsvToast(`寫入 Nhost 失敗：${error instanceof Error ? error.message : "未知錯誤"}`, true);
    return false;
  }
}

async function updateWithNhost(table: string, id: string, record: Record<string, unknown>): Promise<boolean> {
  if (!canWriteToDatabase()) return false;
  if (!isValidRecordId(id)) {
    showCsvToast(`資料尚未取得有效 id（id: "${id}"），請重新載入資料後再更新。`, true);
    return false;
  }
  const conn = getNhostConnection();
  const actualTable = resolveTableName(table);
  try {
    const result = await updateRecord(conn, actualTable, id, record);
    if (result.ok) { showCsvToast(`已更新：${result.message}`); return true; }
    showCsvToast(`${actualTable} 更新失敗：${result.message}`, true);
    return false;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    showCsvToast(`${actualTable} 更新失敗：${errorMsg}，請確認資料 id 與欄位設定。`, true);
    console.error(`Update failed for ${actualTable}:`, { id, record, error });
    return false;
  }
}

async function deleteFromNhostByName(table: string, name: string, removeLocal: () => void, field = "name") {
  const conn = getNhostConnection();
  const actualTable = resolveTableName(table);
  if (!conn.graphqlUrl) {
    removeLocal();
    showCsvToast("未設定 Nhost GraphQL URL，已先從畫面移除。");
    return;
  }

  try {
    const result = await deleteRecordsByName(conn, actualTable, name, field);
    removeLocal();
    showCsvToast(result.message);
  } catch (error) {
    showCsvToast(`刪除 Nhost 失敗：${error instanceof Error ? error.message : "未知錯誤"}`, true);
  }
}

// Confirmation dialog helpers
async function requestDelete(name: string, action: () => Promise<void>) {
  deleteTarget.value = { name, action };
  showDeleteConfirm.value = true;
}

async function confirmDelete() {
  if (deleteTarget.value?.action) {
    await deleteTarget.value.action();
  }
  showDeleteConfirm.value = false;
  deleteTarget.value = null;
}

function cancelDelete() {
  showDeleteConfirm.value = false;
  deleteTarget.value = null;
}

const removeSubscription = (name: string) => {
  subscriptions.value = subscriptions.value.filter((item) => item.name !== name);
};
const removeFood = (name: string) => {
  foods.value = foods.value.filter((item) => item.name !== name);
};
const removeArticle = (title: string) => {
  articles.value = articles.value.filter((item) => item.title !== title);
};
const removeCommonAccount = (name: string) => {
  commonAccounts.value = commonAccounts.value.filter((item) => item.name !== name);
};
const removeBank = (name: string) => {
  banks.value = banks.value.filter((item) => item.name !== name);
};
const removeRoutine = (name: string) => {
  routines.value = routines.value.filter((item) => item.name !== name);
};
const removeMediaItem = (key: keyof typeof mediaSeed.value, name: string) => {
  mediaSeed.value[key] = mediaSeed.value[key].filter((item) => item.name !== name);
};

function activeMediaTable() {
  if (currentModule.value === "documents") return "commondocument";
  if (currentModule.value === "podcast") return "podcast";
  return currentModule.value.slice(0, -1);
}

function activeMediaKey(): keyof typeof mediaSeed.value {
  if (currentModule.value === "podcast") return "podcasts";
  return currentModule.value as keyof typeof mediaSeed.value;
}

async function deleteMediaItem(name: string) {
  await deleteFromNhostByName(activeMediaTable(), name, () => removeMediaItem(activeMediaKey(), name));
}

// Wrapper functions for delete with confirmation
function confirmDeleteSubscription(name: string) {
  requestDelete(name, async () => {
    await deleteFromNhostByName('subscription', name, () => removeSubscription(name));
  });
}

function confirmDeleteFood(name: string) {
  requestDelete(name, async () => {
    await deleteFromNhostByName('food', name, () => removeFood(name));
  });
}

function confirmDeleteArticle(title: string) {
  requestDelete(title, async () => {
    await deleteFromNhostByName('article', title, () => removeArticle(title), 'title');
  });
}

function confirmDeleteCommonAccount(name: string) {
  requestDelete(name, async () => {
    await deleteFromNhostByName('commonaccount', name, () => removeCommonAccount(name));
  });
}

function confirmDeleteBank(name: string) {
  requestDelete(name, async () => {
    await deleteFromNhostByName('bank', name, () => removeBank(name));
  });
}

function confirmDeleteRoutine(name: string) {
  requestDelete(name, async () => {
    await deleteFromNhostByName('routine', name, () => removeRoutine(name));
  });
}

function confirmDeleteMediaItem(name: string) {
  requestDelete(name, async () => {
    await deleteMediaItem(name);
  });
}

function startEditCommon(row: CommonAccount) {
  editingCommonId.value = row.id ?? "";
  quickForm.commonName = row.name;
  quickForm.commonSite = row.sites[0]?.site ?? "";
  quickForm.commonNote = row.sites[0]?.note ?? "";
}
function cancelEditCommon() {
  editingCommonId.value = "";
  quickForm.commonName = "";
  quickForm.commonSite = "";
  quickForm.commonNote = "";
}

async function addCommonAccount() {
  if (!quickForm.commonName || !quickForm.commonSite) {
    showCsvToast("請輸入名稱與網站。", true);
    return;
  }
  const record = {
    name: quickForm.commonName,
    sites: [{ site: quickForm.commonSite, note: quickForm.commonNote }]
  };
  if (editingCommonId.value) {
    const idx = commonAccounts.value.findIndex((c) => c.id === editingCommonId.value);
    if (idx >= 0) commonAccounts.value[idx] = { ...commonAccounts.value[idx], ...record };
    await updateWithNhost("commonaccount", editingCommonId.value, record);
    editingCommonId.value = "";
  } else {
    const item: CommonAccount = { ...record };
  commonAccounts.value.unshift(item);
  const newId = await createWithNhost("commonaccount", item);
  if (newId) {
    commonAccounts.value[0] = { ...item, id: newId };
  } else {
    commonAccounts.value = commonAccounts.value.filter((account) => account !== item);
    return;
  }
  }
  quickForm.commonName = "";
  quickForm.commonSite = "";
  quickForm.commonNote = "";
}

async function addMediaItem() {
  if (!quickForm.mediaName) {
    showCsvToast("請先輸入媒體名稱。", true);
    return;
  }
  const moduleToTable: Record<string, string> = {
    images: "image",
    videos: "video",
    music: "music",
    documents: "commondocument",
    podcast: "podcast"
  };
  const moduleToKey: Record<string, keyof typeof mediaSeed.value> = {
    images: "images",
    videos: "videos",
    music: "music",
    documents: "documents",
    podcast: "podcasts"
  };
  const table = moduleToTable[currentModule.value];
  const key = moduleToKey[currentModule.value];
  if (!table || !key) return;

  const record: MediaItem = {
    name: quickForm.mediaName,
    url: quickForm.mediaUrl,
    note: quickForm.mediaNote
  };
  const newId = await createWithNhost(table, record);
  if (!newId) return;

  mediaSeed.value[key].unshift({ ...record, id: newId });
  quickForm.mediaName = "";
  quickForm.mediaUrl = "";
  quickForm.mediaNote = "";
}

async function uploadMediaFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  isMediaUploading.value = true;
  try {
    const result = await uploadFileToNhostStorage(file);

    if (!quickForm.mediaName) quickForm.mediaName = stripFileExtension(result.name || file.name);
    quickForm.mediaUrl = result.url;
    showCsvToast(`已上傳：${result.name || file.name}`);
  } catch (error) {
    showCsvToast(`上傳失敗：${error instanceof Error ? error.message : "Nhost Storage 無法上傳"}`, true);
  } finally {
    isMediaUploading.value = false;
    input.value = "";
  }
}

function stripFileExtension(filename: string) {
  return filename.replace(/\.[^.]+$/, "");
}

async function uploadFoodPhoto(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  isFoodPhotoUploading.value = true;
  try {
    const result = await uploadFileToNhostStorage(file);
    quickForm.foodPhoto = result.url;
    showCsvToast(`已上傳食品圖片：${result.name || file.name}`);
  } catch (error) {
    showCsvToast(`食品圖片上傳失敗：${error instanceof Error ? error.message : "Nhost Storage 無法上傳"}`, true);
  } finally {
    isFoodPhotoUploading.value = false;
    input.value = "";
  }
}

async function uploadRoutinePhoto(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  isRoutinePhotoUploading.value = true;
  try {
    const result = await uploadFileToNhostStorage(file);
    quickForm.routinePhoto = result.url;
    showCsvToast(`已上傳例行圖片：${result.name || file.name}`);
  } catch (error) {
    showCsvToast(`例行圖片上傳失敗：${error instanceof Error ? error.message : "Nhost Storage 無法上傳"}`, true);
  } finally {
    isRoutinePhotoUploading.value = false;
    input.value = "";
  }
}

async function uploadFileToNhostStorage(file: File) {
  const form = new FormData();
  const conn = getNhostConnection();
  form.append("file", file);
  form.append("bucketId", "default");
  if (conn.graphqlUrl) form.append("graphqlUrl", conn.graphqlUrl);
  if (conn.adminSecret) form.append("adminSecret", conn.adminSecret);
  if (conn.authorization) form.append("authorization", conn.authorization);

  return await $fetch<{ ok: boolean; name: string; url: string }>("/api/nhost/upload", {
    method: "POST",
    body: form
  });
}

function startEditBank(row: Bank) {
  if (!isValidRecordId(row.id)) {
    showCsvToast("資料尚未取得有效 id，請重新載入資料後再編輯。", true);
    return;
  }
  editingBankId.value = row.id;
  quickForm.bankName = row.name;
  quickForm.bankDeposit = row.deposit;
  quickForm.bankAccount = row.account;
  quickForm.bankCard = row.card;
}
function cancelEditBank() {
  editingBankId.value = "";
  quickForm.bankName = "";
  quickForm.bankDeposit = 0;
  quickForm.bankAccount = "";
  quickForm.bankCard = "";
}
async function addBank() {
  if (!quickForm.bankName) {
    showCsvToast("請輸入銀行名稱。", true);
    return;
  }
  const record = {
    name: quickForm.bankName,
    deposit: Number(quickForm.bankDeposit || 0),
    site: "",
    withdrawals: 0,
    transfer: 0,
    activity: "",
    card: quickForm.bankCard,
    account: quickForm.bankAccount
  };
  if (editingBankId.value) {
    const idx = banks.value.findIndex((b) => b.id === editingBankId.value);
    const previous = idx >= 0 ? { ...banks.value[idx] } : null;
    if (idx >= 0) banks.value[idx] = { ...banks.value[idx], ...record };
    const ok = await updateWithNhost("bank", editingBankId.value, record);
    if (!ok && previous && idx >= 0) banks.value[idx] = previous;
    if (ok) editingBankId.value = "";
  } else {
    const item: Bank = { ...record };
    banks.value.unshift(item);
    const newId = await createWithNhost("bank", record);
    if (newId) {
      banks.value[0] = { ...item, id: newId };
    } else {
      banks.value = banks.value.filter((bank) => bank !== item);
      return;
    }
  }
  quickForm.bankName = "";
  quickForm.bankDeposit = 0;
  quickForm.bankAccount = "";
  quickForm.bankCard = "";
}

function startEditSub(row: Subscription) {
  if (!isValidRecordId(row.id)) {
    showCsvToast("資料尚未取得有效 id，請重新載入資料後再編輯。", true);
    return;
  }
  editingSubId.value = row.id;
  quickForm.subscriptionName = row.name;
  quickForm.subscriptionDate = row.nextdate;
  quickForm.subscriptionPrice = row.price;
}
function cancelEditSub() {
  editingSubId.value = "";
  quickForm.subscriptionName = "";
  quickForm.subscriptionDate = "";
  quickForm.subscriptionPrice = 0;
}
async function addSubscription() {
  if (!quickForm.subscriptionName) {
    showCsvToast("請輸入訂閱名稱。", true);
    return;
  }
  if (submitting.value) return;
  submitting.value = true;
  try {
    const record = {
      name: quickForm.subscriptionName,
      site: "",
      price: Number(quickForm.subscriptionPrice || 0),
      nextdate: quickForm.subscriptionDate || null,
      note: "從表單新增",
      account: "",
      currency: "TWD",
      continue: true
    };
    if (editingSubId.value) {
      console.log('Updating subscription:', { id: editingSubId.value, record });
      const idx = subscriptions.value.findIndex((s) => s.id === editingSubId.value);
      const previous = idx >= 0 ? { ...subscriptions.value[idx] } : null;
      if (idx >= 0) subscriptions.value[idx] = { ...subscriptions.value[idx], ...record };
      const ok = await updateWithNhost("subscription", editingSubId.value, record);
      if (!ok && previous && idx >= 0) subscriptions.value[idx] = previous;
      if (ok) editingSubId.value = "";
    } else {
      const item: Subscription = { ...record };
      subscriptions.value.unshift(item);
      const newId = await createWithNhost("subscription", record);
      if (newId) {
        subscriptions.value[0] = { ...item, id: newId };
      } else {
        subscriptions.value = subscriptions.value.filter((sub) => sub !== item);
        return;
      }
    }
    quickForm.subscriptionName = "";
    quickForm.subscriptionDate = "";
    quickForm.subscriptionPrice = 0;
  } finally {
    submitting.value = false;
  }
}

function startEditFood(row: Food) {
  if (!isValidRecordId(row.id)) {
    showCsvToast("資料尚未取得有效 id，請重新載入資料後再編輯。", true);
    return;
  }
  editingFoodId.value = row.id;
  quickForm.foodName = row.name;
  quickForm.foodAmount = row.amount;
  quickForm.foodDate = row.todate;
  quickForm.foodPhoto = row.photo;
}
function cancelEditFood() {
  editingFoodId.value = "";
  quickForm.foodName = "";
  quickForm.foodDate = "";
  quickForm.foodAmount = 1;
  quickForm.foodPhoto = "";
}
async function addFood() {
  if (!quickForm.foodName) {
    showCsvToast("請輸入食品名稱。", true);
    return;
  }
  const record = {
    name: quickForm.foodName,
    amount: Number(quickForm.foodAmount || 1),
    todate: quickForm.foodDate ? quickForm.foodDate.replace(/\//g, "-") : null,
    photo: quickForm.foodPhoto,
    price: 0,
    shop: "從表單新增"
  };
  if (editingFoodId.value) {
    const idx = foods.value.findIndex((f) => f.id === editingFoodId.value);
    const previous = idx >= 0 ? { ...foods.value[idx] } : null;
    if (idx >= 0) foods.value[idx] = { ...foods.value[idx], ...record };
    const ok = await updateWithNhost("food", editingFoodId.value, record);
    if (!ok && previous && idx >= 0) foods.value[idx] = previous;
    if (ok) editingFoodId.value = "";
  } else {
    const item: Food = { ...record };
    foods.value.unshift(item);
    const newId = await createWithNhost("food", record);
    if (newId) {
      foods.value[0] = { ...item, id: newId };
    } else {
      foods.value = foods.value.filter((food) => food !== item);
      return;
    }
  }
  quickForm.foodName = "";
  quickForm.foodDate = "";
  quickForm.foodAmount = 1;
  quickForm.foodPhoto = "";
}

function startEditNote(row: Article) {
  if (!isValidRecordId(row.id)) {
    showCsvToast("資料尚未取得有效 id，請重新載入資料後再編輯。", true);
    return;
  }
  editingNoteId.value = row.id;
  quickForm.noteTitle = row.title;
  quickForm.noteContent = row.content;
}
function cancelEditNote() {
  editingNoteId.value = "";
  quickForm.noteTitle = "";
  quickForm.noteContent = "";
}
async function addNote() {
  if (!quickForm.noteTitle || !quickForm.noteContent) {
    showCsvToast("請輸入標題與內容。", true);
    return;
  }
  const record = {
    title: quickForm.noteTitle,
    content: quickForm.noteContent,
    category: "筆記",
    newDate: new Date().toISOString().slice(0, 10)
  };
  if (editingNoteId.value) {
    const idx = articles.value.findIndex((a) => a.id === editingNoteId.value);
    const previous = idx >= 0 ? { ...articles.value[idx] } : null;
    if (idx >= 0) articles.value[idx] = { ...articles.value[idx], ...record };
    const ok = await updateWithNhost("article", editingNoteId.value, record);
    if (!ok && previous && idx >= 0) articles.value[idx] = previous;
    if (ok) editingNoteId.value = "";
  } else {
    const item: Article = { ...record };
    articles.value.unshift(item);
    const newId = await createWithNhost("article", record);
    if (newId) {
      articles.value[0] = { ...item, id: newId };
    } else {
      articles.value = articles.value.filter((article) => article !== item);
      return;
    }
  }
  quickForm.noteTitle = "";
  quickForm.noteContent = "";
}

function startEditRoutine(row: Routine) {
  if (!isValidRecordId(row.id)) {
    showCsvToast("資料尚未取得有效 id，請重新載入資料後再編輯。", true);
    return;
  }
  editingRoutineId.value = row.id;
  quickForm.routineName = row.name;
  quickForm.routineDate = row.lastdate1;
  quickForm.routineNote = row.note;
  quickForm.routinePhoto = row.photo;
}
function cancelEditRoutine() {
  editingRoutineId.value = "";
  quickForm.routineName = "";
  quickForm.routineDate = "";
  quickForm.routineNote = "";
  quickForm.routinePhoto = "";
}
async function addRoutine() {
  if (!quickForm.routineName) {
    showCsvToast("請輸入例行事項名稱。", true);
    return;
  }
  const record = {
    name: quickForm.routineName,
    note: quickForm.routineNote,
    lastdate1: quickForm.routineDate ? quickForm.routineDate.replace(/\//g, "-") : null,
    lastdate2: "",
    lastdate3: "",
    link: "",
    photo: quickForm.routinePhoto
  };
  if (editingRoutineId.value) {
    const idx = routines.value.findIndex((r) => r.id === editingRoutineId.value);
    const previous = idx >= 0 ? { ...routines.value[idx] } : null;
    if (idx >= 0) routines.value[idx] = { ...routines.value[idx], ...record };
    const ok = await updateWithNhost("routine", editingRoutineId.value, record);
    if (!ok && previous && idx >= 0) routines.value[idx] = previous;
    if (ok) editingRoutineId.value = "";
  } else {
    const item: Routine = { ...record };
    routines.value.unshift(item);
    const newId = await createWithNhost("routine", record);
    if (newId) {
      routines.value[0] = { ...item, id: newId };
    } else {
      routines.value = routines.value.filter((routine) => routine !== item);
      return;
    }
  }
  quickForm.routineName = "";
  quickForm.routineDate = "";
  quickForm.routineNote = "";
  quickForm.routinePhoto = "";
}

function showCsvToast(message: string, isError = false) {
  csvToast.value = { message, isError };
  if (csvToastTimer) clearTimeout(csvToastTimer);
  csvToastTimer = setTimeout(() => { csvToast.value = null; }, 3200);
}

async function doImport(
  event: Event,
  label: string,
  importFn: (text: string) => unknown[],
  apply: (items: unknown[]) => void,
  crudTable?: string
) {
  const input = event.target as HTMLInputElement;
  if (!input?.files?.length) return;
  csvImporting.value = label;
  showCsvToast(`正在匯入 ${label} CSV...`);
  const file = input.files[0];
  try {
    const text = await readFileAsText(file);
    const items = importFn(text);
    if (!items.length) {
      showCsvToast("CSV 沒有可匯入的資料。", true);
      return;
    }
    apply(items);
    showCsvToast(`已匯入 ${items.length} 筆 ${label} 資料：${file.name}`);

    // Write to Nhost if connected using bulk-insert
    if (crudTable) {
      const conn = getNhostConnection();
      if (conn.graphqlUrl) {
        try {
          const result = await callCrudApi({ action: "bulk-insert", records: items }, crudTable);
          if (result.ok) {
            showCsvToast(`已同步到 Nhost：${result.affectedRows ?? items.length} 筆 ${label} 資料`);
            await loadNhostData(); // reload real rows and database ids
          } else {
            showCsvToast("資料已匯入畫面，但同步到 Nhost 失敗。", true);
          }
        } catch (e) {
          showCsvToast(`本機匯入成功，但同步到 Nhost 失敗：${e instanceof Error ? e.message : "未知錯誤"}`, true);
        }
      }
    }
  } catch (err) {
    showCsvToast(`匯入失敗：${err instanceof Error ? err.message : "未知錯誤"}`, true);
  } finally {
    csvImporting.value = "";
    input.value = "";
  }
}

const importSubCsv = (e: Event) => doImport(e, "訂閱", importSubscriptions, (v) => { subscriptions.value = v as Subscription[]; }, "subscription");
const importFoodCsv = (e: Event) => doImport(e, "食品", importFoods, (v) => { foods.value = v as Food[]; }, "food");
const importNoteCsv = (e: Event) => doImport(e, "筆記", importArticles, (v) => { articles.value = v as Article[]; }, "article");
const importCommonCsv = (e: Event) => doImport(e, "常用帳號", importCommonAccounts, (v) => { commonAccounts.value = v as CommonAccount[]; }, "commonaccount");
const importBankCsv = (e: Event) => doImport(e, "銀行", importBanks, (v) => { banks.value = v as Bank[]; }, "bank");
const importRoutineCsv = (e: Event) => doImport(e, "例行事項", importRoutines, (v) => { routines.value = v as Routine[]; }, "routine");

async function copyTableSql() {
  tableGenerationStatus.value = "";

  try {
    await navigator.clipboard.writeText(tableSql);
    tableGenerationStatus.value = "已複製建表 SQL，可貼到 Nhost SQL Editor 執行。";
  } catch {
    tableGenerationStatus.value = "無法複製到剪貼簿，請手動選取 SQL。";
  }
}

function downloadTableSql() {
  const blob = new Blob([tableSql], { type: "text/sql;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "fengbro-nhost-tables.sql";
  link.click();
  URL.revokeObjectURL(url);
  tableGenerationStatus.value = "已下載 fengbro-nhost-tables.sql。";
}

async function generateTables() {
  isGeneratingTables.value = true;
  tableGenerationStatus.value = "正在建立資料表、Track 到 GraphQL，並匯入初始資料...";

  try {
    const result = await $fetch<{ ok: boolean; tables: number; tracked?: number; trackSkipped?: number }>("/api/nhost/create-tables", {
      method: "POST",
      body: getNhostConnection()
    });
    tableGenerationStatus.value = result.ok
      ? `已建立 ${result.tables} 張資料表，Track ${result.tracked ?? 0} 張，略過 ${result.trackSkipped ?? 0} 張。`
      : "建表 API 回傳失敗，請檢查 Nhost 設定。";
    await loadNhostData();
  } catch (error) {
    tableGenerationStatus.value = error instanceof Error
      ? `無法一鍵建表：${error.message}。可先複製 SQL 到 Nhost SQL Editor 執行。`
      : "無法一鍵建表，可先複製 SQL 到 Nhost SQL Editor 執行。";
  } finally {
    isGeneratingTables.value = false;
  }
}

async function callCrudApi(body: Record<string, unknown>, tableOverride?: string) {
  return await $fetch<CrudResponse>("/api/nhost/crud", {
    method: "POST",
    body: {
      ...body,
      table: tableOverride || activeCrudConfig.value.table,
      ...getNhostConnection()
    }
  });
}

async function loadCrudRows() {
  isCrudBusy.value = true;
  crudStatus.value = `正在載入 ${activeCrudConfig.value.label}...`;

  try {
    const result = await callCrudApi({ action: "list" });
    crudRows.value = result.rows || [];
    crudStatus.value = `已載入 ${crudRows.value.length} 筆 ${activeCrudConfig.value.label}。`;
    resetCrudDraft();
  } catch (error) {
    crudStatus.value = error instanceof Error ? `載入失敗：${error.message}` : "載入失敗。";
  } finally {
    isCrudBusy.value = false;
  }
}

async function saveCrudRecord() {
  isCrudBusy.value = true;
  const isEditing = Boolean(editingCrudId.value);
  const record = normalizeCrudDraft();
  const previousRows = [...crudRows.value];
  const optimisticId = isEditing ? editingCrudId.value : `optimistic-${Date.now()}`;

  crudStatus.value = isEditing ? "正在更新資料..." : "正在新增資料...";
  if (isEditing) {
    crudRows.value = crudRows.value.map((row) =>
      String(row.id) === editingCrudId.value ? { ...row, ...record } : row
    );
  } else {
    crudRows.value = [{ id: optimisticId, ...record, isOptimistic: true }, ...crudRows.value];
  }

  try {
    const result = await callCrudApi({
      action: isEditing ? "update" : "insert",
      id: isEditing ? editingCrudId.value : undefined,
      record
    });
    if (!result.ok || !result.row?.id) {
      throw new Error(isEditing ? "資料庫未回傳更新資料。" : "資料庫未回傳新增 id，請檢查 Hasura 權限。");
    }
    if (!isEditing) {
      const realId = String(result.row.id);
      crudRows.value = crudRows.value.map((row) =>
        String(row.id) === optimisticId ? { ...row, id: realId, isOptimistic: false } : row
      );
    }
    crudStatus.value = isEditing ? "已更新資料。" : "已新增資料。";
    resetCrudDraft();
    await loadNhostData();
  } catch (error) {
    crudRows.value = previousRows;
    crudStatus.value = error instanceof Error ? `儲存失敗：${error.message}` : "儲存失敗。";
  } finally {
    isCrudBusy.value = false;
  }
}

function confirmDeleteCrudRecord(row: Record<string, unknown>) {
  const id = String(row.id || "");
  const name = String(row.name || row.title || id);
  if (!id) {
    crudStatus.value = "刪除失敗：這筆資料沒有 id。";
    return;
  }
  requestDelete(name, async () => {
    await deleteCrudRecord(id, name);
  });
}

async function deleteCrudRecord(id: string, name: string) {
  isCrudBusy.value = true;
  const previousRows = [...crudRows.value];
  crudRows.value = crudRows.value.filter((item) => String(item.id) !== id);
  crudStatus.value = `正在刪除 ${name}...`;

  try {
    await callCrudApi({ action: "delete", id });
    crudStatus.value = "已刪除資料。";
    await loadNhostData();
  } catch (error) {
    crudRows.value = previousRows;
    crudStatus.value = error instanceof Error ? `刪除失敗：${error.message}` : "刪除失敗。";
  } finally {
    isCrudBusy.value = false;
  }
}

function editCrudRecord(row: Record<string, unknown>) {
  editingCrudId.value = String(row.id || "");
  for (const field of activeCrudConfig.value.fields) {
    const value = row[field.key];
    crudDraft[field.key] = field.type === "json" ? JSON.stringify(value || [], null, 2) : formatCrudValue(value, field.type);
  }
  crudStatus.value = editingCrudId.value ? `正在編輯 ${editingCrudId.value}` : "這筆資料沒有 id，無法編輯。";
}

function resetCrudDraft() {
  editingCrudId.value = "";
  for (const field of activeCrudConfig.value.fields) {
    crudDraft[field.key] = field.type === "boolean" ? "false" : "";
  }
}

function normalizeCrudDraft() {
  const record: Record<string, unknown> = {};

  for (const field of activeCrudConfig.value.fields) {
    const raw = crudDraft[field.key] || "";

    if (field.type === "number") record[field.key] = Number(raw || 0);
    else if (field.type === "boolean") record[field.key] = raw === "true";
    else if (field.type === "json") {
      try {
        record[field.key] = raw ? JSON.parse(raw) : [];
      } catch {
        record[field.key] = [];
      }
    } else if (field.type === "date") record[field.key] = raw ? raw.slice(0, 10) : null;
    else if (raw) record[field.key] = raw;
    // skip empty text fields (do not overwrite with empty string unless explicitly set)
  }

  return record;
}

function formatCrudValue(value: unknown, fieldType?: string) {
  if (value === null || value === undefined) return "";
  // Only slice date strings to 10 chars (YYYY-MM-DD), never truncate other text
  if (typeof value === "string") return fieldType === "date" ? value.slice(0, 10) : value;
  return String(value);
}

function crudPlaceholder(field: CrudField) {
  return field.type === "json" ? '[{"site":"Nhost","note":""}]' : field.label;
}

async function importCrudCsv(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  isCrudBusy.value = true;
  crudStatus.value = `正在匯入 ${file.name}...`;
  const previousRows = [...crudRows.value];

  try {
    const csv = await file.text();
    const records = parseCsv(csv).map((row) => normalizeCsvRow(activeCrudConfig.value, row));
    const optimisticRows: OptimisticCrudRow[] = records.map((record, index) => ({
      id: `optimistic-import-${Date.now()}-${index}`,
      ...record,
      isOptimistic: true
    }));
    crudRows.value = [...optimisticRows, ...crudRows.value];
    const result = await callCrudApi({ action: "bulk-insert", records });
    crudStatus.value = `已匯入 ${result.affectedRows ?? records.length} 筆 ${activeCrudConfig.value.label}。`;
    await loadCrudRows();
    await loadNhostData();
  } catch (error) {
    crudRows.value = previousRows;
    crudStatus.value = error instanceof Error ? `匯入失敗：${error.message}` : "匯入失敗。";
  } finally {
    isCrudBusy.value = false;
    input.value = "";
  }
}

function exportCrudCsv() {
  const csv = toCsv(crudRows.value.map((row) => normalizeExportRow(activeCrudConfig.value, row)));
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = activeCrudConfig.value.filename;
  link.click();
  URL.revokeObjectURL(url);
  crudStatus.value = `已匯出 ${crudRows.value.length} 筆 ${activeCrudConfig.value.label} CSV。`;
}

function parseCsv(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);

  const [headers = [], ...records] = rows;
  return records.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header.trim(), values[index] ?? ""]))
  );
}

function normalizeCsvRow(config: CrudConfig, row: Record<string, string>) {
  if (config.table === "commonaccount") {
    const sites = Array.from({ length: 50 }, (_, index) => index + 1)
      .map((index) => ({
        site: row[`site${String(index).padStart(2, "0")}`] || "",
        note: row[`note${String(index).padStart(2, "0")}`] || ""
      }))
      .filter((entry) => entry.site || entry.note);
    return { name: row.name || "", sites, note: row.note || "" };
  }

  const record: Record<string, unknown> = {};
  for (const field of config.fields) {
    const raw = row[field.key] ?? "";
    if (field.type === "number") record[field.key] = Number(raw || 0);
    else if (field.type === "boolean") record[field.key] = ["true", "1", "yes", "y"].includes(raw.toLowerCase());
    else if (field.type === "json") {
      try {
        record[field.key] = raw ? JSON.parse(raw) : [];
      } catch {
        record[field.key] = [];
      }
    } else if (field.type === "date") record[field.key] = raw ? raw.slice(0, 10) : null;
    else record[field.key] = raw;
  }

  return record;
}

function normalizeExportRow(config: CrudConfig, row: Record<string, unknown>) {
  const output: Record<string, unknown> = {};
  for (const field of config.fields) {
    const value = row[field.key];
    output[field.key] = field.type === "json" ? JSON.stringify(value || []) : value ?? "";
  }
  return output;
}

function toCsv(rows: Array<Record<string, unknown>>) {
  const headers = activeCrudConfig.value.fields.map((field) => field.key);
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))
  ].join("\n");
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
</script>

<template>
  <div class="app-shell">
    <div class="ambient" />

    <aside :class="['sidebar', { open: isSidebarOpen }]">
      <div class="brand">
        <div class="brand-mark"><Sparkles :size="22" /></div>
        <div>
          <p>NhostFengBroAI</p>
          <strong>鋒兄資料工作台</strong>
        </div>
      </div>

      <nav class="menu-list" aria-label="主選單">
        <template v-for="item in menuItems" :key="item.id">
          <button
            :class="['menu-button', { active: currentModule === item.id || item.children?.some((child) => child.id === currentModule) }]"
            type="button"
            @click="navigate(item.id)"
          >
            <component :is="item.icon" :size="18" />
            <span>
              {{ item.label }}
              <small v-if="item.subtitle">{{ item.subtitle }}</small>
            </span>
          </button>
          <div v-if="item.children?.length && expandedMenus.includes(item.id)" class="submenu">
            <button
              v-for="child in item.children"
              :key="child.id"
              :class="['menu-button child', { active: currentModule === child.id }]"
              type="button"
              @click="navigate(child.id)"
            >
              <component :is="child.icon" :size="16" />
              <span>{{ child.label }}</span>
            </button>
          </div>
        </template>
      </nav>

      <div class="sidebar-note">
        <WalletCards :size="20" />
        <span>{{ statusLabel }}嚗{ sourceMessage }}</span>
      </div>
    </aside>

    <main class="workspace">
      <header class="topbar">
        <button class="icon-button mobile-only" type="button" aria-label="???詨" @click="isSidebarOpen = !isSidebarOpen">
          <X v-if="isSidebarOpen" :size="19" />
          <Menu v-else :size="19" />
        </button>
        <div class="page-title">
          <p>Nuxt Workspace</p>
          <h1>{{ activeItem.label }}</h1>
        </div>
        <label class="search-box">
          <Search :size="18" />
          <input v-model="query" type="search" placeholder="搜尋訂閱、食品、帳號、筆記、銀行、例行" />
          <button v-if="query" class="clear-search" type="button" aria-label="皜??" @click="query = ''">
            <X :size="15" />
          </button>
        </label>
      </header>

      <!-- Global data state banner -->
      <div v-if="dataSource === 'loading'" class="data-state-banner loading">
        <span class="spinner-dot" /><span class="spinner-dot" /><span class="spinner-dot" />
        <span>正在載入 Nhost GraphQL...</span>
      </div>
      <div v-else-if="dataSource === 'error'" class="data-state-banner error">
        <span>資料載入失敗：{{ nhostError }}</span>
        <button type="button" @click="loadNhostData">重試</button>
      </div>
      <div v-else-if="dataSource === 'empty'" class="data-state-banner empty">
        <span>資料庫無資料，請新增資料或匯入 CSV。</span>
        <button type="button" @click="navigate('settings')">前往設定</button>
      </div>

      <section v-if="currentModule === 'home' || currentModule === 'dashboard'" class="module-grid">
        <div class="hero-panel">
          <div>
            <p class="panel-kicker">FengBro Console</p>
            <h2>鋒兄資料中控台</h2>
            <p>
              透過 Nhost GraphQL 讀寫資料，整合訂閱、食品、帳號、筆記、銀行與例行事項。
              可先在設定頁完成連線，再用各模組新增、匯入與檢視資料。
            </p>
          </div>
          <div class="hero-stack" aria-label="鞈???">
            <span>{{ statusLabel }}</span>
            <span>{{ subscriptions.length }} 筆訂閱</span>
            <span>{{ foods.length }} 筆食品</span>
            <span>{{ banks.length }} 筆銀行</span>
          </div>
        </div>

        <div class="stats-grid">
          <article class="stat-card"><CreditCard /><span>??閮</span><strong>{{ recurringSubscriptions }}</strong></article>
          <article class="stat-card"><CircleDollarSign /><span>TWD 閮?臬</span><strong>{{ money(totalTwdSubscriptions) }}</strong></article>
          <article class="stat-card"><Utensils /><span>憌?摨怠??賊?</span><strong>{{ foodUnits }}</strong></article>
          <article class="stat-card"><Landmark /><span>?銵蜇擗?</span><strong>{{ money(totalBankDeposit) }}</strong></article>
        </div>

        <section class="panel wide">
          <div class="section-heading">
            <h3>餈?閮</h3>
            <button type="button" @click="navigate('subscription')">?亦?閮</button>
          </div>
          <div class="timeline">
            <article v-for="item in sortedSubscriptions.slice(0, 8)" :key="`${item.name}-${item.nextdate}`">
              <span>{{ daysUntil(item.nextdate) }}</span>
              <strong>{{ item.name }}</strong>
              <small>{{ item.nextdate }} / {{ money(item.price, item.currency) }}</small>
            </article>
          </div>
          <form class="quick-form" @submit.prevent="addCommonAccount">
            <input v-model="quickForm.commonName" placeholder="撣唾? / ?迂" />
            <input v-model="quickForm.commonSite" placeholder="蝡 / ??" />
            <input v-model="quickForm.commonNote" placeholder="?酉" />
            <button type="submit">?啣?撣貊</button>
          </form>
        </section>

        <section class="panel">
          <div class="section-heading">
            <h3>最新筆記</h3>
            <button type="button" @click="navigate('notes')">前往</button>
          </div>
          <div class="note-list">
            <article v-for="item in latestArticles" :key="`${item.title}-${item.newDate}`">
              <strong>{{ item.title }}</strong>
              <small>{{ item.category || "未分類" }} / {{ item.newDate }}</small>
            </article>
          </div>
        </section>
      </section>

      <section v-else-if="currentModule === 'subscription'" class="module-grid">
        <section class="panel wide">
          <div class="section-heading">
            <h3>?啣?閮</h3>
            <div class="csv-actions">
              <button class="csv-btn export" type="button" @click="exportSubscriptions(subscriptions)"><Download :size="15" />?臬 CSV</button>
              <label class="csv-btn import" :class="{ loading: csvImporting === '閮' }">
                <Upload :size="15" />{{ csvImporting === '閮' ? '?臬銝?..' : '?臬 CSV' }}
                <input class="csv-hidden-input" type="file" accept=".csv" @change="importSubCsv" />
              </label>
            </div>
          </div>
          <form class="quick-form" @submit.prevent="addSubscription">
            <input v-model="quickForm.subscriptionName" placeholder="?迂" :class="{ editing: editingSubId }" />
            <input v-model="quickForm.subscriptionDate" type="date" />
            <input v-model.number="quickForm.subscriptionPrice" min="0" type="number" placeholder="?寞" />
            <button type="submit" :disabled="submitting">{{ submitting ? '??銝?..' : (editingSubId ? '?湔閮' : '?啣?') }}</button>
            <button v-if="editingSubId" type="button" class="cancel-btn" @click="cancelEditSub">??</button>
          </form>
        </section>
        <section class="panel wide">
          <div v-if="dataSource === 'error'" class="inline-status error">
            <span>資料載入失敗，請檢查 Nhost 設定。</span>
            <button type="button" class="retry-btn" @click="loadNhostData">重試</button>
          </div>
          <div v-else-if="dataSource === 'empty'" class="inline-status empty">
            <span>資料庫尚無訂閱資料，請在上方新增或匯入 CSV。</span>
          </div>
          <div v-else-if="filteredSubscriptions.length === 0 && dataSource === 'nhost'" class="inline-status empty">
            <span>尚未找到符合搜尋的訂閱資料。</span>
          </div>
          <DataTable v-else :rows="filteredSubscriptions" :columns="['名稱', '費用', '幣別', '下次日期', '帳號', '狀態']">
            <template #default="{ row }">
              <td><a v-if="row.site" :href="row.site" target="_blank">{{ row.name }}</a><span v-else>{{ row.name }}</span><small>{{ row.note }}</small><div class="row-btn-group"><button class="text-action" type="button" @click="startEditSub(row)">蝺刻摩</button><button class="text-action danger" type="button" @click="confirmDeleteSubscription(row.name)">?芷</button></div></td>
              <td>{{ money(row.price, row.currency) }}</td>
              <td>{{ row.currency }}</td>
              <td>{{ row.nextdate }}<small>{{ daysUntil(row.nextdate) }}</small></td>
              <td>{{ row.account || "未設定" }}</td>
              <td><span :class="['pill', row.continue ? 'good' : 'muted']">{{ row.continue ? "續訂" : "停用" }}</span></td>
            </template>
          </DataTable>
        </section>
      </section>

      <section v-else-if="currentModule === 'food'" class="module-grid">
        <section class="panel wide">
          <div class="section-heading">
            <h3>?啣?憌?摨怠?</h3>
            <div class="csv-actions">
              <button class="csv-btn export" type="button" @click="exportFoods(foods)"><Download :size="15" />?臬 CSV</button>
              <label class="csv-btn import" :class="{ loading: csvImporting === '憌?' }">
                <Upload :size="15" />{{ csvImporting === '憌?' ? '?臬銝?..' : '?臬 CSV' }}
                <input class="csv-hidden-input" type="file" accept=".csv" @change="importFoodCsv" />
              </label>
            </div>
          </div>
          <form class="quick-form" @submit.prevent="addFood">
            <input v-model="quickForm.foodName" placeholder="??" :class="{ editing: editingFoodId }" />
            <input v-model.number="quickForm.foodAmount" min="1" type="number" placeholder="?賊?" />
            <input v-model="quickForm.foodDate" type="date" />
            <input v-model="quickForm.foodPhoto" placeholder="?? URL" />
            <button type="button" class="secondary-btn" :disabled="isFoodPhotoUploading" @click="foodPhotoInput?.click()">
              <Upload :size="15" />{{ isFoodPhotoUploading ? "銝銝?.." : "銝??" }}
            </button>
            <input ref="foodPhotoInput" class="hidden-input" type="file" accept="image/*" @change="uploadFoodPhoto" />
            <button type="submit">{{ editingFoodId ? '?湔憌?' : '?啣?' }}</button>
            <button v-if="editingFoodId" type="button" class="cancel-btn" @click="cancelEditFood">??</button>
          </form>
        </section>
        <article v-for="item in filteredFoods" :key="`${item.name}-${item.todate}`" class="media-card">
          <img v-if="item.photo" :src="item.photo" :alt="item.name" loading="lazy" />
          <div v-else class="image-fallback"><Package :size="28" /></div>
          <div>
            <strong>{{ item.name }}</strong>
            <span>?賊? {{ item.amount }} / ?唳? {{ item.todate }} / {{ daysUntil(item.todate) }}</span>
            <div class="row-btn-group"><button class="text-action" type="button" @click="startEditFood(item)">蝺刻摩</button><button class="text-action danger" type="button" @click="confirmDeleteFood(item.name)">?芷</button></div>
          </div>
        </article>
      </section>

      <section v-else-if="currentModule === 'notes'" class="module-grid">
        <section class="panel wide">
          <div class="section-heading">
            <h3>?啣?蝑?</h3>
            <div class="csv-actions">
              <button class="csv-btn export" type="button" @click="exportArticles(articles)"><Download :size="15" />?臬 CSV</button>
              <label class="csv-btn import" :class="{ loading: csvImporting === '蝑?' }">
                <Upload :size="15" />{{ csvImporting === '蝑?' ? '?臬銝?..' : '?臬 CSV' }}
                <input class="csv-hidden-input" type="file" accept=".csv" @change="importNoteCsv" />
              </label>
            </div>
          </div>
          <form class="quick-form note-form" @submit.prevent="addNote">
            <input v-model="quickForm.noteTitle" placeholder="璅?" :class="{ editing: editingNoteId }" />
            <textarea v-model="quickForm.noteContent" placeholder="?批捆" />
            <button type="submit">{{ editingNoteId ? '?湔蝑?' : '?啣?' }}</button>
            <button v-if="editingNoteId" type="button" class="cancel-btn" @click="cancelEditNote">??</button>
          </form>
        </section>
        <article v-for="item in filteredArticles" :key="`${item.title}-${item.newDate}`" class="note-card">
          <small>{{ item.category || "未分類" }} / {{ item.newDate }}</small>
          <h3>{{ item.title }}</h3>
          <p>{{ item.content }}</p>
          <div class="row-btn-group"><button class="text-action" type="button" @click="startEditNote(item)">蝺刻摩</button><button class="text-action danger" type="button" @click="confirmDeleteArticle(item.title)">?芷</button></div>
        </article>
      </section>

      <section v-else-if="currentModule === 'common'" class="module-grid">
        <section class="panel wide">
          <div class="section-heading">
            <h3>撣貊撣唾?</h3>
            <div class="csv-actions">
              <button class="csv-btn export" type="button" @click="exportCommonAccounts(commonAccounts)"><Download :size="15" />?臬 CSV</button>
              <label class="csv-btn import" :class="{ loading: csvImporting === '撣貊撣唾?' }">
                <Upload :size="15" />{{ csvImporting === '撣貊撣唾?' ? '?臬銝?..' : '?臬 CSV' }}
                <input class="csv-hidden-input" type="file" accept=".csv" @change="importCommonCsv" />
              </label>
            </div>
          </div>
        </section>
        <article v-for="account in filteredAccounts" :key="account.name" class="account-card">
          <h3>{{ account.name }}</h3>
          <div class="chip-row">
            <span v-for="entry in account.sites" :key="`${account.name}-${entry.site}`" class="chip">{{ entry.site }}<small v-if="entry.note">{{ entry.note }}</small></span>
          </div>
          <button class="text-action danger" type="button" @click="confirmDeleteCommonAccount(account.name)">?芷</button>
        </article>
      </section>

      <section v-else-if="['images', 'videos', 'music', 'documents', 'podcast'].includes(currentModule)" class="module-grid">
        <section class="panel wide">
          <div class="section-heading"><h3>?啣?慦?鞈?</h3></div>
          <form class="quick-form" @submit.prevent="addMediaItem">
            <input v-model="quickForm.mediaName" placeholder="?迂" />
            <input v-model="quickForm.mediaUrl" placeholder="??? / Storage URL" />
            <input v-model="quickForm.mediaNote" placeholder="?酉" />
            <button type="button" class="secondary-btn" :disabled="isMediaUploading" @click="mediaUploadInput?.click()">
              <Upload :size="15" />{{ isMediaUploading ? "上傳中..." : activeMediaUploadLabel }}
            </button>
            <input ref="mediaUploadInput" class="hidden-input" type="file" :accept="activeMediaAccept" @change="uploadMediaFile" />
            <button type="submit">?啣?</button>
          </form>
        </section>
        <article v-for="item in activeMediaItems" :key="`${item.name}-${item.url}`" class="media-tile">
          <img v-if="currentModule === 'images' && item.url" class="media-preview" :src="item.url" :alt="item.name" loading="lazy" />
          <video v-else-if="currentModule === 'videos' && item.url" class="media-preview" :src="item.url" controls preload="metadata" />
          <audio v-else-if="(currentModule === 'music' || currentModule === 'podcast') && item.url" class="media-audio" :src="item.url" controls />
          <a v-else-if="currentModule === 'documents' && item.url" class="media-file-link" :href="item.url" target="_blank" rel="noreferrer">
            <BookOpenText :size="24" />開啟文件
          </a>
          <component v-else :is="activeMediaIcon" :size="28" />
          <strong>{{ item.name }}</strong>
          <span>{{ item.note || statusLabel }}</span>
          <a v-if="item.url" class="text-action" :href="item.url" target="_blank" rel="noreferrer">開啟</a>
          <button class="text-action danger" type="button" @click="confirmDeleteMediaItem(item.name)">刪除</button>
        </article>
      </section>

      <section v-else-if="currentModule === 'bank'" class="module-grid">
        <section class="panel wide">
          <div class="section-heading">
            <h3>新增銀行</h3>
            <div class="csv-actions">
              <button class="csv-btn export" type="button" @click="exportBanks(banks)"><Download :size="15" />?臬 CSV</button>
              <label class="csv-btn import" :class="{ loading: csvImporting === '銀行' }">
                <Upload :size="15" />{{ csvImporting === "銀行" ? "匯入中..." : "匯入 CSV" }}
                <input class="csv-hidden-input" type="file" accept=".csv" @change="importBankCsv" />
              </label>
            </div>
          </div>
          <form class="quick-form" @submit.prevent="addBank">
            <input v-model="quickForm.bankName" placeholder="?銵?/ ?餃?蟡刻??迂" :class="{ editing: editingBankId }" />
            <input v-model.number="quickForm.bankDeposit" min="0" type="number" placeholder="擗?" />
            <input v-model="quickForm.bankAccount" placeholder="撣唾?" />
            <input v-model="quickForm.bankCard" placeholder="?∠? / ?餃?蟡刻?" />
            <button type="submit">{{ editingBankId ? "更新銀行" : "新增銀行" }}</button>
            <button v-if="editingBankId" type="button" class="cancel-btn" @click="cancelEditBank">??</button>
          </form>
          <DataTable :rows="filteredBanks" :columns="['名稱', '存款', '提款', '轉帳', '卡片', '帳號']">
            <template #default="{ row }">
              <td><a v-if="row.site" :href="row.site" target="_blank">{{ row.name }}</a><span v-else>{{ row.name }}</span><div class="row-btn-group"><button class="text-action" type="button" @click="startEditBank(row)">蝺刻摩</button><button class="text-action danger" type="button" @click="confirmDeleteBank(row.name)">?芷</button></div></td>
              <td>{{ money(row.deposit) }}</td>
              <td>{{ row.withdrawals }}</td>
              <td>{{ row.transfer }}</td>
              <td>{{ row.card || "未設定" }}</td>
              <td>{{ row.account || "未設定" }}</td>
            </template>
          </DataTable>
        </section>
      </section>

      <section v-else-if="currentModule === 'routine'" class="module-grid">
        <section class="panel wide">
          <div class="section-heading">
            <h3>?啣?靘?鈭?</h3>
            <div class="csv-actions">
              <button class="csv-btn export" type="button" @click="exportRoutines(routines)"><Download :size="15" />?臬 CSV</button>
              <label class="csv-btn import" :class="{ loading: csvImporting === '靘?鈭?' }">
                <Upload :size="15" />{{ csvImporting === '靘?鈭?' ? '?臬銝?..' : '?臬 CSV' }}
                <input class="csv-hidden-input" type="file" accept=".csv" @change="importRoutineCsv" />
              </label>
            </div>
          </div>
          <form class="quick-form" @submit.prevent="addRoutine">
            <input v-model="quickForm.routineName" placeholder="?迂" :class="{ editing: editingRoutineId }" />
            <input v-model="quickForm.routineDate" type="date" />
            <input v-model="quickForm.routineNote" placeholder="?酉" />
            <input v-model="quickForm.routinePhoto" placeholder="?? URL" />
            <button type="button" class="secondary-btn" :disabled="isRoutinePhotoUploading" @click="routinePhotoInput?.click()">
              <Upload :size="15" />{{ isRoutinePhotoUploading ? "上傳中..." : "上傳圖片" }}
            </button>
            <input ref="routinePhotoInput" class="hidden-input" type="file" accept="image/*" @change="uploadRoutinePhoto" />
            <button type="submit">{{ editingRoutineId ? "更新例行" : "新增" }}</button>
            <button v-if="editingRoutineId" type="button" class="cancel-btn" @click="cancelEditRoutine">取消</button>
          </form>
        </section>
        <article v-for="item in filteredRoutines" :key="`${item.name}-${item.lastdate1}`" class="routine-card">
          <div>
            <strong>{{ item.name }}</strong>
            <small>{{ item.lastdate1 || "未設定" }}</small>
          </div>
          <p>{{ item.note || "無備註" }}</p>
          <a v-if="item.link" :href="item.link" target="_blank">開啟連結</a>
          <div class="row-btn-group"><button class="text-action" type="button" @click="startEditRoutine(item)">蝺刻摩</button><button class="text-action danger" type="button" @click="confirmDeleteRoutine(item.name)">?芷</button></div>
        </article>
      </section>

      <section v-else-if="['tools', 'price-compare', 'phone-compare', 'fengbro-tube', 'fengbro-finance'].includes(currentModule)" class="module-grid">
        <section class="panel wide">
          <div class="tabs" role="tablist">
            <button :class="{ active: activeTool === 'price-compare' }" type="button" @click="activeTool = 'price-compare'; currentModule = 'price-compare'">?寞瘥?</button>
            <button :class="{ active: activeTool === 'phone-compare' }" type="button" @click="activeTool = 'phone-compare'; currentModule = 'phone-compare'">??瘥?</button>
            <button :class="{ active: activeTool === 'fengbro-tube' }" type="button" @click="activeTool = 'fengbro-tube'; currentModule = 'fengbro-tube'">FengBro Tube</button>
            <button :class="{ active: activeTool === 'fengbro-finance' }" type="button" @click="activeTool = 'fengbro-finance'; currentModule = 'fengbro-finance'">??餈質馱</button>
          </div>
        </section>

        <template v-if="activeTool === 'price-compare'">
          <article v-for="item in articles.filter((article) => article.category.includes('?寞'))" :key="item.title" class="note-card">
            <small>{{ item.newDate }}</small>
            <h3>{{ item.title }}</h3>
            <p>{{ item.content }}</p>
          </article>
        </template>
        <template v-else-if="activeTool === 'phone-compare'">
          <article class="tool-card"><Boxes /><strong>手機比較</strong><span>可從 Nhost 新增獨立 table 後映射進來。</span></article>
        </template>
        <template v-else-if="activeTool === 'fengbro-tube'">
          <article v-for="item in mediaSeed.videos" :key="`${item.name}-${item.url}`" class="tool-card"><Play /><strong>{{ item.name }}</strong><span>{{ item.note || statusLabel }}</span></article>
        </template>
        <template v-else>
          <article v-for="item in filteredFinanceWatch" :key="`${item.name}-${item.symbol}`" class="tool-card"><CircleDollarSign /><strong>{{ item.name }} / {{ item.symbol }}</strong><span>{{ item.value }} / {{ item.note }}</span></article>
        </template>
      </section>

      <section v-else-if="currentModule === 'settings'" class="module-grid">
        <article class="panel wide">
          <div class="section-heading">
            <div>
              <h3>Nhost API 資訊</h3>
              <p class="section-note">輸入 Nhost 專案的 GraphQL URL 與權限資訊，儲存在目前瀏覽器。</p>
            </div>
            <div class="button-row">
              <button type="button" :disabled="isTestingConnection" @click="testNhostConnection">
                {{ isTestingConnection ? "測試中..." : "測試連線" }}
              </button>
              <button type="button" @click="saveAndReloadNhostSettings">儲存並連線</button>
              <button type="button" @click="clearNhostSettings">清除</button>
            </div>
          </div>
          <div class="settings-form">
            <label>
              <span>GraphQL URL</span>
              <input
                v-model="nhostSettings.graphqlUrl"
                autocomplete="off"
                placeholder="https://ullnfgbmboomsrmvscge.graphql.ap-southeast-1.nhost.run/v1"
              />
            </label>
            <label>
              <span>Hasura Admin Secret</span>
              <div class="secret-field">
                <input
                  v-model="nhostSettings.adminSecret"
                  :type="isSecretVisible ? 'text' : 'password'"
                  autocomplete="off"
                  placeholder="?冽?? Table ????靽風鞈?"
                />
                <button type="button" @click="isSecretVisible = !isSecretVisible">
                  {{ isSecretVisible ? "?梯?" : "憿舐內" }}
                </button>
              </div>
            </label>
            <label>
              <span>Authorization Token（可選）</span>
              <input
                v-model="nhostSettings.authorization"
                autocomplete="off"
                placeholder="Bearer eyJ..."
              />
            </label>
            <p class="settings-hint">Admin Secret 會儲存在目前瀏覽器，按「清除」可移除本機儲存的 API 資訊。</p>
          </div>
          <p
            v-if="connectionTestStatus"
            :class="['status-message', connectionTestOk === false ? 'error' : connectionTestOk === true ? 'success' : '']"
          >
            {{ connectionTestStatus }}
          </p>
          <p v-if="settingsStatus" class="status-message">{{ settingsStatus }}</p>
        </article>
        <article class="panel wide">
          <h3>資料連線狀態</h3>
          <div class="settings-list">
            <label><input type="checkbox" :checked="dataSource === 'nhost'" disabled /> 使用 Nhost GraphQL 載入資料</label>
            <label><input type="checkbox" :checked="Boolean(loadedTables.length)" disabled /> 已載入資料表：{{ loadedTables.join(", ") || "尚未載入" }}</label>
            <label><input type="checkbox" :checked="dataSource === 'fallback'" disabled /> 使用備援資料</label>
            <label><input type="checkbox" checked disabled /> CRUD / CSV 已連接 Nhost 實際資料</label>
          </div>
        </article>
        <article class="panel wide">
          <div class="section-heading">
            <div>
              <h3>資料 CRUD / CSV</h3>
              <p class="section-note">檢視資料表，可新增、更新、刪除資料，也支援 CSV 匯入與匯出。</p>
            </div>
            <div class="button-row">
              <select v-model="activeCrudTable" class="crud-select" @change="loadCrudRows">
                <option v-for="config in crudConfigs" :key="config.table" :value="config.table">{{ config.label }}</option>
              </select>
              <button type="button" :disabled="isCrudBusy" @click="loadCrudRows">載入</button>
              <button type="button" :disabled="isCrudBusy || !crudRows.length" @click="exportCrudCsv">匯出 CSV</button>
              <button type="button" :disabled="isCrudBusy" @click="crudFileInput?.click()">匯入 CSV</button>
              <input ref="crudFileInput" class="hidden-input" type="file" accept=".csv,text/csv" @change="importCrudCsv" />
            </div>
          </div>

          <form class="crud-form" @submit.prevent="saveCrudRecord">
            <label v-for="field in activeCrudConfig.fields" :key="field.key">
              <span>{{ field.label }}</span>
              <select v-if="field.type === 'boolean'" v-model="crudDraft[field.key]">
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
              <textarea
                v-else-if="field.type === 'json' || field.key === 'content' || field.key === 'note'"
                v-model="crudDraft[field.key]"
                :placeholder="crudPlaceholder(field)"
              />
              <input
                v-else
                v-model="crudDraft[field.key]"
                :type="field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'"
                :placeholder="field.label"
              />
            </label>
            <div class="crud-actions">
              <button type="submit" :disabled="isCrudBusy">{{ editingCrudId ? "更新" : "新增" }}</button>
              <button type="button" :disabled="isCrudBusy" @click="resetCrudDraft">清空</button>
            </div>
          </form>

          <p v-if="crudStatus" class="status-message">{{ crudStatus }}</p>

          <div class="crud-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>??</th>
                  <th v-for="field in activeCrudConfig.fields" :key="field.key">{{ field.label }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in crudRows" :key="String(row.id)">
                  <td>
                    <div class="row-actions">
                      <button type="button" :disabled="isCrudBusy" @click="editCrudRecord(row)">編輯</button>
                      <button type="button" :disabled="isCrudBusy" @click="confirmDeleteCrudRecord(row)">刪除</button>
                    </div>
                  </td>
                  <td v-for="field in activeCrudConfig.fields" :key="field.key">
                    {{ field.type === "json" ? JSON.stringify(row[field.key] || []) : row[field.key] }}
                  </td>
                </tr>
                <tr v-if="!crudRows.length">
                  <td :colspan="activeCrudConfig.fields.length + 1">尚未載入資料，請先載入或新增資料。</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
        <article class="panel wide">
          <div class="section-heading">
            <div>
              <h3>建立 Nhost Table</h3>
              <p class="section-note">產生 public schema 資料表，Track 到 GraphQL，並在空表匯入初始資料。</p>
            </div>
            <div class="button-row">
              <button type="button" @click="copyTableSql">銴ˊ SQL</button>
              <button type="button" @click="downloadTableSql">銝? SQL</button>
              <button type="button" :disabled="isGeneratingTables" @click="generateTables">
                {{ isGeneratingTables ? "??銝?.." : "?? / Track / ?臬" }}
              </button>
            </div>
          </div>
          <div class="schema-grid">
            <article v-for="schema in nhostTableSchemas" :key="schema.name" class="schema-card">
              <strong>{{ schema.label }}</strong>
              <span>public.{{ schema.name }}</span>
            </article>
          </div>
          <p v-if="tableGenerationStatus" class="status-message">{{ tableGenerationStatus }}</p>
          <textarea class="sql-preview" :value="tableSql" readonly spellcheck="false" />
        </article>
      </section>

      <section v-else-if="currentModule === 'about'" class="module-grid">
        <article class="panel wide about-panel">
          <h3>?</h3>
          <p>
            NhostFengBroAI ?舫??犖鞈?撌乩??啁? Nuxt ??迨?撌脫??Nhost-first嚗?
            蝟餌絞?? server proxy ?? Nhost GraphQL嚗??祕??Postgres/Hasura 鞈???
          </p>
          <p>
            ?桀????{{ sourceMessage }}
          </p>
        </article>
      </section>

      <Teleport to="body">
        <div v-if="csvToast" :class="['csv-toast', { error: csvToast.isError }]">
          {{ csvToast.message }}
        </div>
      </Teleport>

      <ConfirmDialog
        v-model="showDeleteConfirm"
        :name="deleteTarget?.name || ''"
        @confirm="confirmDelete"
      />
    </main>
  </div>
</template>
