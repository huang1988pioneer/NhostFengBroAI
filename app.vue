<script setup lang="ts">
import {
  BarChart3,
  BookOpenText,
  Boxes,
  CalendarClock,
  Camera,
  CircleDollarSign,
  CreditCard,
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
  Utensils,
  WalletCards,
  Wrench,
  X
} from "@lucide/vue";
import type { Component } from "vue";
import {
  articles as articleSeed,
  banks as bankSeed,
  commonAccounts,
  financeWatch,
  foods as foodSeed,
  mediaSeed,
  routines as routineSeed,
  subscriptions as subscriptionSeed,
  type Article,
  type Food,
  type Routine,
  type Subscription
} from "~/data/fengbro";

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
  { id: "home", label: "鋒兄首頁", icon: Home },
  { id: "dashboard", label: "鋒兄儀表", icon: BarChart3 },
  { id: "subscription", label: "鋒兄訂閱", icon: CreditCard },
  { id: "food", label: "鋒兄食品", subtitle: "＋商品庫存", icon: Package },
  { id: "notes", label: "鋒兄筆記", icon: FileText },
  { id: "common", label: "鋒兄常用", icon: Star },
  { id: "images", label: "鋒兄圖片", icon: Image },
  { id: "videos", label: "鋒兄影片", icon: Play },
  { id: "music", label: "鋒兄音樂", icon: Music },
  { id: "documents", label: "鋒兄文件", icon: FolderOpen },
  { id: "podcast", label: "鋒兄播客", icon: FileAudio },
  { id: "bank", label: "鋒兄銀行", subtitle: "+電子票證", icon: Landmark },
  { id: "routine", label: "鋒兄例行", icon: CalendarClock },
  {
    id: "tools",
    label: "鋒兄工具",
    icon: Wrench,
    children: [
      { id: "price-compare", label: "鋒兄比價", icon: TrendingUp },
      { id: "phone-compare", label: "手機比價", icon: Boxes },
      { id: "fengbro-tube", label: "鋒兄Tube", icon: Play },
      { id: "fengbro-finance", label: "鋒兄金融", icon: CircleDollarSign }
    ]
  },
  { id: "settings", label: "鋒兄設定", icon: Settings },
  { id: "about", label: "鋒兄關於", icon: Info }
];

const currentModule = ref("home");
const isSidebarOpen = ref(false);
const expandedMenus = ref<string[]>(["tools"]);
const query = ref("");
const subscriptions = ref<Subscription[]>(structuredClone(subscriptionSeed));
const foods = ref<Food[]>(structuredClone(foodSeed));
const articles = ref<Article[]>(structuredClone(articleSeed));
const routines = ref<Routine[]>(structuredClone(routineSeed));
const activeTool = ref("price-compare");
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
const totalBankDeposit = computed(() => bankSeed.reduce((sum, item) => sum + item.deposit, 0));
const foodUnits = computed(() => foods.value.reduce((sum, item) => sum + item.amount, 0));
const latestArticles = computed(() => [...articles.value].sort((a, b) => b.newDate.localeCompare(a.newDate)).slice(0, 5));
const filteredSubscriptions = computed(() => filterRows(subscriptions.value, query.value));
const filteredFoods = computed(() => filterRows(foods.value, query.value));
const filteredArticles = computed(() => filterRows(articles.value, query.value));
const filteredRoutines = computed(() => filterRows(routines.value, query.value));
const filteredBanks = computed(() => filterRows(bankSeed, query.value));
const filteredAccounts = computed(() => filterRows(commonAccounts, query.value));
const activeMediaItems = computed(() => {
  const key = currentModule.value === "podcast" ? "podcasts" : currentModule.value;
  if (key === "images" || key === "videos" || key === "music" || key === "documents" || key === "podcasts") {
    return mediaSeed[key];
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
    currentModule.value = id;
  } else {
    currentModule.value = id;
  }
  isSidebarOpen.value = false;
}

function filterRows<T>(rows: T[], keyword: string): T[] {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) return rows;
  return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(normalized));
}

