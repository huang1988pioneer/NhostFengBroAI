<script setup lang="ts">
import {
  AlertCircle,
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
import { deleteRecordById, deleteRecordsByName, insertRecord, updateRecord } from "~/utils/nhostCrud";

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

type PriceCompareResult = {
  sourceUrl: string;
  keyword: string;
  productTitle: string;
  currentPrice: number | null;
  historicalHigh: number | null;
  historicalLow: number | null;
  biggoUrl: string;
  series: Array<{ label: string; value: number }>;
  notice?: string;
};

type PhoneCompareResult = {
  keyword: string;
  productName: string;
  stores: Array<{ source: string; productName: string; productUrl: string; error?: string }>;
  comparison: Array<{
    label: string;
    displayName: string;
    sources: Array<{ source: string; priceLabel: string; numericPrice: number | null; url: string }>;
  }>;
};

type TubeResult = {
  fetchedAt: string;
  channels: Array<{ id: string; label: string; url: string; error?: string; videos: TubeVideo[] }>;
  recentVideos: Array<TubeVideo & { channelLabel: string }>;
};

type TubeVideo = {
  id: string;
  title: string;
  url: string;
  published: string;
  updated: string;
  thumbnail: string;
};

type FinanceToolResult = {
  fetchedAt: string;
  source: string;
  items: Array<{ id: string; name: string; symbol: string; group: string; url: string; lastLabel: string; changeLabel: string; status: string; note: string }>;
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
const sourceMessage = ref("正在載入 Nhost GraphQL...");
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
    label: "訂閱",
    filename: "appwrite-subscription.csv",
    fields: [
      { key: "name", label: "名稱" },
      { key: "site", label: "網站" },
      { key: "price", label: "費用", type: "number" },
      { key: "nextdate", label: "下次日期", type: "date" },
      { key: "note", label: "備註" },
      { key: "account", label: "帳號" },
      { key: "currency", label: "幣別" },
      { key: "continue", label: "續訂", type: "boolean" }
    ]
  },
  {
    table: "food",
    label: "食品",
    filename: "appwrite-food.csv",
    fields: [
      { key: "name", label: "名稱" },
      { key: "amount", label: "數量", type: "number" },
      { key: "todate", label: "保存期限", type: "date" },
      { key: "photo", label: "圖片" },
      { key: "price", label: "費用", type: "number" },
      { key: "shop", label: "商店" }
    ]
  },
  {
    table: "article",
    label: "筆記",
    filename: "appwrite-article.csv",
    fields: [
      { key: "title", label: "標題" },
      { key: "content", label: "內容" },
      { key: "category", label: "分類" },
      { key: "newDate", label: "日期", type: "date" }
    ]
  },
  {
    table: "commonaccount",
    label: "常用帳號",
    filename: "appwrite-commonaccount.csv",
    fields: [
      { key: "name", label: "帳號" },
      { key: "sites", label: "蝡 JSON", type: "json" },
      { key: "note", label: "備註" }
    ]
  },
  {
    table: "image",
    label: "圖片",
    filename: "appwrite-image.csv",
    fields: [
      { key: "name", label: "名稱" },
      { key: "url", label: "URL" },
      { key: "note", label: "備註" }
    ]
  },
  {
    table: "video",
    label: "影片",
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
const mediaPreviewUrls = reactive<Record<string, string>>({});
const mediaPreviewBlobUrls = reactive<Record<string, string>>({});

// ?? Module-level edit state ???????????????????????????????????????????????????
const editingSubId = ref("");
const editingFoodId = ref("");
const editingNoteId = ref("");
const editingBankId = ref("");
const editingRoutineId = ref("");
const editingCommonId = ref("");
const submitting = ref(false);
const mediaPlaybackErrors = ref<Record<string, string>>({});
const priceCompareInput = ref("");
const priceCompareResult = ref<PriceCompareResult | null>(null);
const priceCompareStatus = ref("");
const isPriceCompareLoading = ref(false);
const phoneCompareInput = ref("iPhone 16");
const phoneCompareResult = ref<PhoneCompareResult | null>(null);
const phoneCompareStatus = ref("");
const isPhoneCompareLoading = ref(false);
const tubeResult = ref<TubeResult | null>(null);
const tubeStatus = ref("");
const isTubeLoading = ref(false);
const financeToolResult = ref<FinanceToolResult | null>(null);
const financeToolStatus = ref("");
const isFinanceToolLoading = ref(false);
const hasAutoLoadedPhoneTool = ref(false);
const hasAutoLoadedTubeTool = ref(false);
const hasAutoLoadedFinanceTool = ref(false);

const activeItem = computed(() => findMenuItem(currentModule.value) ?? menuItems[0]);
const activeModuleCount = computed(() => moduleItemCount(currentModule.value));
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
const toolModuleIds = ["tools", "price-compare", "phone-compare", "fengbro-tube", "fengbro-finance"];
const isToolsSurface = computed(() => toolModuleIds.includes(currentModule.value));
const todaySurfaceLabel = computed(() => new Intl.DateTimeFormat("zh-TW", { month: "numeric", day: "numeric", weekday: "long" }).format(new Date()));
const moduleSurfaceCount = computed(() => menuItems.reduce((total, item) => total + 1 + (item.children?.length || 0), 0));
const phoneComparePanels = computed(() => {
  const comparisons = phoneCompareResult.value?.comparison || [];
  return [
    {
      title: "蘋果手機區塊",
      hint: "預設查詢：iPhone 17，每年九月切換新基準。",
      query: "iPhone 17",
      rows: comparisons.filter((item) => /iphone|apple/i.test(`${item.label} ${item.displayName}`))
    },
    {
      title: "三星手機區塊",
      hint: "預設查詢：Samsung 26，三月前用去年末兩碼。",
      query: "Samsung 26",
      rows: comparisons.filter((item) => /samsung|galaxy/i.test(`${item.label} ${item.displayName}`))
    }
  ];
});
const financeHighlight = computed(() => financeToolResult.value?.items.find((item) => item.id === "shiller-pe") || financeToolResult.value?.items[0] || null);
const financeToolGroups = computed(() => {
  const groups = new Map<string, FinanceToolResult["items"]>();
  for (const item of financeToolResult.value?.items || []) {
    if (item.id === financeHighlight.value?.id) continue;
    const list = groups.get(item.group) || [];
    list.push(item);
    groups.set(item.group, list);
  }
  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
});
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

watch(
  () => [currentModule.value, activeMediaItems.value.map((item) => `${mediaItemKey(item)}:${item.url}`).join("|")],
  () => {
    if (currentModule.value === "images") {
      void loadImagePreviews();
    }
  },
  { immediate: true }
);

watch(activeTool, (tool) => {
  if (tool === "phone-compare" && !hasAutoLoadedPhoneTool.value && !isPhoneCompareLoading.value) {
    hasAutoLoadedPhoneTool.value = true;
    void runPhoneCompare();
  }
  if (tool === "fengbro-tube" && !hasAutoLoadedTubeTool.value && !isTubeLoading.value) {
    hasAutoLoadedTubeTool.value = true;
    void runTubeLookup();
  }
  if (tool === "fengbro-finance" && !hasAutoLoadedFinanceTool.value && !isFinanceToolLoading.value) {
    hasAutoLoadedFinanceTool.value = true;
    void runFinanceLookup();
  }
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

function moduleItemCount(id: string): number | null {
  const counts: Record<string, number> = {
    dashboard: subscriptions.value.length + foods.value.length + articles.value.length + commonAccounts.value.length + banks.value.length + routines.value.length + totalMediaCount(),
    subscription: subscriptions.value.length,
    food: foods.value.length,
    notes: articles.value.length,
    common: commonAccounts.value.length,
    images: mediaSeed.value.images.length,
    videos: mediaSeed.value.videos.length,
    music: mediaSeed.value.music.length,
    documents: mediaSeed.value.documents.length,
    podcast: mediaSeed.value.podcasts.length,
    bank: banks.value.length,
    routine: routines.value.length,
    tools: 4,
    "price-compare": priceCompareResult.value ? 1 : articles.value.filter((article) => article.category.includes("價格")).length,
    "phone-compare": phoneCompareResult.value?.comparison.length || 0,
    "fengbro-tube": tubeResult.value?.recentVideos.length || mediaSeed.value.videos.length,
    "fengbro-finance": (financeToolResult.value?.items.length || 0) + financeWatch.value.length
  };

  return Object.prototype.hasOwnProperty.call(counts, id) ? counts[id] : null;
}

function totalMediaCount() {
  return mediaSeed.value.images.length + mediaSeed.value.videos.length + mediaSeed.value.music.length + mediaSeed.value.documents.length + mediaSeed.value.podcasts.length;
}

async function runPriceCompare() {
  if (!priceCompareInput.value.trim()) {
    priceCompareStatus.value = "請輸入商品網址或關鍵字。";
    return;
  }

  isPriceCompareLoading.value = true;
  priceCompareStatus.value = "正在查詢 BigGo 價格...";
  try {
    priceCompareResult.value = await $fetch<PriceCompareResult>("/api/feng-tools/biggo", {
      method: "POST",
      body: { url: priceCompareInput.value.trim() }
    });
    priceCompareStatus.value = priceCompareResult.value.notice || "價格比較完成。";
  } catch (error) {
    priceCompareStatus.value = `價格比較失敗：${formatToolError(error)}`;
  } finally {
    isPriceCompareLoading.value = false;
  }
}

async function runPhoneCompare() {
  if (!phoneCompareInput.value.trim()) {
    phoneCompareStatus.value = "請輸入手機型號。";
    return;
  }

  isPhoneCompareLoading.value = true;
  phoneCompareStatus.value = "正在查詢手機價格...";
  try {
    phoneCompareResult.value = await $fetch<PhoneCompareResult>("/api/feng-tools/landtop", {
      method: "POST",
      body: { keyword: phoneCompareInput.value.trim() }
    });
    phoneCompareStatus.value = phoneCompareResult.value.comparison.length ? "手機比價完成。" : "目前無法自動解析價格，請開啟來源網站查看。";
  } catch (error) {
    phoneCompareStatus.value = `手機比價失敗：${formatToolError(error)}`;
  } finally {
    isPhoneCompareLoading.value = false;
  }
}

async function runTubeLookup() {
  isTubeLoading.value = true;
  tubeStatus.value = "正在讀取 YouTube 頻道...";
  try {
    tubeResult.value = await $fetch<TubeResult>("/api/feng-tools/youtube");
    tubeStatus.value = `已載入 ${tubeResult.value.recentVideos.length} 部近期影片。`;
  } catch (error) {
    tubeStatus.value = `FengBro Tube 載入失敗：${formatToolError(error)}`;
  } finally {
    isTubeLoading.value = false;
  }
}

async function runFinanceLookup() {
  isFinanceToolLoading.value = true;
  financeToolStatus.value = "正在整理金融觀察清單...";
  try {
    financeToolResult.value = await $fetch<FinanceToolResult>("/api/feng-tools/finance");
    financeToolStatus.value = `已載入 ${financeToolResult.value.items.length} 個金融來源。`;
  } catch (error) {
    financeToolStatus.value = `金融資料載入失敗：${formatToolError(error)}`;
  } finally {
    isFinanceToolLoading.value = false;
  }
}

function toolMoney(value: number | null | undefined) {
  return value == null ? "--" : `NT$ ${value.toLocaleString("zh-TW")}`;
}

function formatToolDate(value: string) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

function isBestPhoneSource(sources: Array<{ numericPrice: number | null }>, source: { numericPrice: number | null }) {
  if (source.numericPrice == null) return false;
  const prices = sources.map((item) => item.numericPrice).filter((price): price is number => price != null);
  return prices.length > 0 && source.numericPrice === Math.min(...prices);
}

function formatToolError(error: unknown) {
  if (error && typeof error === "object") {
    const toolError = error as { data?: { statusMessage?: string; message?: string }; statusMessage?: string; message?: string };
    return toolError.data?.statusMessage || toolError.data?.message || toolError.statusMessage || toolError.message || "工具執行失敗";
  }
  return String(error || "工具執行失敗");
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
  const moduleToTable: Record<string, string> = {
    images: "image",
    videos: "video",
    music: "music",
    documents: "commondocument",
    podcast: "podcast"
  };
  return moduleToTable[currentModule.value] || currentModule.value;
}

function activeMediaKey(): keyof typeof mediaSeed.value {
  if (currentModule.value === "podcast") return "podcasts";
  return currentModule.value as keyof typeof mediaSeed.value;
}

async function deleteMediaItem(item: MediaItem) {
  const conn = getNhostConnection();
  const table = activeMediaTable();
  const mediaKey = activeMediaKey();

  if (!conn.graphqlUrl) {
    removeMediaItem(mediaKey, item.name);
    showCsvToast("未設定 Nhost GraphQL URL，已先從畫面移除。");
    return;
  }

  const storageFileId = item.url ? extractNhostStorageFileId(item.url) : "";
  if (storageFileId) {
    await deleteFileFromNhostStorage(storageFileId, conn);
  }

  const result = item.id
    ? await deleteRecordById(conn, table, item.id)
    : await deleteRecordsByName(conn, table, item.name);

  removeMediaItem(mediaKey, item.name);
  clearMediaState(item);
  showCsvToast(result.message + (storageFileId ? "，Storage 檔案已刪除。" : ""));
}

function resolvePlayableMediaUrl(item: MediaItem) {
  if (!item.url) return "";
  
  const key = mediaItemKey(item);
  if (mediaPreviewUrls[key]) return mediaPreviewUrls[key];
  
  if (currentModule.value !== "videos" && currentModule.value !== "music" && currentModule.value !== "podcast") return item.url;

  // 檢查 URL 格式是否完整
  if (!isValidStorageUrl(item.url)) {
    console.warn("媒體 URL 格式不完整:", item.url);
    return ""; // 回傳空字串以觸發錯誤狀態
  }

  const storageFileId = extractNhostStorageFileId(item.url);
  if (!storageFileId) return item.url;

  const params = new URLSearchParams();
  const conn = getNhostConnection();
  if (conn.graphqlUrl) params.set("graphqlUrl", conn.graphqlUrl);
  if (conn.adminSecret) params.set("adminSecret", conn.adminSecret);
  if (conn.authorization) params.set("authorization", conn.authorization);
  return `/api/nhost/file/${encodeURIComponent(storageFileId)}${params.toString() ? `?${params}` : ""}`;
}

function extractNhostStorageFileId(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    const match = url.pathname.match(/\/v1\/files\/([^/?#]+)/);
    return match?.[1] || "";
  } catch {
    return "";
  }
}

async function deleteFileFromNhostStorage(fileId: string, conn: NhostConnection) {
  await $fetch(`/api/nhost/file/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
    body: conn
  });
}

function clearMediaState(item: MediaItem) {
  const key = mediaItemKey(item);
  if (mediaPreviewUrls[key]) delete mediaPreviewUrls[key];

  if (!mediaPlaybackErrors.value[key]) return;
  const next = { ...mediaPlaybackErrors.value };
  delete next[key];
  mediaPlaybackErrors.value = next;
}

function clearMediaPlaybackError(item: MediaItem) {
  const key = mediaItemKey(item);
  if (!mediaPlaybackErrors.value[key]) return;
  const next = { ...mediaPlaybackErrors.value };
  delete next[key];
  mediaPlaybackErrors.value = next;
}

function handleMediaPlaybackError(item: MediaItem) {
  const mediaType = currentModule.value === "videos" ? "影片" : "音訊";
  mediaPlaybackErrors.value = {
    ...mediaPlaybackErrors.value,
    [mediaItemKey(item)]: `${mediaType}無法播放。請確認檔案格式可被瀏覽器播放，且 Nhost Storage 代理可以讀取這個檔案。`
  };
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

function confirmDeleteMediaItem(item: MediaItem) {
  requestDelete(item.name, async () => {
    await deleteMediaItem(item);
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

    if (!quickForm.mediaName) quickForm.mediaName = defaultMediaNameForUpload(result.name || file.name);
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

function defaultMediaNameForUpload(filename: string) {
  return currentModule.value === "documents" ? filename : stripFileExtension(filename);
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

type NhostStorageUploadResponse = {
  id?: string;
  name?: string;
  size?: number;
  fileMetadata?: {
    id?: string;
    name?: string;
    size?: number;
  };
  // 可能的其他欄位格式
  file?: {
    id?: string;
    name?: string;
    size?: number;
  };
  metadata?: {
    id?: string;
    name?: string;
    size?: number;
  };
  // Nhost v2 格式：processedFiles（小寫 p）
  processedFiles?: Array<{
    id?: string;
    name?: string;
    size?: number;
    bucketId?: string;
    mimeType?: string;
    etag?: string;
  }>;
  // 舊版格式：ProcessedFiles（大寫 P）
  ProcessedFiles?: Array<{
    id?: string;
    name?: string;
    size?: number;
  }>;
};

type NhostStorageUploadResult = {
  ok: boolean;
  id?: string;
  name: string;
  size: number;
  url: string;
};

async function uploadFileToNhostStorage(file: File) {
  const conn = getNhostConnection();
  if (!conn.graphqlUrl) {
    throw new Error("請先在設定頁輸入 Nhost GraphQL URL。");
  }

  return await uploadFileDirectlyToNhost(file, conn);
}

async function uploadFileDirectlyToNhost(file: File, conn: NhostConnection): Promise<NhostStorageUploadResult> {
  const form = new FormData();
  const uploadEndpoint = deriveStorageFilesEndpoint(conn.graphqlUrl as string);
  form.append("file[]", file);
  form.append("bucket-id", "default");

  const headers: Record<string, string> = {};
  if (conn.authorization) headers.Authorization = conn.authorization;
  if (conn.adminSecret) headers["x-hasura-admin-secret"] = conn.adminSecret;

  console.log("上傳至 Nhost Storage:", {
    endpoint: uploadEndpoint,
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
    hasAuth: !!conn.authorization,
    hasAdminSecret: !!conn.adminSecret
  });

  try {
    const response = await $fetch<NhostStorageUploadResponse | NhostStorageUploadResponse[]>(uploadEndpoint, {
      method: "POST",
      headers,
      body: form
    });
    
    console.log("上傳成功，收到回應");
    return normalizeStorageUploadResponse(response, uploadEndpoint, file);
  } catch (error: any) {
    console.error("上傳請求失敗:", error);
    
    // 提供更詳細的錯誤訊息
    if (error.data) {
      console.error("錯誤詳情:", error.data);
      throw new Error(`Nhost Storage 上傳失敗：${error.data.message || error.message || "未知錯誤"}`);
    }
    
    throw error;
  }
}

function deriveStorageFilesEndpoint(graphqlUrl: string) {
  const url = new URL(graphqlUrl);
  url.hostname = url.hostname.replace(".graphql.", ".storage.");
  url.pathname = "/v1/files";
  url.search = "";
  return url.toString();
}

function normalizeStorageUploadResponse(response: NhostStorageUploadResponse | NhostStorageUploadResponse[], uploadEndpoint: string, file: File): NhostStorageUploadResult {
  console.log("Nhost Storage 原始回應:", JSON.stringify(response, null, 2));
  
  let uploaded: NhostStorageUploadResponse;
  
  // 處理陣列回應
  if (Array.isArray(response)) {
    uploaded = response[0];
  } else if (response.processedFiles && Array.isArray(response.processedFiles)) {
    // Nhost v2 格式：processedFiles（小寫 p）
    uploaded = response.processedFiles[0];
  } else if (response.ProcessedFiles && Array.isArray(response.ProcessedFiles)) {
    // 舊版格式：ProcessedFiles（大寫 P）
    uploaded = response.ProcessedFiles[0];
  } else {
    uploaded = response;
  }
  
  // 嘗試從多個可能的位置提取檔案 ID
  const fileId = 
    uploaded?.id || 
    uploaded?.fileMetadata?.id || 
    uploaded?.file?.id ||
    uploaded?.metadata?.id;
    
  const fileName = 
    uploaded?.name || 
    uploaded?.fileMetadata?.name || 
    uploaded?.file?.name ||
    uploaded?.metadata?.name ||
    file.name;
    
  const fileSize = 
    uploaded?.size ?? 
    uploaded?.fileMetadata?.size ?? 
    uploaded?.file?.size ??
    uploaded?.metadata?.size ??
    file.size;

  console.log("解析結果:", { 
    isArray: Array.isArray(response),
    hasProcessedFiles: !!(response as any).processedFiles,
    hasProcessedFilesCapital: !!(response as any).ProcessedFiles,
    uploaded,
    fileId, 
    fileName,
    fileSize
  });

  if (!fileId) {
    console.error("Nhost Storage 回應中缺少檔案 ID");
    console.error("完整回應:", response);
    console.error("解析的 uploaded 物件:", uploaded);
    
    // 提供更詳細的錯誤訊息
    const responseStr = JSON.stringify(response).substring(0, 300);
    throw new Error(`Nhost Storage 上傳失敗：回應中缺少檔案 ID。回應內容：${responseStr}`);
  }

  const fullUrl = `${uploadEndpoint}/${fileId}`;
  console.log("建構的完整 URL:", fullUrl);

  return {
    ok: true,
    id: fileId,
    name: fileName,
    size: fileSize,
    url: fullUrl
  };
}

function formatStorageUploadError(error: unknown) {
  if (error && typeof error === "object") {
    const uploadError = error as {
      data?: { statusMessage?: string; message?: string; error?: string; errors?: Array<{ message?: string }> };
      status?: number;
      statusCode?: number;
      statusMessage?: string;
      message?: string;
    };
    const messages = uploadError.data?.errors?.map((item) => item.message).filter(Boolean).join("; ");
    const code = uploadError.statusCode || uploadError.status;
    const detail = messages || uploadError.data?.statusMessage || uploadError.data?.message || uploadError.data?.error || uploadError.statusMessage || uploadError.message || "Nhost Storage 無法上傳";
    return code ? `${detail} (${code})` : detail;
  }

  return String(error || "Nhost Storage 無法上傳");
}

function mediaItemKey(item: MediaItem) {
  return item.id || item.url || item.name;
}

function mediaDisplayUrl(item: MediaItem) {
  return mediaPreviewUrls[mediaItemKey(item)] || item.url;
}

async function fetchMediaPreviewUrl(item: MediaItem, fallbackContentType = "application/octet-stream") {
  const key = mediaItemKey(item);
  if (mediaPreviewUrls[key]) return mediaPreviewUrls[key];

  const result = await fetchMediaPreviewData(item);
  const previewUrl = `data:${result.contentType || fallbackContentType};base64,${result.data}`;
  mediaPreviewUrls[key] = previewUrl;
  return previewUrl;
}

async function fetchMediaPreviewBlobUrl(item: MediaItem, fallbackContentType = "application/octet-stream") {
  const key = mediaItemKey(item);
  if (mediaPreviewBlobUrls[key]) return mediaPreviewBlobUrls[key];

  const result = await fetchMediaPreviewData(item);
  const previewUrl = URL.createObjectURL(base64ToBlob(result.data, result.contentType || fallbackContentType));
  mediaPreviewBlobUrls[key] = previewUrl;
  return previewUrl;
}

async function fetchMediaPreviewData(item: MediaItem) {
  const conn = getNhostConnection();
  return await $fetch<{ ok: boolean; contentType: string; data: string }>("/api/nhost/file", {
    method: "POST",
    body: {
      url: item.url,
      ...conn
    }
  });
}

function guessDocumentType(item: MediaItem, contentType = "") {
  const source = `${item.name} ${item.url} ${item.note}`.toLowerCase();
  const type = contentType.toLowerCase();
  if (type.includes("pdf") || source.includes(".pdf")) return "pdf";
  if (type.includes("json") || source.includes(".json")) return "json";
  if (
    type.includes("presentation") ||
    type.includes("powerpoint") ||
    type.includes("officedocument.presentation") ||
    source.includes(".pptx") ||
    source.includes(".ppt")
  ) {
    return "presentation";
  }
  if (type.startsWith("text/") || source.includes(".txt") || source.includes(".md") || source.includes(".csv")) return "text";
  return "file";
}

function normalizeDocumentContentType(kind: string, contentType: string) {
  if (kind === "pdf") return "application/pdf";
  if (kind === "json") return "application/json";
  if (kind === "presentation") return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  return contentType || "application/octet-stream";
}

function decodeBase64Text(data: string) {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder("utf-8").decode(bytes);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return entities[char] || char;
  });
}

function makeHtmlPreviewUrl(title: string, body: string) {
  return URL.createObjectURL(
    new Blob(
      [
        `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;background:#f5f2ec;color:#1f2a23}main{max-width:1080px;margin:0 auto;padding:32px}pre{white-space:pre-wrap;word-break:break-word;background:#fff;border-radius:16px;padding:24px;box-shadow:0 20px 60px rgba(31,42,35,.12);line-height:1.55}a.button{display:inline-flex;margin:12px 12px 12px 0;padding:12px 18px;border-radius:999px;background:#1f2a23;color:#fff;text-decoration:none;font-weight:800}.muted{color:#69766d}</style></head><body><main>${body}</main></body></html>`
      ],
      { type: "text/html;charset=utf-8" }
    )
  );
}

function makeJsonPreviewUrl(item: MediaItem, data: string) {
  let content = decodeBase64Text(data);
  try {
    content = JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    // Keep original text when the file is JSON-like but not strictly valid JSON.
  }
  return makeHtmlPreviewUrl(item.name || "JSON 預覽", `<h1>${escapeHtml(item.name || "JSON 預覽")}</h1><pre>${escapeHtml(content)}</pre>`);
}

function makeTextPreviewUrl(item: MediaItem, data: string) {
  const content = decodeBase64Text(data);
  return makeHtmlPreviewUrl(item.name || "文字預覽", `<h1>${escapeHtml(item.name || "文字預覽")}</h1><pre>${escapeHtml(content)}</pre>`);
}

function makePresentationPreviewUrl(item: MediaItem, fileUrl: string) {
  const officeUrl = /^https?:\/\//i.test(item.url) ? `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(item.url)}` : "";
  return makeHtmlPreviewUrl(
    item.name || "簡報預覽",
    `<h1>${escapeHtml(item.name || "簡報預覽")}</h1><p class="muted">瀏覽器無法直接渲染 PPT/PPTX。你可以下載檔案，或在檔案為公開連結時嘗試使用 Office Viewer。</p><a class="button" href="${fileUrl}" download="${escapeHtml(item.name || "presentation.pptx")}">下載 PPTX</a>${officeUrl ? `<a class="button" href="${officeUrl}" target="_blank" rel="noreferrer">用 Office Viewer 開啟</a>` : ""}`
  );
}

async function buildDocumentPreviewUrl(item: MediaItem) {
  const key = mediaItemKey(item);
  if (mediaPreviewBlobUrls[key]) return mediaPreviewBlobUrls[key];

  const result = await fetchMediaPreviewData(item);
  const kind = guessDocumentType(item, result.contentType);
  const contentType = normalizeDocumentContentType(kind, result.contentType);
  const fileUrl = URL.createObjectURL(base64ToBlob(result.data, contentType));
  let previewUrl = fileUrl;

  if (kind === "json") {
    previewUrl = makeJsonPreviewUrl(item, result.data);
  } else if (kind === "text") {
    previewUrl = makeTextPreviewUrl(item, result.data);
  } else if (kind === "presentation") {
    previewUrl = makePresentationPreviewUrl(item, fileUrl);
  }

  mediaPreviewBlobUrls[key] = previewUrl;
  return previewUrl;
}

function base64ToBlob(data: string, contentType: string) {
  const binary = atob(data);
  const chunks: Uint8Array[] = [];
  for (let offset = 0; offset < binary.length; offset += 8192) {
    const slice = binary.slice(offset, offset + 8192);
    const bytes = new Uint8Array(slice.length);
    for (let index = 0; index < slice.length; index += 1) {
      bytes[index] = slice.charCodeAt(index);
    }
    chunks.push(bytes);
  }
  return new Blob(chunks, { type: contentType });
}

async function openDocumentPreview(item: MediaItem) {
  if (!import.meta.client || !item.url) return;
  
  // 檢查 URL 格式是否完整
  if (!isValidStorageUrl(item.url)) {
    showCsvToast(`文件 URL 格式不完整，無法開啟：${item.url}`, true);
    return;
  }

  const previewWindow = window.open("", "_blank");
  if (previewWindow) {
    previewWindow.opener = null;
    previewWindow.document.write("<!doctype html><title>文件預覽</title><body style=\"font-family:system-ui;padding:24px\">正在載入文件...</body>");
  }

  try {
    const previewUrl = await buildDocumentPreviewUrl(item);
    if (previewWindow) {
      previewWindow.location.href = previewUrl;
    } else {
      window.open(previewUrl, "_blank", "noopener,noreferrer");
    }
  } catch (error) {
    if (previewWindow) {
      previewWindow.location.href = item.url;
    } else {
      window.open(item.url, "_blank", "noopener,noreferrer");
    }
    showCsvToast(`文件預覽失敗，已改開原始連結：${error instanceof Error ? error.message : "無法載入文件"}`, true);
  }
}

async function loadImagePreviews() {
  if (!import.meta.client) return;
  const imageItems = activeMediaItems.value.filter((item) => item.url);

  await Promise.all(
    imageItems.map(async (item) => {
      const key = mediaItemKey(item);
      if (mediaPreviewUrls[key]) return;

      try {
        // 檢查 URL 格式是否完整（應該包含檔案 ID）
        if (item.url && !isValidStorageUrl(item.url)) {
          console.warn("圖片 URL 格式不完整:", item.url);
          mediaPreviewUrls[key] = ""; // 設為空字串，讓圖片顯示錯誤狀態
          return;
        }

        mediaPreviewUrls[key] = await fetchMediaPreviewUrl(item, "image/*");
      } catch (error) {
        console.error("載入圖片預覽失敗:", item.name, error);
        mediaPreviewUrls[key] = item.url;
      }
    })
  );
}

// 檢查 Storage URL 是否有檔案 ID（完整格式）
function isValidStorageUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    // 完整的 URL 應該是 /v1/files/{fileId} 或更長的路徑
    // 如果只是 /v1/files 或 /v1/files/ 則不完整
    const pathname = urlObj.pathname;
    const hasFileId = pathname.split('/').filter(Boolean).length > 2; // 至少要有 v1, files, {fileId}
    return hasFileId;
  } catch {
    return false;
  }
}

function handleImageLoadError(item: MediaItem) {
  const key = mediaItemKey(item);
  console.error("圖片載入失敗:", item.name, item.url);
  // 標記為載入失敗，以便顯示錯誤訊息
  mediaPreviewUrls[key] = "";
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
            <strong v-if="moduleItemCount(item.id) !== null" class="menu-count">{{ moduleItemCount(item.id) }}</strong>
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
              <strong v-if="moduleItemCount(child.id) !== null" class="menu-count">{{ moduleItemCount(child.id) }}</strong>
            </button>
          </div>
        </template>
      </nav>

      <div class="sidebar-note">
        <WalletCards :size="20" />
        <span>{{ statusLabel }}：{{ sourceMessage }}</span>
      </div>
    </aside>

    <main :class="['workspace', { 'workspace-tools': isToolsSurface }]">
      <header class="topbar">
        <button class="icon-button mobile-only" type="button" aria-label="切換選單" @click="isSidebarOpen = !isSidebarOpen">
          <X v-if="isSidebarOpen" :size="19" />
          <Menu v-else :size="19" />
        </button>
        <template v-if="isToolsSurface">
          <div class="active-surface-bar">
            <div>
              <p>Active Surface</p>
              <strong>{{ activeItem.label }}</strong>
            </div>
            <div class="surface-pills">
              <span><small>Today</small>{{ todaySurfaceLabel }}</span>
              <span><small>Modules</small>{{ moduleSurfaceCount }} 個模組</span>
            </div>
          </div>
        </template>
        <template v-else>
          <div class="page-title">
            <p>Nuxt Workspace</p>
            <h1>
              {{ activeItem.label }}
              <span v-if="activeModuleCount !== null" class="page-count">共 {{ activeModuleCount }} 筆</span>
            </h1>
          </div>
          <label class="search-box">
            <Search :size="18" />
            <input v-model="query" type="search" placeholder="搜尋訂閱、食品、帳號、筆記、銀行、例行" />
            <button v-if="query" class="clear-search" type="button" aria-label="清除搜尋" @click="query = ''">
              <X :size="15" />
            </button>
          </label>
        </template>
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
          <div class="hero-stack" aria-label="資料概況">
            <span>{{ statusLabel }}</span>
            <span>{{ subscriptions.length }} 筆訂閱</span>
            <span>{{ foods.length }} 筆食品</span>
            <span>{{ banks.length }} 筆銀行</span>
          </div>
        </div>

        <div class="stats-grid">
          <article class="stat-card"><CreditCard /><span>續訂訂閱</span><strong>{{ recurringSubscriptions }}</strong></article>
          <article class="stat-card"><CircleDollarSign /><span>TWD 訂閱支出</span><strong>{{ money(totalTwdSubscriptions) }}</strong></article>
          <article class="stat-card"><Utensils /><span>食品庫存數量</span><strong>{{ foodUnits }}</strong></article>
          <article class="stat-card"><Landmark /><span>銀行總存款</span><strong>{{ money(totalBankDeposit) }}</strong></article>
        </div>

        <section class="panel wide">
          <div class="section-heading">
            <h3>近期訂閱</h3>
            <button type="button" @click="navigate('subscription')">前往訂閱</button>
          </div>
          <div class="timeline">
            <article v-for="item in sortedSubscriptions.slice(0, 8)" :key="`${item.name}-${item.nextdate}`">
              <span>{{ daysUntil(item.nextdate) }}</span>
              <strong>{{ item.name }}</strong>
              <small>{{ item.nextdate }} / {{ money(item.price, item.currency) }}</small>
            </article>
          </div>
          <form class="quick-form" @submit.prevent="addCommonAccount">
            <input v-model="quickForm.commonName" placeholder="帳號 / 名稱" />
            <input v-model="quickForm.commonSite" placeholder="網站 / 連結" />
            <input v-model="quickForm.commonNote" placeholder="備註" />
            <button type="submit">新增常用帳號</button>
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
            <h3>新增訂閱</h3>
            <div class="csv-actions">
              <button class="csv-btn export" type="button" @click="exportSubscriptions(subscriptions)"><Download :size="15" />匯出 CSV</button>
              <label class="csv-btn import" :class="{ loading: csvImporting === '訂閱' }">
                <Upload :size="15" />{{ csvImporting === "訂閱" ? "匯入中..." : "匯入 CSV" }}
                <input class="csv-hidden-input" type="file" accept=".csv" @change="importSubCsv" />
              </label>
            </div>
          </div>
          <form class="quick-form" @submit.prevent="addSubscription">
            <input v-model="quickForm.subscriptionName" placeholder="名稱" :class="{ editing: editingSubId }" />
            <input v-model="quickForm.subscriptionDate" type="date" />
            <input v-model.number="quickForm.subscriptionPrice" min="0" type="number" placeholder="費用" />
            <button type="submit" :disabled="submitting">{{ submitting ? "儲存中..." : (editingSubId ? "更新訂閱" : "新增") }}</button>
            <button v-if="editingSubId" type="button" class="cancel-btn" @click="cancelEditSub">取消</button>
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
              <td><a v-if="row.site" :href="row.site" target="_blank">{{ row.name }}</a><span v-else>{{ row.name }}</span><small>{{ row.note }}</small><div class="row-btn-group"><button class="text-action" type="button" @click="startEditSub(row)">編輯</button><button class="text-action danger" type="button" @click="confirmDeleteSubscription(row.name)">刪除</button></div></td>
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
            <h3>新增食品庫存</h3>
            <div class="csv-actions">
              <button class="csv-btn export" type="button" @click="exportFoods(foods)"><Download :size="15" />匯出 CSV</button>
              <label class="csv-btn import" :class="{ loading: csvImporting === '食品' }">
                <Upload :size="15" />{{ csvImporting === "食品" ? "匯入中..." : "匯入 CSV" }}
                <input class="csv-hidden-input" type="file" accept=".csv" @change="importFoodCsv" />
              </label>
            </div>
          </div>
          <form class="quick-form" @submit.prevent="addFood">
            <input v-model="quickForm.foodName" placeholder="名稱" :class="{ editing: editingFoodId }" />
            <input v-model.number="quickForm.foodAmount" min="1" type="number" placeholder="數量" />
            <input v-model="quickForm.foodDate" type="date" />
            <input v-model="quickForm.foodPhoto" placeholder="圖片 URL" />
            <button type="button" class="secondary-btn" :disabled="isFoodPhotoUploading" @click="foodPhotoInput?.click()">
              <Upload :size="15" />{{ isFoodPhotoUploading ? "上傳中..." : "上傳圖片" }}
            </button>
            <input ref="foodPhotoInput" class="hidden-input" type="file" accept="image/*" @change="uploadFoodPhoto" />
            <button type="submit">{{ editingFoodId ? "更新食品" : "新增" }}</button>
            <button v-if="editingFoodId" type="button" class="cancel-btn" @click="cancelEditFood">取消</button>
          </form>
        </section>
        <article v-for="item in filteredFoods" :key="`${item.name}-${item.todate}`" class="media-card">
          <img v-if="item.photo" :src="item.photo" :alt="item.name" loading="lazy" />
          <div v-else class="image-fallback"><Package :size="28" /></div>
          <div>
            <strong>{{ item.name }}</strong>
            <span>數量 {{ item.amount }} / 到期 {{ item.todate }} / {{ daysUntil(item.todate) }}</span>
            <div class="row-btn-group"><button class="text-action" type="button" @click="startEditFood(item)">編輯</button><button class="text-action danger" type="button" @click="confirmDeleteFood(item.name)">刪除</button></div>
          </div>
        </article>
      </section>

      <section v-else-if="currentModule === 'notes'" class="module-grid">
        <section class="panel wide">
          <div class="section-heading">
            <h3>新增筆記</h3>
            <div class="csv-actions">
              <button class="csv-btn export" type="button" @click="exportArticles(articles)"><Download :size="15" />匯出 CSV</button>
              <label class="csv-btn import" :class="{ loading: csvImporting === '筆記' }">
                <Upload :size="15" />{{ csvImporting === "筆記" ? "匯入中..." : "匯入 CSV" }}
                <input class="csv-hidden-input" type="file" accept=".csv" @change="importNoteCsv" />
              </label>
            </div>
          </div>
          <form class="quick-form note-form" @submit.prevent="addNote">
            <input v-model="quickForm.noteTitle" placeholder="標題" :class="{ editing: editingNoteId }" />
            <textarea v-model="quickForm.noteContent" placeholder="內容" />
            <button type="submit">{{ editingNoteId ? "更新筆記" : "新增" }}</button>
            <button v-if="editingNoteId" type="button" class="cancel-btn" @click="cancelEditNote">取消</button>
          </form>
        </section>
        <article v-for="item in filteredArticles" :key="`${item.title}-${item.newDate}`" class="note-card">
          <small>{{ item.category || "未分類" }} / {{ item.newDate }}</small>
          <h3>{{ item.title }}</h3>
          <p>{{ item.content }}</p>
          <div class="row-btn-group"><button class="text-action" type="button" @click="startEditNote(item)">編輯</button><button class="text-action danger" type="button" @click="confirmDeleteArticle(item.title)">刪除</button></div>
        </article>
      </section>

      <section v-else-if="currentModule === 'common'" class="module-grid">
        <section class="panel wide">
          <div class="section-heading">
            <h3>常用帳號</h3>
            <div class="csv-actions">
              <button class="csv-btn export" type="button" @click="exportCommonAccounts(commonAccounts)"><Download :size="15" />匯出 CSV</button>
              <label class="csv-btn import" :class="{ loading: csvImporting === '常用帳號' }">
                <Upload :size="15" />{{ csvImporting === "常用帳號" ? "匯入中..." : "匯入 CSV" }}
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
          <button class="text-action danger" type="button" @click="confirmDeleteCommonAccount(account.name)">刪除</button>
        </article>
      </section>

      <section v-else-if="['images', 'videos', 'music', 'documents', 'podcast'].includes(currentModule)" class="module-grid">
        <section class="panel wide">
          <div class="section-heading"><h3>新增媒體資料</h3></div>
          <form class="quick-form" @submit.prevent="addMediaItem">
            <input v-model="quickForm.mediaName" placeholder="名稱" />
            <input v-model="quickForm.mediaUrl" placeholder="連結 / Storage URL" />
            <input v-model="quickForm.mediaNote" placeholder="備註" />
            <button type="button" class="secondary-btn" :disabled="isMediaUploading" @click="mediaUploadInput?.click()">
              <Upload :size="15" />{{ isMediaUploading ? "上傳中..." : activeMediaUploadLabel }}
            </button>
            <input ref="mediaUploadInput" class="hidden-input" type="file" :accept="activeMediaAccept" @change="uploadMediaFile" />
            <button type="submit">新增</button>
          </form>
        </section>
        <article v-for="item in activeMediaItems" :key="`${item.name}-${item.url}`" class="media-tile">
          <div v-if="currentModule === 'images' && item.url" class="media-preview-wrapper">
            <img 
              v-if="mediaDisplayUrl(item)" 
              class="media-preview" 
              :src="mediaDisplayUrl(item)" 
              :alt="item.name" 
              loading="lazy"
              @error="handleImageLoadError(item)"
            />
            <div v-else class="media-error">
              <AlertCircle :size="32" />
              <p>URL 格式不完整</p>
            </div>
          </div>
          <div v-else-if="currentModule === 'videos' && item.url" class="media-preview-wrapper">
            <video
              v-if="resolvePlayableMediaUrl(item)"
              class="media-preview"
              :src="resolvePlayableMediaUrl(item)"
              controls
              preload="metadata"
              @error="handleMediaPlaybackError(item)"
              @loadedmetadata="clearMediaPlaybackError(item)"
              @canplay="clearMediaPlaybackError(item)"
            />
            <div v-else class="media-error">
              <AlertCircle :size="32" />
              <p>URL 格式不完整</p>
            </div>
          </div>
          <div v-else-if="(currentModule === 'music' || currentModule === 'podcast') && item.url">
            <audio
              v-if="resolvePlayableMediaUrl(item)"
              class="media-audio"
              :src="resolvePlayableMediaUrl(item)"
              controls
              preload="metadata"
              @error="handleMediaPlaybackError(item)"
              @loadedmetadata="clearMediaPlaybackError(item)"
              @canplay="clearMediaPlaybackError(item)"
            />
            <div v-else class="media-error">
              <AlertCircle :size="32" />
              <p>URL 格式不完整</p>
            </div>
          </div>
          <button 
            v-else-if="currentModule === 'documents' && item.url" 
            class="media-file-link" 
            type="button" 
            :disabled="!isValidStorageUrl(item.url)"
            @click="openDocumentPreview(item)"
          >
            <BookOpenText v-if="isValidStorageUrl(item.url)" :size="24" />
            <AlertCircle v-else :size="24" />
            {{ isValidStorageUrl(item.url) ? '開啟文件' : 'URL 格式不完整' }}
          </button>
          <component v-else :is="activeMediaIcon" :size="28" />
          <strong>{{ item.name }}</strong>
          <span>{{ item.note || statusLabel }}</span>
          <span v-if="mediaPlaybackErrors[mediaItemKey(item)]" class="media-error">{{ mediaPlaybackErrors[mediaItemKey(item)] }}</span>
          <button v-if="currentModule === 'documents' && item.url" class="text-action" type="button" @click="openDocumentPreview(item)">預覽</button>
          <a v-else-if="item.url" class="text-action" :href="item.url" target="_blank" rel="noreferrer">開啟</a>
          <button class="text-action danger" type="button" @click="confirmDeleteMediaItem(item)">刪除</button>
        </article>
      </section>

      <section v-else-if="currentModule === 'bank'" class="module-grid">
        <section class="panel wide">
          <div class="section-heading">
            <h3>新增銀行</h3>
            <div class="csv-actions">
              <button class="csv-btn export" type="button" @click="exportBanks(banks)"><Download :size="15" />匯出 CSV</button>
              <label class="csv-btn import" :class="{ loading: csvImporting === '銀行' }">
                <Upload :size="15" />{{ csvImporting === "銀行" ? "匯入中..." : "匯入 CSV" }}
                <input class="csv-hidden-input" type="file" accept=".csv" @change="importBankCsv" />
              </label>
            </div>
          </div>
          <form class="quick-form" @submit.prevent="addBank">
            <input v-model="quickForm.bankName" placeholder="銀行 / 卡片名稱" :class="{ editing: editingBankId }" />
            <input v-model.number="quickForm.bankDeposit" min="0" type="number" placeholder="存款" />
            <input v-model="quickForm.bankAccount" placeholder="帳號" />
            <input v-model="quickForm.bankCard" placeholder="卡片 / 金融卡" />
            <button type="submit">{{ editingBankId ? "更新銀行" : "新增銀行" }}</button>
            <button v-if="editingBankId" type="button" class="cancel-btn" @click="cancelEditBank">取消</button>
          </form>
          <DataTable :rows="filteredBanks" :columns="['名稱', '存款', '提款', '轉帳', '卡片', '帳號']">
            <template #default="{ row }">
              <td><a v-if="row.site" :href="row.site" target="_blank">{{ row.name }}</a><span v-else>{{ row.name }}</span><div class="row-btn-group"><button class="text-action" type="button" @click="startEditBank(row)">編輯</button><button class="text-action danger" type="button" @click="confirmDeleteBank(row.name)">刪除</button></div></td>
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
            <h3>新增例行事項</h3>
            <div class="csv-actions">
              <button class="csv-btn export" type="button" @click="exportRoutines(routines)"><Download :size="15" />匯出 CSV</button>
              <label class="csv-btn import" :class="{ loading: csvImporting === '例行事項' }">
                <Upload :size="15" />{{ csvImporting === "例行事項" ? "匯入中..." : "匯入 CSV" }}
                <input class="csv-hidden-input" type="file" accept=".csv" @change="importRoutineCsv" />
              </label>
            </div>
          </div>
          <form class="quick-form" @submit.prevent="addRoutine">
            <input v-model="quickForm.routineName" placeholder="名稱" :class="{ editing: editingRoutineId }" />
            <input v-model="quickForm.routineDate" type="date" />
            <input v-model="quickForm.routineNote" placeholder="備註" />
            <input v-model="quickForm.routinePhoto" placeholder="圖片 URL" />
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
          <div class="row-btn-group"><button class="text-action" type="button" @click="startEditRoutine(item)">編輯</button><button class="text-action danger" type="button" @click="confirmDeleteRoutine(item.name)">刪除</button></div>
        </article>
      </section>

      <section v-else-if="isToolsSurface" class="module-grid tool-module-grid">
        <section class="tool-console">
          <div class="tool-console-heading">
            <div>
              <p class="panel-kicker">Console View</p>
              <h2>鋒兄工具</h2>
              <p>工具模組集中入口與手機比價工作台。</p>
            </div>
          </div>
          <div class="tabs tool-tabs" role="tablist">
            <button :class="{ active: activeTool === 'price-compare' }" type="button" @click="activeTool = 'price-compare'; currentModule = 'price-compare'">鋒兄比價</button>
            <button :class="{ active: activeTool === 'phone-compare' }" type="button" @click="activeTool = 'phone-compare'; currentModule = 'phone-compare'">手機比價</button>
            <button :class="{ active: activeTool === 'fengbro-tube' }" type="button" @click="activeTool = 'fengbro-tube'; currentModule = 'fengbro-tube'">鋒兄Tube</button>
            <button :class="{ active: activeTool === 'fengbro-finance' }" type="button" @click="activeTool = 'fengbro-finance'; currentModule = 'fengbro-finance'">鋒兄金融</button>
          </div>
        </section>

        <template v-if="activeTool === 'price-compare'">
          <section class="tool-workbench tool-workbench-price">
            <div class="tool-workbench-heading">
              <div class="tool-icon"><Wrench :size="20" /></div>
              <div>
                <h3>鋒兄比價</h3>
                <p class="section-note">輸入商品網址或關鍵字，查詢 BigGo 搜尋價格與價格區間。</p>
              </div>
              <button type="button" :disabled="isPriceCompareLoading" @click="runPriceCompare">{{ isPriceCompareLoading ? "查詢中..." : "查詢" }}</button>
            </div>
            <div class="price-query-box">
              <label>商品網址</label>
              <form class="tool-form" @submit.prevent="runPriceCompare">
                <input v-model="priceCompareInput" placeholder="https://24h.pchome.com.tw/prod/DRAHC0-A900J8363" />
                <button type="submit" :disabled="isPriceCompareLoading"><Search :size="15" />查詢歷史價格</button>
              </form>
              <div class="tool-source-grid">
                <div class="tool-source-card active"><strong>BigGo API</strong><span>查詢 BigGo 歷史價格資料</span></div>
                <div class="tool-source-card"><strong>本地估值</strong><span>保留本地測試流程，不連外查價</span></div>
              </div>
            </div>
            <p v-if="priceCompareStatus" class="status-message">{{ priceCompareStatus }}</p>
          </section>
          <section class="tool-strip">
            <div>
              <strong>最近連結</strong>
              <small>{{ priceCompareResult ? "1 筆" : "等待查詢" }}</small>
            </div>
            <a v-if="priceCompareResult" :href="priceCompareResult.sourceUrl" target="_blank" rel="noreferrer">
              {{ priceCompareResult.productTitle }}
              <span>{{ priceCompareResult.sourceUrl }}</span>
            </a>
            <span v-else>貼上 PChome、momo 或商品頁網址後會保留最近查詢。</span>
          </section>
          <article v-if="priceCompareResult" class="tool-result-card wide-tool-card">
            <div class="result-card-head">
              <div>
                <strong>{{ priceCompareResult.productTitle }}</strong>
                <span>來源：BigGo API / 關鍵字：{{ priceCompareResult.keyword }}</span>
              </div>
              <strong class="price-current">{{ toolMoney(priceCompareResult.currentPrice) }}</strong>
            </div>
            <div class="tool-stat-grid">
              <div><span>目前低價</span><strong>{{ toolMoney(priceCompareResult.currentPrice) }}</strong></div>
              <div><span>區間高點</span><strong>{{ toolMoney(priceCompareResult.historicalHigh) }}</strong></div>
              <div><span>區間低點</span><strong>{{ toolMoney(priceCompareResult.historicalLow) }}</strong></div>
            </div>
            <div class="trend-panel">
              <div class="trend-line" aria-hidden="true">
                <i
                  v-for="(point, index) in priceCompareResult.series"
                  :key="point.label"
                  :style="{ left: `${index * (100 / Math.max(priceCompareResult.series.length - 1, 1))}%` }"
                />
              </div>
              <span v-for="point in priceCompareResult.series" :key="point.label">{{ point.label }} {{ toolMoney(point.value) }}</span>
            </div>
            <a class="text-action" :href="priceCompareResult.biggoUrl" target="_blank" rel="noreferrer">開啟 BigGo</a>
          </article>
          <article v-else class="tool-card"><TrendingUp /><strong>輸入商品即可開始比價</strong><span>支援網址解析與關鍵字搜尋。</span></article>
        </template>
        <template v-else-if="activeTool === 'phone-compare'">
          <section class="tool-workbench tool-workbench-phone">
            <div class="tool-workbench-heading">
              <div class="tool-icon blue"><Boxes :size="20" /></div>
              <div>
                <h3>手機比價</h3>
                <p class="section-note">比對地標網通與傑昇通信，列出可解析的最低價格。</p>
              </div>
              <button type="button" :disabled="isPhoneCompareLoading" @click="runPhoneCompare">{{ isPhoneCompareLoading ? "比對中..." : "比對" }}</button>
            </div>
            <div class="phone-query-grid">
              <article v-for="panel in phoneComparePanels" :key="panel.title" class="phone-query-card">
                <div>
                  <strong>{{ panel.title }}</strong>
                  <span>{{ panel.hint }}</span>
                </div>
                <form class="tool-form" @submit.prevent="runPhoneCompare">
                  <input v-model="phoneCompareInput" :placeholder="panel.query" />
                  <button type="submit" :disabled="isPhoneCompareLoading"><Search :size="15" />搜尋{{ panel.title.includes("三星") ? "三星" : "蘋果" }}</button>
                </form>
              </article>
            </div>
            <p v-if="phoneCompareStatus" class="status-message">{{ phoneCompareStatus }}</p>
          </section>
          <section v-if="phoneCompareResult?.comparison.length" class="landtop-chart">
            <div class="section-heading compact">
              <div>
                <p class="panel-kicker">Landtop Chart</p>
                <h3>地標網通 vs 傑昇通信</h3>
              </div>
              <BarChart3 :size="20" />
            </div>
            <div v-for="item in phoneCompareResult.comparison.slice(0, 4)" :key="`chart-${item.label}`" class="compare-bar-row">
              <strong>{{ item.displayName }}</strong>
              <div v-for="source in item.sources" :key="`${item.label}-${source.source}-bar`" class="compare-bar">
                <span>{{ source.source }}</span>
                <i :style="{ width: source.numericPrice ? `${Math.max(10, 100 - (source.numericPrice / 80000) * 100)}%` : '8%' }" />
                <b>{{ source.priceLabel }}</b>
              </div>
            </div>
          </section>
          <article v-for="item in phoneCompareResult?.comparison || []" :key="item.label" class="tool-result-card">
            <Boxes />
            <strong>{{ item.displayName }}</strong>
            <span>{{ item.label }}</span>
            <div class="source-list">
              <a
                v-for="source in item.sources"
                :key="`${item.label}-${source.source}`"
                :class="['source-row', { best: isBestPhoneSource(item.sources, source) }]"
                :href="source.url"
                target="_blank"
                rel="noreferrer"
              >
                <span>{{ source.source }}</span>
                <strong>{{ source.priceLabel }}</strong>
              </a>
            </div>
          </article>
          <section v-if="phoneCompareResult?.comparison.length" class="weekly-history">
            <div>
              <p class="panel-kicker">Weekly History</p>
              <h3>地標網通歷史價格</h3>
              <span>保留最近 7 天紀錄，價格會依每次查詢更新。</span>
            </div>
            <div class="history-line"><i v-for="n in 9" :key="n" :style="{ left: `${(n - 1) * 12.5}%` }" /></div>
          </section>
          <article v-if="phoneCompareResult && !phoneCompareResult.comparison.length" class="tool-card"><AlertCircle /><strong>暫時沒有可解析價格</strong><span>可開啟來源網站手動查看。</span></article>
        </template>
        <template v-else-if="activeTool === 'fengbro-tube'">
          <section class="tool-workbench tool-workbench-tube">
            <div class="tool-workbench-heading">
              <div class="tool-icon red"><Play :size="20" /></div>
              <div>
                <h3>鋒兄Tube</h3>
                <p class="section-note">讀取鋒兄常用 YouTube 頻道 RSS，集中瀏覽近期影片。</p>
              </div>
              <button type="button" :disabled="isTubeLoading" @click="runTubeLookup">{{ isTubeLoading ? "載入中..." : "重新載入" }}</button>
            </div>
            <p v-if="tubeStatus" class="status-message">{{ tubeStatus }}</p>
          </section>
          <section v-if="tubeResult" class="tube-recent-panel">
            <div class="section-heading compact">
              <h3>3 天內新影片：{{ tubeResult.recentVideos.length }} 部</h3>
              <span>頻道：{{ tubeResult.channels.length }} / 預設 {{ tubeResult.channels.length }}</span>
            </div>
            <a v-for="video in tubeResult.recentVideos.slice(0, 8)" :key="video.id" :href="video.url" target="_blank" rel="noreferrer">
              <strong>{{ video.title }}</strong>
              <span>{{ video.channelLabel }} / {{ formatToolDate(video.published) }}</span>
            </a>
          </section>
          <section v-for="channel in tubeResult?.channels || []" :key="channel.id" class="tube-channel-panel">
            <div class="section-heading compact">
              <div>
                <h3>{{ channel.label }}</h3>
                <a class="text-action" :href="channel.url" target="_blank" rel="noreferrer">開啟頻道</a>
              </div>
              <span>{{ channel.videos.length }} 部影片</span>
            </div>
            <div class="tube-video-grid">
              <article v-for="video in channel.videos.slice(0, 10)" :key="video.id" class="video-tool-card">
                <img v-if="video.thumbnail" :src="video.thumbnail" :alt="video.title" loading="lazy" />
                <div v-else class="image-fallback"><Play :size="24" /></div>
                <strong>{{ video.title }}</strong>
                <span>{{ formatToolDate(video.published) }}</span>
              </article>
            </div>
          </section>
          <article v-if="!tubeResult" class="tool-card"><Play /><strong>載入鋒兄Tube</strong><span>按下重新載入取得近期影片。</span></article>
        </template>
        <template v-else>
          <section class="tool-workbench tool-workbench-finance">
            <div class="tool-workbench-heading">
              <div class="tool-icon green"><CircleDollarSign :size="20" /></div>
              <div>
                <h3>鋒兄金融</h3>
                <p class="section-note">整理常用金融來源，搭配 Nhost 金融追蹤資料一起查看。</p>
              </div>
              <button type="button" :disabled="isFinanceToolLoading" @click="runFinanceLookup">{{ isFinanceToolLoading ? "載入中..." : "載入來源" }}</button>
            </div>
            <p v-if="financeToolStatus" class="status-message">{{ financeToolStatus }}</p>
          </section>
          <section v-if="financeHighlight" class="finance-highlight">
            <div class="tool-icon green"><BarChart3 :size="20" /></div>
            <div>
              <strong>{{ financeHighlight.name }}</strong>
              <span>{{ financeHighlight.note }}</span>
            </div>
            <div class="finance-current">
              <small>Current</small>
              <strong>{{ financeHighlight.lastLabel }}</strong>
              <a :href="financeHighlight.url" target="_blank" rel="noreferrer">{{ financeToolResult?.source || financeHighlight.symbol }}</a>
            </div>
          </section>
          <section v-for="group in financeToolGroups" :key="group.label" class="finance-group">
            <div class="section-heading compact">
              <h3>{{ group.label }}</h3>
              <span>{{ group.items.length }} 項</span>
            </div>
            <div class="finance-card-grid">
              <article v-for="item in group.items" :key="item.id" class="finance-source-card">
                <div>
                  <strong>{{ item.name }}</strong>
                  <span>{{ item.symbol }}</span>
                </div>
                <a :href="item.url" target="_blank" rel="noreferrer">{{ financeToolResult?.source || "來源" }}</a>
                <div class="finance-value">
                  <strong>{{ item.lastLabel }}</strong>
                  <span :class="{ down: item.changeLabel.includes('-') }">{{ item.changeLabel }}</span>
                </div>
                <small>{{ item.note }}</small>
              </article>
            </div>
          </section>
          <section v-if="filteredFinanceWatch.length" class="finance-group">
            <div class="section-heading compact">
              <h3>Nhost 金融追蹤</h3>
              <span>{{ filteredFinanceWatch.length }} 項</span>
            </div>
            <div class="finance-card-grid">
              <article v-for="item in filteredFinanceWatch" :key="`${item.name}-${item.symbol}`" class="finance-source-card">
                <div>
                  <strong>{{ item.name }}</strong>
                  <span>{{ item.symbol }}</span>
                </div>
                <div class="finance-value">
                  <strong>{{ item.value }}</strong>
                  <span>{{ item.note }}</span>
                </div>
              </article>
            </div>
          </section>
          <article v-if="!financeToolResult && !filteredFinanceWatch.length" class="tool-card"><CircleDollarSign /><strong>載入鋒兄金融</strong><span>按下重新整理取得金融觀察來源。</span></article>
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
                  placeholder="請輸入 Hasura Admin Secret"
                />
                <button type="button" @click="isSecretVisible = !isSecretVisible">
                  {{ isSecretVisible ? "隱藏" : "顯示" }}
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
                  <th>操作</th>
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
              <button type="button" @click="downloadTableSql">下載 SQL</button>
              <button type="button" :disabled="isGeneratingTables" @click="generateTables">
                {{ isGeneratingTables ? "建立中..." : "建立 / Track / 匯入" }}
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
          <h3>關於</h3>
          <p>
            NhostFengBroAI 是鋒兄資料工作台，使用 Nuxt 建立並以 Nhost-first 方式讀寫資料。
            系統透過 server proxy 連接 Nhost GraphQL，管理 Postgres/Hasura 資料。
          </p>
          <p>
            目前資料來源：{{ sourceMessage }}
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
