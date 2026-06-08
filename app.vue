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
import { fallbackDataset, type Article, type Bank, type Food, type Routine, type Subscription } from "~/data/fengbro";
import { fetchNhostDataset, type NhostConnection } from "~/utils/nhostData";
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
  noteTitle: string;
  noteContent: string;
  routineName: string;
  routineDate: string;
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
const dataSource = ref<"loading" | "nhost" | "fallback">("loading");
const sourceMessage = ref("正在連線 Nhost GraphQL...");
const loadedTables = ref<string[]>([]);
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

const subscriptions = ref<Subscription[]>(structuredClone(fallbackDataset.subscriptions));
const foods = ref<Food[]>(structuredClone(fallbackDataset.foods));
const articles = ref<Article[]>(structuredClone(fallbackDataset.articles));
const banks = ref<Bank[]>(structuredClone(fallbackDataset.banks));
const routines = ref<Routine[]>(structuredClone(fallbackDataset.routines));
const commonAccounts = ref(structuredClone(fallbackDataset.commonAccounts));
const mediaSeed = ref(structuredClone(fallbackDataset.mediaSeed));
const financeWatch = ref(structuredClone(fallbackDataset.financeWatch));

const csvToast = ref<{ message: string; isError: boolean } | null>(null);
let csvToastTimer: ReturnType<typeof setTimeout> | null = null;
const csvImporting = ref("");

const quickForm = reactive<QuickForm>({
  subscriptionName: "",
  subscriptionDate: "",
  subscriptionPrice: 0,
  foodName: "",
  foodAmount: 1,
  foodDate: "",
  noteTitle: "",
  noteContent: "",
  routineName: "",
  routineDate: ""
});

const activeItem = computed(() => findMenuItem(currentModule.value) ?? menuItems[0]);
const recurringSubscriptions = computed(() => subscriptions.value.filter((item) => item.continue).length);
const totalTwdSubscriptions = computed(() => subscriptions.value.filter((item) => item.currency === "TWD").reduce((sum, item) => sum + item.price, 0));
const totalUsdSubscriptions = computed(() => subscriptions.value.filter((item) => item.currency === "USD").reduce((sum, item) => sum + item.price, 0));
const totalBankDeposit = computed(() => banks.value.reduce((sum, item) => sum + item.deposit, 0));
const foodUnits = computed(() => foods.value.reduce((sum, item) => sum + item.amount, 0));
const latestArticles = computed(() => [...articles.value].sort((a, b) => b.newDate.localeCompare(a.newDate)).slice(0, 5));
const filteredSubscriptions = computed(() => filterRows(subscriptions.value, query.value));
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
const statusLabel = computed(() => {
  if (dataSource.value === "nhost") return "Nhost 實際資料";
  if (dataSource.value === "loading") return "連線中";
  return "本地備援資料";
});

onMounted(() => {
  loadStoredNhostSettings();
  loadNhostData();
});

async function loadNhostData() {
  dataSource.value = "loading";
  sourceMessage.value = "正在連線 Nhost GraphQL...";

  try {
    const { dataset, loadedKeys } = await fetchNhostDataset(fallbackDataset, getNhostConnection());
    subscriptions.value = dataset.subscriptions;
    foods.value = dataset.foods;
    articles.value = dataset.articles;
    banks.value = dataset.banks;
    routines.value = dataset.routines;
    commonAccounts.value = dataset.commonAccounts;
    mediaSeed.value = dataset.mediaSeed;
    financeWatch.value = dataset.financeWatch;
    loadedTables.value = loadedKeys.map(String);
    dataSource.value = loadedKeys.length ? "nhost" : "fallback";
    sourceMessage.value = loadedKeys.length
      ? `已從 Nhost 載入 ${loadedKeys.length} 組資料：${loadedKeys.join(", ")}`
      : "Nhost 已連線，但沒有找到相符資料表，暫用本地備援資料。";
  } catch (error) {
    dataSource.value = "fallback";
    sourceMessage.value = error instanceof Error ? error.message : "Nhost 連線失敗，暫用本地備援資料。";
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
  const graphqlUrl = nhostSettings.graphqlUrl.trim();
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
  settingsStatus.value = "已儲存 Nhost API 資訊到此瀏覽器。";
}

function clearNhostSettings() {
  if (import.meta.client) {
    localStorage.removeItem(nhostSettingsStorageKey);
  }

  nhostSettings.graphqlUrl = "";
  nhostSettings.adminSecret = "";
  nhostSettings.authorization = "";
  settingsStatus.value = "已清除瀏覽器中的 Nhost API 資訊。";
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
      ? `連線成功：${result.queryType} 可讀取，找到 ${result.rootFields} 個 root fields${result.sampleFields.length ? `（${result.sampleFields.join(", ")}）` : ""}。`
      : `連線失敗：${result.error || "未確認成功"}${result.hint ? `。${result.hint}` : ""}`;
  } catch (error) {
    connectionTestOk.value = false;
    connectionTestStatus.value =
      error instanceof Error ? `連線失敗：${error.message}` : "連線失敗：Nhost 測試 API 沒有回傳可辨識結果。";
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

function money(amount: number, currency = "TWD") {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "TWD" ? 0 : 2
  }).format(amount);
}