function daysUntil(date: string) {
  if (!date) return "-";
  const today = new Date("2026-06-07T00:00:00+08:00");
  const target = new Date(`${date}T00:00:00+08:00`);
  const diff = Math.ceil((target.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return `逾期 ${Math.abs(diff)} 天`;
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
    note: "Nuxt 本地新增",
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
    shop: "Nuxt 本地新增"
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
    category: "Nuxt",
    newDate: new Date().toISOString().slice(0, 10)
  });
  quickForm.noteTitle = "";
  quickForm.noteContent = "";
}

function addRoutine() {
  if (!quickForm.routineName || !quickForm.routineDate) return;
  routines.value.unshift({
    name: quickForm.routineName,
    note: "Nuxt 本地新增",
    lastdate1: quickForm.routineDate,
    lastdate2: "",
    lastdate3: "",
    link: "",
    photo: ""
  });
  quickForm.routineName = "";
  quickForm.routineDate = "";
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
          <strong>鋒兄工作台</strong>
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
        <span>Nuxt seed data mode，後端可接 Nhost Auth、Postgres、Storage。</span>
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
            <h2>鋒兄資料、媒體、金融、例行一次整理</h2>
            <p>
              參考 Appwrite 版本的功能分區，以 Nuxt 重建成可互動前端。
              目前用 CSV seed data 呈現，保留未來接 Nhost 的資料邊界。
            </p>
          </div>
          <div class="hero-stack" aria-label="資料概覽">
            <span>{{ subscriptions.length }} 筆訂閱</span>
            <span>{{ foods.length }} 種食品庫存</span>
            <span>{{ commonAccounts.length }} 組常用帳號</span>
            <span>{{ bankSeed.length }} 個銀行/電子票證</span>
          </div>
        </div>

        <div class="stats-grid">
          <article class="stat-card"><CreditCard /><span>持續訂閱</span><strong>{{ recurringSubscriptions }}</strong></article>
          <article class="stat-card"><CircleDollarSign /><span>TWD 月費/費用</span><strong>{{ money(totalTwdSubscriptions) }}</strong></article>
          <article class="stat-card"><Utensils /><span>食品庫存數</span><strong>{{ foodUnits }}</strong></article>
          <article class="stat-card"><Landmark /><span>銀行+票證餘額</span><strong>{{ money(totalBankDeposit) }}</strong></article>
        </div>

        <section class="panel wide">
          <div class="section-heading">
            <h3>近期提醒</h3>
            <button type="button" @click="navigate('subscription')">前往訂閱</button>
          </div>
          <div class="timeline">
            <article v-for="item in subscriptions.slice(0, 8)" :key="item.name">
              <span>{{ daysUntil(item.nextdate) }}</span>
              <strong>{{ item.name }}</strong>
              <small>{{ item.nextdate }} · {{ money(item.price, item.currency) }}</small>
            </article>
          </div>
        </section>

        <section class="panel">
          <div class="section-heading">
            <h3>最新筆記</h3>
            <button type="button" @click="navigate('notes')">全部</button>
          </div>
          <div class="note-list">
            <article v-for="item in latestArticles" :key="item.title">
              <strong>{{ item.title }}</strong>
              <small>{{ item.category || "未分類" }} · {{ item.newDate }}</small>
            </article>
          </div>
        </section>
      </section>

      <section v-else-if="currentModule === 'subscription'" class="module-grid">
        <section class="panel wide">
          <div class="section-heading">
            <h3>新增鋒兄訂閱</h3>
          </div>
          <form class="quick-form" @submit.prevent="addSubscription">
            <input v-model="quickForm.subscriptionName" placeholder="名稱" />
            <input v-model="quickForm.subscriptionDate" type="date" />
            <input v-model.number="quickForm.subscriptionPrice" min="0" type="number" placeholder="價格" />
            <button type="submit">新增</button>
          </form>
        </section>
        <section class="panel wide">
          <DataTable :rows="filteredSubscriptions" :columns="['name', 'price', 'currency', 'nextdate', 'account', 'continue']">
            <template #default="{ row }">
              <td><a v-if="row.site" :href="row.site" target="_blank">{{ row.name }}</a><span v-else>{{ row.name }}</span><small>{{ row.note }}</small></td>
              <td>{{ money(row.price, row.currency) }}</td>
              <td>{{ row.currency }}</td>
              <td>{{ row.nextdate }}<small>{{ daysUntil(row.nextdate) }}</small></td>
              <td>{{ row.account || "未指定" }}</td>
              <td><span :class="['pill', row.continue ? 'good' : 'muted']">{{ row.continue ? "持續" : "單次" }}</span></td>
            </template>
          </DataTable>
        </section>
      </section>

      <section v-else-if="currentModule === 'food'" class="module-grid">
        <section class="panel wide">
          <div class="section-heading"><h3>新增鋒兄食品（＋商品庫存）</h3></div>
          <form class="quick-form" @submit.prevent="addFood">
            <input v-model="quickForm.foodName" placeholder="品名" />
            <input v-model.number="quickForm.foodAmount" min="1" type="number" placeholder="數量" />
            <input v-model="quickForm.foodDate" type="date" />
            <button type="submit">新增</button>
          </form>
        </section>
        <article v-for="item in filteredFoods" :key="item.name" class="media-card">
          <img v-if="item.photo" :src="item.photo" :alt="item.name" loading="lazy" />
          <div v-else class="image-fallback"><Package :size="28" /></div>
          <div>
            <strong>{{ item.name }}</strong>
            <span>庫存 {{ item.amount }} · 到期 {{ item.todate }} · {{ daysUntil(item.todate) }}</span>
          </div>
        </article>
      </section>

      <section v-else-if="currentModule === 'notes'" class="module-grid">
        <section class="panel wide">
          <div class="section-heading"><h3>新增鋒兄筆記</h3></div>
          <form class="quick-form note-form" @submit.prevent="addNote">
            <input v-model="quickForm.noteTitle" placeholder="標題" />
            <textarea v-model="quickForm.noteContent" placeholder="內容" />
            <button type="submit">新增</button>
          </form>
        </section>
        <article v-for="item in filteredArticles" :key="item.title" class="note-card">
          <small>{{ item.category || "未分類" }} · {{ item.newDate }}</small>
          <h3>{{ item.title }}</h3>
          <p>{{ item.content }}</p>
        </article>
      </section>

      <section v-else-if="currentModule === 'common'" class="module-grid">
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
          <span>預留 Nhost Storage 與資料表整合</span>
        </article>
      </section>

      <section v-else-if="currentModule === 'bank'" class="module-grid">
        <section class="panel wide">
          <DataTable :rows="filteredBanks" :columns="['name', 'deposit', 'withdrawals', 'transfer', 'card', 'account']">
            <template #default="{ row }">
              <td><a v-if="row.site" :href="row.site" target="_blank">{{ row.name }}</a><span v-else>{{ row.name }}</span></td>
              <td>{{ money(row.deposit) }}</td>
              <td>{{ row.withdrawals }}</td>
              <td>{{ row.transfer }}</td>
              <td>{{ row.card || "電子票證/帳戶" }}</td>
              <td>{{ row.account || "未填" }}</td>
            </template>
          </DataTable>
        </section>
      </section>

      <section v-else-if="currentModule === 'routine'" class="module-grid">
        <section class="panel wide">
          <div class="section-heading"><h3>新增鋒兄例行</h3></div>
          <form class="quick-form" @submit.prevent="addRoutine">
            <input v-model="quickForm.routineName" placeholder="名稱" />
            <input v-model="quickForm.routineDate" type="date" />
            <button type="submit">新增</button>
          </form>
        </section>
        <article v-for="item in filteredRoutines" :key="item.name" class="routine-card">
          <div>
            <strong>{{ item.name }}</strong>
            <small>{{ item.lastdate1 || "未填日期" }}</small>
          </div>
          <p>{{ item.note || "尚無備註" }}</p>
          <a v-if="item.link" :href="item.link" target="_blank">相關連結</a>
        </article>
      </section>

      <section v-else-if="['tools', 'price-compare', 'phone-compare', 'fengbro-tube', 'fengbro-finance'].includes(currentModule)" class="module-grid">
        <section class="panel wide">
          <div class="tabs" role="tablist">
            <button :class="{ active: activeTool === 'price-compare' }" type="button" @click="activeTool = 'price-compare'; currentModule = 'price-compare'">鋒兄比價</button>
            <button :class="{ active: activeTool === 'phone-compare' }" type="button" @click="activeTool = 'phone-compare'; currentModule = 'phone-compare'">手機比價</button>
            <button :class="{ active: activeTool === 'fengbro-tube' }" type="button" @click="activeTool = 'fengbro-tube'; currentModule = 'fengbro-tube'">鋒兄Tube</button>
            <button :class="{ active: activeTool === 'fengbro-finance' }" type="button" @click="activeTool = 'fengbro-finance'; currentModule = 'fengbro-finance'">鋒兄金融</button>
          </div>
        </section>

        <template v-if="activeTool === 'price-compare'">
          <article v-for="item in articles.filter((article) => article.category === '比價')" :key="item.title" class="note-card">
            <small>{{ item.newDate }}</small>
            <h3>{{ item.title }}</h3>
            <p>{{ item.content }}</p>
          </article>
        </template>
        <template v-else-if="activeTool === 'phone-compare'">
          <article class="tool-card"><Boxes /><strong>Samsung Galaxy A56 5G</strong><span>12G/256G，來自例行資料的手機紀錄。</span></article>
          <article class="tool-card"><Boxes /><strong>手機比價待接 API</strong><span>保留 Landtop / momo / PChome 價格匯入位置。</span></article>
        </template>
        <template v-else-if="activeTool === 'fengbro-tube'">
          <article v-for="item in mediaSeed.videos" :key="item" class="tool-card"><Play /><strong>{{ item }}</strong><span>預留 YouTube / Bilibili feed。</span></article>
        </template>
        <template v-else>
          <article v-for="item in financeWatch" :key="item.name" class="tool-card"><CircleDollarSign /><strong>{{ item.name }} · {{ item.symbol }}</strong><span>{{ item.value }} · {{ item.note }}</span></article>
        </template>
      </section>

      <section v-else-if="currentModule === 'settings'" class="module-grid">
        <article class="panel wide">
          <h3>鋒兄設定</h3>
          <div class="settings-list">
            <label><input type="checkbox" checked /> 使用 Nuxt seed data</label>
            <label><input type="checkbox" /> 啟用 Nhost GraphQL 同步</label>
            <label><input type="checkbox" /> 啟用 Nhost Storage 媒體上傳</label>
            <label><input type="checkbox" checked /> 保留 Appwrite CSV 欄位相容性</label>
          </div>
        </article>
      </section>

      <section v-else-if="currentModule === 'about'" class="module-grid">
        <article class="panel wide about-panel">
          <h3>鋒兄關於</h3>
          <p>
            NhostFengBroAI 是鋒兄個人資料工作台的 Nuxt 版本，從 Appwrite 版本複製資訊架構：
            訂閱、食品庫存、筆記、常用帳號、圖片、影片、音樂、文件、播客、銀行、例行與工具。
          </p>
          <p>
            下一階段可以把目前的本地 seed data 替換成 Nhost Auth、Postgres table、GraphQL query/mutation 與 Storage。
          </p>
        </article>
      </section>
    </main>
  </div>
</template>
