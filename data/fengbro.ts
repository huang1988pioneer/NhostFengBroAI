export type Subscription = {
  id?: string;
  name: string;
  site: string;
  price: number;
  nextdate: string;
  note: string;
  account: string;
  currency: "TWD" | "USD";
  continue: boolean;
};

export type Food = {
  id?: string;
  name: string;
  amount: number;
  todate: string;
  photo: string;
  price: number;
  shop: string;
};

export type Article = {
  id?: string;
  title: string;
  content: string;
  category: string;
  newDate: string;
};

export type CommonAccount = {
  id?: string;
  name: string;
  sites: Array<{ site: string; note: string }>;
};

export type Bank = {
  id?: string;
  name: string;
  deposit: number;
  site: string;
  withdrawals: number;
  transfer: number;
  activity: string;
  card: string;
  account: string;
};

export type Routine = {
  id?: string;
  name: string;
  note: string;
  lastdate1: string;
  lastdate2: string;
  lastdate3: string;
  link: string;
  photo: string;
};

export type MediaLibrary = {
  images: string[];
  videos: string[];
  music: string[];
  documents: string[];
  podcasts: string[];
};

export type FinanceWatch = {
  id?: string;
  name: string;
  symbol: string;
  value: string;
  note: string;
};

export type FengbroDataset = {
  subscriptions: Subscription[];
  foods: Food[];
  articles: Article[];
  commonAccounts: CommonAccount[];
  banks: Bank[];
  routines: Routine[];
  mediaSeed: MediaLibrary;
  financeWatch: FinanceWatch[];
};

export const emptyDataset: FengbroDataset = {
  subscriptions: [],
  foods: [],
  articles: [],
  commonAccounts: [],
  banks: [],
  routines: [],
  mediaSeed: { images: [], videos: [], music: [], documents: [], podcasts: [] },
  financeWatch: []
};

export const fallbackDataset: FengbroDataset = {
  subscriptions: [
    {
      name: "ChatGPT Plus",
      site: "https://chatgpt.com/#pricing",
      price: 690,
      nextdate: "2026-07-04",
      note: "本地備援資料：請設定 Nhost 後改用實際資料",
      account: "fengbro",
      currency: "TWD",
      continue: true
    },
    {
      name: "Proton Drive Plus 200 GB",
      site: "https://drive.proton.me",
      price: 5,
      nextdate: "2026-06-15",
      note: "本地備援資料",
      account: "huang1988pioneer",
      currency: "USD",
      continue: false
    }
  ],
  foods: [
    {
      name: "食品庫存範例",
      amount: 4,
      todate: "2026-08-04",
      photo: "",
      price: 0,
      shop: "本地備援資料"
    }
  ],
  articles: [
    {
      title: "Nhost 實際資料尚未載入",
      content: "請在 .env 設定 NUXT_PUBLIC_NHOST_GRAPHQL_URL，必要時加入 NUXT_NHOST_ADMIN_SECRET。",
      category: "系統",
      newDate: "2026-06-07"
    }
  ],
  commonAccounts: [
    {
      name: "goldshoot0720@gmail.com",
      sites: [
        { site: "Nhost", note: "本地備援資料" },
        { site: "GitHub", note: "" }
      ]
    }
  ],
  banks: [
    {
      name: "銀行帳戶範例",
      deposit: 1000,
      site: "",
      withdrawals: 0,
      transfer: 0,
      activity: "",
      card: "",
      account: "本地備援資料"
    }
  ],
  routines: [
    {
      name: "例行事項範例",
      note: "本地備援資料",
      lastdate1: "2026-05-18",
      lastdate2: "",
      lastdate3: "",
      link: "",
      photo: ""
    }
  ],
  mediaSeed: {
    images: ["圖片資料夾"],
    videos: ["影片資料夾"],
    music: ["音樂資料夾"],
    documents: ["文件資料夾"],
    podcasts: ["Podcast 資料夾"]
  },
  financeWatch: [
    { name: "市場追蹤", symbol: "INFO", value: "等待 Nhost 資料", note: "本地備援資料" }
  ]
};