function addSubscription() {
  if (!quickForm.subscriptionName || !quickForm.subscriptionDate) return;
  subscriptions.value.unshift({
    name: quickForm.subscriptionName,
    site: "",
    price: Number(quickForm.subscriptionPrice || 0),
    nextdate: quickForm.subscriptionDate,
    note: "畫面暫存，尚未寫回 Nhost",
    account: "",
    currency: "TWD",
    continue: true
  });
  quickForm.subscriptionName = "";
  quickForm.subscriptionDate = "";
  quickForm.subscriptionPrice = 0;
}

function addFood() {
  if (!quickForm.foodName || !quickForm.foodDate) return;
  foods.value.unshift({
    name: quickForm.foodName,
    amount: Number(quickForm.foodAmount || 1),
    todate: quickForm.foodDate,
    photo: "",
    price: 0,
    shop: "畫面暫存，尚未寫回 Nhost"
  });
  quickForm.foodName = "";
  quickForm.foodDate = "";
  quickForm.foodAmount = 1;
}

function addNote() {
  if (!quickForm.noteTitle || !quickForm.noteContent) return;
  articles.value.unshift({
    title: quickForm.noteTitle,
    content: quickForm.noteContent,
    category: "筆記",
    newDate: new Date().toISOString().slice(0, 10)
  });
  quickForm.noteTitle = "";
  quickForm.noteContent = "";
}

function addRoutine() {
  if (!quickForm.routineName || !quickForm.routineDate) return;
  routines.value.unshift({
    name: quickForm.routineName,
    note: "畫面暫存，尚未寫回 Nhost",
    lastdate1: quickForm.routineDate,
    lastdate2: "",
    lastdate3: "",
    link: "",
    photo: ""
  });
  quickForm.routineName = "";
  quickForm.routineDate = "";
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
  apply: (items: unknown[]) => void
) {
  const input = event.target as HTMLInputElement;
  if (!input?.files?.length) return;
  csvImporting.value = label;
  showCsvToast(`正在匯入${label} CSV...`);
  const file = input.files[0];
  try {
    const text = await readFileAsText(file);
    const items = importFn(text);
    if (!items.length) {
      showCsvToast(`CSV 中無有效資料列`, true);
      return;
    }
    apply(items);
    showCsvToast(`✓ 已匯入 ${items.length} 筆${label}資料（${file.name}）`);
  } catch (err) {
    showCsvToast(`✗ 匯入失敗：${err instanceof Error ? err.message : "未知錯誤"}`, true);
  } finally {
    csvImporting.value = "";
    input.value = "";
  }
}

const importSubCsv   = (e: Event) => doImport(e, "訂閱",    importSubscriptions,  (v) => { subscriptions.value  = v as Subscription[]; });
const importFoodCsv  = (e: Event) => doImport(e, "食品",    importFoods,          (v) => { foods.value         = v as Food[]; });
const importNoteCsv  = (e: Event) => doImport(e, "筆記",    importArticles,       (v) => { articles.value      = v as Article[]; });
const importCommonCsv= (e: Event) => doImport(e, "常用帳號",  importCommonAccounts, (v) => { commonAccounts.value= v as CommonAccount[]; });
const importBankCsv  = (e: Event) => doImport(e, "銀行",    importBanks,          (v) => { banks.value         = v as Bank[]; });
const importRoutineCsv=(e: Event) => doImport(e, "例行事項",  importRoutines,       (v) => { routines.value      = v as Routine[]; });

async function copyTableSql() {
  tableGenerationStatus.value = "";

  try {
    await navigator.clipboard.writeText(tableSql);
    tableGenerationStatus.value = "已複製建表 SQL，可以貼到 Nhost SQL Editor。";
  } catch {
    tableGenerationStatus.value = "瀏覽器不允許自動複製，請手動選取 SQL。";
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
      ? `已建立/確認 ${result.tables} 張資料表，Track ${result.tracked ?? 0} 張，略過已 Track ${result.trackSkipped ?? 0} 張，並已在空表匯入初始資料。`
      : "建表 API 已回應，但沒有確認成功。";
    await loadNhostData();
  } catch (error) {
    tableGenerationStatus.value =
      error instanceof Error
        ? `無法一鍵建表：${error.message}。可先複製 SQL 到 Nhost SQL Editor 執行。`
        : "無法一鍵建表，可先複製 SQL 到 Nhost SQL Editor 執行。";
  } finally {
    isGeneratingTables.value = false;
  }
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
        <span>{{ statusLabel }}：{{ sourceMessage }}</span>
      </div>
    </aside>

    <main class="workspace">
      <header class="topbar">
        <button class="icon-button mobile-only" type="button" aria-label="切換選單" @click="isSidebarOpen = !isSidebarOpen">
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
          <button v-if="query" class="clear-search" type="button" aria-label="清除搜尋" @click="query = ''">
            <X :size="15" />
          </button>
        </label>
      </header>

      <section v-if="currentModule === 'home' || currentModule === 'dashboard'" class="module-grid">
        <div class="hero-panel">
          <div>
            <p class="panel-kicker">FengBro Console</p>
            <h2>鋒兄的個人資料中控台</h2>
            <p>
              目前優先讀取 Nhost GraphQL 實際資料，包含訂閱、食品庫存、筆記、銀行、例行事項、媒體與金融追蹤。
              若 Nhost 尚未設定或 schema 不相符，系統會清楚標示並暫用本地備援資料。
            </p>
          </div>
          <div class="hero-stack" aria-label="資料摘要">
            <span>{{ statusLabel }}</span>
            <span>{{ subscriptions.length }} 筆訂閱</span>
            <span>{{ foods.length }} 筆食品庫存</span>
            <span>{{ banks.length }} 筆銀行資料</span>
          </div>
        </div>

        <div class="stats-grid">
          <article class="stat-card"><CreditCard /><span>持續訂閱</span><strong>{{ recurringSubscriptions }}</strong></article>
          <article class="stat-card"><CircleDollarSign /><span>TWD 訂閱支出</span><strong>{{ money(totalTwdSubscriptions) }}</strong></article>
          <article class="stat-card"><Utensils /><span>食品庫存數量</span><strong>{{ foodUnits }}</strong></article>
          <article class="stat-card"><Landmark /><span>銀行總餘額</span><strong>{{ money(totalBankDeposit) }}</strong></article>
        </div>

        <section class="panel wide">
          <div class="section-heading">
            <h3>近期訂閱</h3>
            <button type="button" @click="navigate('subscription')">查看訂閱</button>
          </div>
          <div class="timeline">
            <article v-for="item in subscriptions.slice(0, 8)" :key="`${item.name}-${item.nextdate}`">
              <span>{{ daysUntil(item.nextdate) }}</span>
              <strong>{{ item.name }}</strong>
              <small>{{ item.nextdate }} / {{ money(item.price, item.currency) }}</small>
            </article>
          </div>
        </section>

        <section class="panel">
          <div class="section-heading">
            <h3>最新筆記</h3>
            <button type="button" @click="navigate('notes')">查看</button>
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
                <Upload :size="15" />{{ csvImporting === '訂閱' ? '匯入中...' : '匯入 CSV' }}
                <input class="csv-hidden-input" type="file" accept=".csv" @change="importSubCsv" />
              </label>
            </div>
          </div>
          <form class="quick-form" @submit.prevent="addSubscription">
            <input v-model="quickForm.subscriptionName" placeholder="名稱" />
            <input v-model="quickForm.subscriptionDate" type="date" />
            <input v-model.number="quickForm.subscriptionPrice" min="0" type="number" placeholder="價格" />
            <button type="submit">新增</button>
          </form>
        </section>
        <section class="panel wide">
          <DataTable :rows="filteredSubscriptions" :columns="['名稱', '價格', '幣別', '下次日期', '帳號', '狀態']">
            <template #default="{ row }">
              <td><a v-if="row.site" :href="row.site" target="_blank">{{ row.name }}</a><span v-else>{{ row.name }}</span><small>{{ row.note }}</small></td>
              <td>{{ money(row.price, row.currency) }}</td>
              <td>{{ row.currency }}</td>
              <td>{{ row.nextdate }}<small>{{ daysUntil(row.nextdate) }}</small></td>
              <td>{{ row.account || "未設定" }}</td>
              <td><span :class="['pill', row.continue ? 'good' : 'muted']">{{ row.continue ? "持續" : "停止" }}</span></td>
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
                <Upload :size="15" />{{ csvImporting === '食品' ? '匯入中...' : '匯入 CSV' }}
                <input class="csv-hidden-input" type="file" accept=".csv" @change="importFoodCsv" />
              </label>
            </div>
          </div>
          <form class="quick-form" @submit.prevent="addFood">
            <input v-model="quickForm.foodName" placeholder="品名" />
            <input v-model.number="quickForm.foodAmount" min="1" type="number" placeholder="數量" />
            <input v-model="quickForm.foodDate" type="date" />
            <button type="submit">新增</button>
          </form>
        </section>
        <article v-for="item in filteredFoods" :key="`${item.name}-${item.todate}`" class="media-card">
          <img v-if="item.photo" :src="item.photo" :alt="item.name" loading="lazy" />
          <div v-else class="image-fallback"><Package :size="28" /></div>
          <div>
            <strong>{{ item.name }}</strong>
            <span>數量 {{ item.amount }} / 到期 {{ item.todate }} / {{ daysUntil(item.todate) }}</span>
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
                <Upload :size="15" />{{ csvImporting === '筆記' ? '匯入中...' : '匯入 CSV' }}
                <input class="csv-hidden-input" type="file" accept=".csv" @change="importNoteCsv" />
              </label>
            </div>
          </div>
          <form class="quick-form note-form" @submit.prevent="addNote">
            <input v-model="quickForm.noteTitle" placeholder="標題" />
            <textarea v-model="quickForm.noteContent" placeholder="內容" />
            <button type="submit">新增</button>
          </form>
        </section>
        <article v-for="item in filteredArticles" :key="`${item.title}-${item.newDate}`" class="note-card">
          <small>{{ item.category || "未分類" }} / {{ item.newDate }}</small>
          <h3>{{ item.title }}</h3>
          <p>{{ item.content }}</p>
        </article>
      </section>

      <section v-else-if="currentModule === 'common'" class="module-grid">
        <section class="panel wide">
          <div class="section-heading">
            <h3>常用帳號</h3>
            <div class="csv-actions">
              <button class="csv-btn export" type="button" @click="exportCommonAccounts(commonAccounts)"><Download :size="15" />匯出 CSV</button>
              <label class="csv-btn import" :class="{ loading: csvImporting === '常用帳號' }">
                <Upload :size="15" />{{ csvImporting === '常用帳號' ? '匯入中...' : '匯入 CSV' }}
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
        </article>
      </section>

      <section v-else-if="['images', 'videos', 'music', 'documents', 'podcast'].includes(currentModule)" class="module-grid">
        <article v-for="item in activeMediaItems" :key="item" class="media-tile">
          <component :is="activeMediaIcon" :size="28" />
          <strong>{{ item }}</strong>
          <span>資料來源：{{ statusLabel }}</span>
        </article>
      </section>

      <section v-else-if="currentModule === 'bank'" class="module-grid">
        <section class="panel wide">
          <div class="section-heading">
            <h3>銀行帳戶</h3>
            <div class="csv-actions">
              <button class="csv-btn export" type="button" @click="exportBanks(banks)"><Download :size="15" />匯出 CSV</button>
              <label class="csv-btn import" :class="{ loading: csvImporting === '銀行' }">
                <Upload :size="15" />{{ csvImporting === '銀行' ? '匯入中...' : '匯入 CSV' }}
                <input class="csv-hidden-input" type="file" accept=".csv" @change="importBankCsv" />
              </label>
            </div>
          </div>
          <DataTable :rows="filteredBanks" :columns="['名稱', '餘額', '提款', '轉帳', '卡片', '帳號']">
            <template #default="{ row }">
              <td><a v-if="row.site" :href="row.site" target="_blank">{{ row.name }}</a><span v-else>{{ row.name }}</span></td>
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
                <Upload :size="15" />{{ csvImporting === '例行事項' ? '匯入中...' : '匯入 CSV' }}
                <input class="csv-hidden-input" type="file" accept=".csv" @change="importRoutineCsv" />
              </label>
            </div>
          </div>
          <form class="quick-form" @submit.prevent="addRoutine">
            <input v-model="quickForm.routineName" placeholder="名稱" />
            <input v-model="quickForm.routineDate" type="date" />
            <button type="submit">新增</button>
          </form>
        </section>
        <article v-for="item in filteredRoutines" :key="`${item.name}-${item.lastdate1}`" class="routine-card">
          <div>
            <strong>{{ item.name }}</strong>
            <small>{{ item.lastdate1 || "未記錄" }}</small>
          </div>
          <p>{{ item.note || "沒有備註" }}</p>
          <a v-if="item.link" :href="item.link" target="_blank">開啟連結</a>
        </article>
      </section>

      <section v-else-if="['tools', 'price-compare', 'phone-compare', 'fengbro-tube', 'fengbro-finance'].includes(currentModule)" class="module-grid">
        <section class="panel wide">
          <div class="tabs" role="tablist">
            <button :class="{ active: activeTool === 'price-compare' }" type="button" @click="activeTool = 'price-compare'; currentModule = 'price-compare'">價格比較</button>
            <button :class="{ active: activeTool === 'phone-compare' }" type="button" @click="activeTool = 'phone-compare'; currentModule = 'phone-compare'">手機比較</button>
            <button :class="{ active: activeTool === 'fengbro-tube' }" type="button" @click="activeTool = 'fengbro-tube'; currentModule = 'fengbro-tube'">FengBro Tube</button>
            <button :class="{ active: activeTool === 'fengbro-finance' }" type="button" @click="activeTool = 'fengbro-finance'; currentModule = 'fengbro-finance'">金融追蹤</button>
          </div>
        </section>

        <template v-if="activeTool === 'price-compare'">
          <article v-for="item in articles.filter((article) => article.category.includes('價格'))" :key="item.title" class="note-card">
            <small>{{ item.newDate }}</small>
            <h3>{{ item.title }}</h3>
            <p>{{ item.content }}</p>
          </article>
        </template>
        <template v-else-if="activeTool === 'phone-compare'">
          <article class="tool-card"><Boxes /><strong>手機比較</strong><span>可從 Nhost 新增獨立 table 後映射進來。</span></article>
        </template>
        <template v-else-if="activeTool === 'fengbro-tube'">
          <article v-for="item in mediaSeed.videos" :key="item" class="tool-card"><Play /><strong>{{ item }}</strong><span>資料來源：{{ statusLabel }}</span></article>
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
                {{ isTestingConnection ? "測試中" : "測試連線" }}
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
                  placeholder="用於生成 Table 或讀取受保護資料"
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
            <p class="settings-hint">Admin Secret 會一律儲存在目前瀏覽器；按「清除」可移除本機儲存的 API 資訊。</p>
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
          <h3>資料來源設定</h3>
          <div class="settings-list">
            <label><input type="checkbox" :checked="dataSource === 'nhost'" disabled /> 使用 Nhost GraphQL 實際資料</label>
            <label><input type="checkbox" :checked="Boolean(loadedTables.length)" disabled /> 已匹配資料表：{{ loadedTables.join(", ") || "尚未匹配" }}</label>
            <label><input type="checkbox" :checked="dataSource === 'fallback'" disabled /> 本地備援資料</label>
            <label><input type="checkbox" disabled /> 新增表單目前只做前端暫存，尚未寫回 Nhost mutation</label>
          </div>
        </article>
        <article class="panel wide">
          <div class="section-heading">
            <div>
              <h3>生成 Nhost Table</h3>
              <p class="section-note">產生 public schema 資料表、Track 到 GraphQL，並在空表匯入初始資料。</p>
            </div>
            <div class="button-row">
              <button type="button" @click="copyTableSql">複製 SQL</button>
              <button type="button" @click="downloadTableSql">下載 SQL</button>
              <button type="button" :disabled="isGeneratingTables" @click="generateTables">
                {{ isGeneratingTables ? "生成中..." : "生成 / Track / 匯入" }}
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
            NhostFengBroAI 是鋒兄個人資料工作台的 Nuxt 版本。此版本已改為 Nhost-first：
            系統會透過 server proxy 連到 Nhost GraphQL，讀取實際 Postgres/Hasura 資料。
          </p>
          <p>
            目前狀態：{{ sourceMessage }}
          </p>
        </article>
      </section>

      <Teleport to="body">
        <div v-if="csvToast" :class="['csv-toast', { error: csvToast.isError }]">
          {{ csvToast.message }}
        </div>
      </Teleport>
    </main>
  </div>
</template>
