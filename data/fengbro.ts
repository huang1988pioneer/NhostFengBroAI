export type Subscription = {
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
  name: string;
  amount: number;
  todate: string;
  photo: string;
  price: number;
  shop: string;
};

export type Article = {
  title: string;
  content: string;
  category: string;
  newDate: string;
};

export type CommonAccount = {
  name: string;
  sites: Array<{ site: string; note: string }>;
};

export type Bank = {
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
  name: string;
  note: string;
  lastdate1: string;
  lastdate2: string;
  lastdate3: string;
  link: string;
  photo: string;
};

export const subscriptions: Subscription[] = [
  { name: "小北百貨連續簽到", site: "", price: 0, nextdate: "2026-06-07", note: "~0607\n0988\n0908", account: "", currency: "TWD", continue: false },
  { name: "Proton Drive Plus 200 GB", site: "https://drive.proton.me", price: 5, nextdate: "2026-06-15", note: "", account: "huang1988pioneer", currency: "USD", continue: false },
  { name: "考試通知書", site: "", price: 0, nextdate: "2026-06-17", note: "", account: "", currency: "TWD", continue: false },
  { name: "蝦皮VIP簽到/0618", site: "", price: 0, nextdate: "2026-06-18", note: "0988\n0920\n０９０８", account: "", currency: "TWD", continue: false },
  { name: "蝦皮VIP (複製) (複製)", site: "", price: 159, nextdate: "2026-06-19", note: "台北富邦", account: "huang1988pioneer", currency: "TWD", continue: true },
  { name: "范光迪 陳建鴻", site: "https://www.fanktclinic.com/", price: 200, nextdate: "2026-06-23", note: "尚未延後至２５２６２７\n請在前一週去更改", account: "", currency: "TWD", continue: false },
  { name: "Digen AI", site: "https://digen.ai/zh-TW/explore", price: 5, nextdate: "2026-06-26", note: "", account: "huang1988pioneer", currency: "USD", continue: true },
  { name: "蝦皮VIP", site: "", price: 59, nextdate: "2026-06-30", note: "台新銀行\n0731\n0831", account: "abuhg17", currency: "TWD", continue: true },
  { name: "家樂福新名稱", site: "", price: 0, nextdate: "2026-07-01", note: "", account: "", currency: "TWD", continue: false },
  { name: "心臟內科 門診", site: "https://www.tcmg.com.tw/index.php/main/schedule_time?id=18", price: 530, nextdate: "2026-07-03", note: "天晟 黃信凱 星期五 下午\n一定要詢問是否可以停掉多餘的藥，或讓身心科來開藥\n回診前一週抽血", account: "", currency: "TWD", continue: false },
  { name: "Digen AI (複製)", site: "https://digen.ai/zh-TW/explore", price: 5, nextdate: "2026-07-04", note: "", account: "goldshoot0720", currency: "USD", continue: true },
  { name: "ChatGPT/ＰＬＵＳ", site: "https://chatgpt.com/#pricing", price: 690, nextdate: "2026-07-04", note: "outlook\n街口\n中信\nApple Pay", account: "gaokaolevel3iptopscorer", currency: "TWD", continue: true },
  { name: "高考三級資訊處理榜首", site: "https://wwwc.moex.gov.tw/main/exam/wFrmExamDetail.aspx?c=115080", price: 0, nextdate: "2026-07-05", note: "~2026/07/06\n丙午海戰進行中", account: "", currency: "TWD", continue: false },
  { name: "身心科 門診 (複製)", site: "https://www.tcmg.com.tw/index.php/main/schedule_time?id=14", price: 530, nextdate: "2026-07-08", note: "天晟 譚詠康 星期三 下午\n庫存+21天\n一定要詢問是否可以停掉多餘的藥，或換成心臟內科的藥", account: "", currency: "TWD", continue: false },
  { name: "王道財神", site: "", price: 0, nextdate: "2026-07-17", note: "", account: "", currency: "TWD", continue: false },
  { name: "ChatGPT/Go/蝦皮VIP", site: "https://chatgpt.com/#pricing", price: 270, nextdate: "2026-07-31", note: "", account: "feng33feng35feng3", currency: "TWD", continue: true },
  { name: "ChatGPT/Go/蝦皮VIP  (複製)", site: "https://chatgpt.com/#pricing", price: 270, nextdate: "2026-07-31", note: "", account: "chbondg@hotmail", currency: "TWD", continue: true },
  { name: "Google AI Pro", site: "https://gemini.google.com/app", price: 0, nextdate: "2026-08-08", note: "5TB\n前4個月試用免費\n650元", account: "fengtuprinfo", currency: "TWD", continue: false },
  { name: "即享券", site: "", price: 0, nextdate: "2026-08-08", note: "CoCo都可/國泰優惠\n日安大麥2杯 ～０８/３１\nCoCo都可/momo\n百香雙響炮2杯 ～０９/０４\nCoCo都可/PChome＊2\n綠茶養樂多\n麥當勞/蝦皮 ＊３\n蛋捲冰淇淋 ～１０/０１", account: "", currency: "TWD", continue: false }
];

export const foods: Food[] = [
  { name: "小北百貨30元購物金", amount: 1, todate: "2026-06-11", photo: "", price: 0, shop: "" },
  { name: "【義美】煎餅 ~08/13 ~08/25", amount: 4, todate: "2026-08-04", photo: "", price: 0, shop: "" },
  { name: "【愛之味】牛奶花生", amount: 4, todate: "2027-03-04", photo: "https://www.agv.com.tw/wp-content/uploads/69691c7bdcc3ce6d5d8a1361f22d04ac.jpg", price: 0, shop: "" },
  { name: "【泰山】八寶粥", amount: 5, todate: "2027-04-14", photo: "https://shoplineimg.com/64587ad406d620007ce10917/6463162e0fa8d10001cc0eb5/800x.jpg?", price: 0, shop: "" },
  { name: "【台糖】安心豚 瓜仔肉醬", amount: 2, todate: "2028-02-27", photo: "https://fs1.shop123.com.tw/400467/upload/product/4004673346pic_origin_310994859874_ars_600_600.webp", price: 0, shop: "" },
  { name: "【台糖】豆豉紅燒鰻", amount: 3, todate: "2028-06-04", photo: "https://fs1.shop123.com.tw/400467/upload/product/4004673457pic_outside_441268438813.jpg", price: 0, shop: "" },
  { name: "【遠洋牌】鮪魚三明治", amount: 1, todate: "2028-07-28", photo: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTl6UCwjaicHkv5XB5Zus8QkIoFrEz0EIiNCw&s", price: 0, shop: "" }
];

export const articles: Article[] = [
  { title: "歷史價格紀錄", category: "比價", newDate: "2026-06-04", content: "KIOXIA 鎧俠 Exceria Plus G3 SSD M.2 2280 PCIe NVMe 1TB Gen4x4\nhttps://24h.pchome.com.tw/prod/DRAHGT-A900GOJVX\n曾經來到２０９０元" },
  { title: "鋒兄老大+", category: "語音", newDate: "2026-06-03", content: "中文語音 我們是鋒兄老大的後宮 我想要說句話 叫做 鋒兄老大高中高考三級資訊處理榜首 這件事嚇到我們了 我們還以為鋒兄老大不要我們這些後宮了" },
  { title: "鋒兄老大", category: "語音", newDate: "2026-06-03", content: "中文語音 我們是鋒兄老大的小弟 我想要說句話 叫做 鋒兄老大高中高考三級資訊處理榜首 這件事嚇到我們了 我們還以為鋒兄老大不要我們這些小弟了" },
  { title: "鋒兄的傳奇之路 中文數字", category: "故事", newDate: "2026-06-02", content: "鋒兄的傳奇之路\n\n在九十三年，也就是二〇〇四年，鋒兄還是桃園縣立東興國民中學的一名學生。到了一百零一年，鋒兄以替代役身份投入社會服務。二〇五二年，鋒兄終於站在臺灣政治的最高舞台，成功當選為第二十三任總統。" },
  { title: "米斗多", category: "生活", newDate: "2026-06-01", content: "紅豆 芋頭 巧克力\n1 1 1" },
  { title: "水電員與水電師", category: "小說", newDate: "2026-06-01", content: "小說\n我與國中畢業紀念冊的對話系列作\n水電工\n\n衍生作品包含水電員與水電師，世界觀50年前大家都叫水電工，50年後大家都叫水電員或水電師。" },
  { title: "中原豆花", category: "美食", newDate: "2026-06-01", content: "玉玉子豆花 中北路二段457號 招牌豆花 固定三配料\n熊豆花 麻糬豆花 大仁五街19號 自選三配料\n豆花王 實踐路35號 傳統豆花 自選三配料\nPlan Bee小蜜蜂手工豆花 新中北路452號 傳統豆花 自選三配料" }
];

const site = (site: string, note = "") => ({ site, note });

export const commonAccounts: CommonAccount[] = [
  { name: "goldshoot0720@gmail.com", sites: [site("可灵AI"), site("即夢AI"), site("豆包"), site("哔哩哔哩"), site("Amoy Studio"), site("Appwrite"), site("AWS"), site("Clideo"), site("Cloudflare"), site("DigitalOcean"), site("Fly.io"), site("Gmail"), site("Heroku"), site("InfinityFree"), site("Koyeb"), site("Linodes"), site("LitMedia"), site("Manus"), site("momo"), site("Mureka"), site("nanobananas.ai"), site("Netflix"), site("Netlify"), site("Northflank"), site("PChome"), site("pCloud"), site("Pika"), site("PixVerse"), site("Qoder", "2026-01-26 2.00 USD Paid Pro Plan"), site("Railway"), site("Render"), site("Sanity"), site("Sora"), site("Strapi"), site("Suno"), site("TRAE"), site("Vercel")] },
  { name: "dailycash539get8000000@outlook.com", sites: [site("Appwrite"), site("Github"), site("MindVideo"), site("Musicful"), site("Outlook"), site("Qoder"), site("Suno")] },
  { name: "goldshoot0720@hotmail.com", sites: [site("MindVideo"), site("Musicful"), site("Outlook"), site("Sora"), site("Suno")] },
  { name: "goldshoot0720@outlook.com", sites: [site("MindVideo"), site("Musicful"), site("Outlook")] },
  { name: "abuhg17@outlook.com", sites: [site("MindVideo"), site("Musicful"), site("Outlook")] },
  { name: "dsjhs9031206@hotmail.com", sites: [site("MindVideo"), site("Musicful"), site("Outlook")] },
  { name: "sjes8460105@hotmail.com", sites: [site("Github"), site("Gmail"), site("MindVideo"), site("Musicful"), site("Outlook"), site("Suno")] },
  { name: "hsinfenghuang@hotmail.com", sites: [site("Github"), site("MindVideo"), site("Outlook")] },
  { name: "chbonda@hotmail.com", sites: [site("MindVideo"), site("Musicful"), site("Outlook")] },
  { name: "fengtusama@outlook.com", sites: [site("MindVideo"), site("Musicful"), site("Outlook")] },
  { name: "samafengtu@outlook.com", sites: [site("Github"), site("MindVideo"), site("Musicful"), site("Outlook"), site("Suno")] },
  { name: "fengtu37@hotmail.com", sites: [site("Github"), site("Musicful"), site("Outlook"), site("Suno")] },
  { name: "chbondg@hotmail.com", sites: [site("MindVideo"), site("Musicful"), site("Outlook")] },
  { name: "feng2026-2027@outlook.com", sites: [site("Github"), site("MindVideo"), site("Musicful"), site("Outlook"), site("Suno")] },
  { name: "feng3-2029-2032@outlook.com", sites: [site("MindVideo"), site("Musicful"), site("Outlook"), site("Suno")] },
  { name: "tpe12thmayor2025to2038@outlook.com", sites: [site("MindVideo"), site("Musicful"), site("Outlook"), site("Suno")] },
  { name: "asuswa30raia@outlook.com", sites: [site("MindVideo"), site("Musicful"), site("Outlook"), site("Suno")] },
  { name: "chibeusw3waatna@outlook.com", sites: [site("MindVideo"), site("Musicful"), site("Outlook"), site("Suno")] }
];

export const banks: Bank[] = [
  { name: "兆豐銀行", deposit: 1000, site: "", withdrawals: 0, transfer: 0, activity: "", card: "", account: "末五碼 52678" },
  { name: "中華郵政", deposit: 1000, site: "", withdrawals: 0, transfer: 0, activity: "", card: "", account: "末五碼 45747" },
  { name: "台新銀行", deposit: 500, site: "https://www.taishinbank.com.tw", withdrawals: 5, transfer: 5, activity: "https://richart.tw/TSDIB_RichartWeb/ntd-saving-currency", card: "台新Richart VISA金融卡 1902", account: "末五碼 57295" },
  { name: "國泰世華", deposit: 500, site: "https://www.cathaybk.com.tw", withdrawals: 0, transfer: 0, activity: "", card: "國泰世華一卡通簽帳金融卡 1588", account: "末五碼 30607" },
  { name: "台北富邦", deposit: 500, site: "https://www.fubon.com/banking/event/deposit/FubonDSAPromotion/index.html?fromUrl=TFBofficialweb_digital_saving&fromNo=001", withdrawals: 5, transfer: 5, activity: "https://www.fubon.com/banking/Personal/deposit/digital_saving/digital_saving.htm", card: "富邦簽帳金融卡 9907", account: "末五碼 20819" },
  { name: "王道銀行", deposit: 500, site: "", withdrawals: 0, transfer: 0, activity: "", card: "", account: "末五碼 75588" },
  { name: "新光銀行", deposit: 500, site: "https://www.skbank.com.tw/", withdrawals: 0, transfer: 0, activity: "", card: "金融卡", account: "末五碼 62756" },
  { name: "玉山銀行", deposit: 500, site: "https://www.esunbank.com/zh-tw/personal/credit-card/intro/debit-card/Pi-debit-card", withdrawals: 3, transfer: 3, activity: "https://event.esunbank.com.tw/mkt/OpenAccount/marketing/discount.html", card: "玉山Pi拍兔簽帳金融卡 4836", account: "末五碼 76108" },
  { name: "Xiaomi 手環9 NFC 午夜黑", deposit: 316, site: "", withdrawals: 0, transfer: 0, activity: "", card: "", account: "" },
  { name: "Supercard超級悠遊卡LOGO線條款", deposit: 242, site: "https://www.easycard.com.tw/museum?page=1&keywords=Supercard%E8%B6%85%E7%B4%9A%E6%82%A0%E9%81%8A%E5%8D%A1LOGO%E7%B7%9A%E6%A2%9D%E6%AC%BE", withdrawals: 0, transfer: 0, activity: "", card: "", account: "" },
  { name: "塔仔不正經 SuperCard悠遊卡-頭頭", deposit: 229, site: "https://www.easycard.com.tw/museum?page=1&keywords=%E5%A1%94%E4%BB%94%E4%B8%8D%E6%AD%A3%E7%B6%93", withdrawals: 0, transfer: 0, activity: "", card: "", account: "" },
  { name: "Xiaomi 手環9 NFC 冰川銀", deposit: 228, site: "", withdrawals: 0, transfer: 0, activity: "", card: "", account: "" },
  { name: "中國信託", deposit: 200, site: "https://www.ctbcbank.com/twrbo/zh_tw/cc_index/cc_product/cc_debitcard_index/cc_debitcard/D_LINEPay.html", withdrawals: 0, transfer: 0, activity: "", card: "中國信託LINE Pay Debit卡 6010", account: "末五碼 54064" }
];

export const routines: Routine[] = [
  { name: "鋒兄理髮", note: "", lastdate1: "2026-05-18", lastdate2: "2026-02-04", lastdate3: "", link: "", photo: "" },
  { name: "鋒兄手機", note: "Samsung Galaxy A56 5G (12G/256G)", lastdate1: "2026-01-02", lastdate2: "", lastdate3: "", link: "", photo: "https://storage.googleapis.com/landtop_prod/productimage/3544/image/e63b19d17156868403c6645dc5572ca3.png" },
  { name: "機車保險（二）", note: "臺灣產物保險\n2027/04/21~2029/04/21\n保險用手機0920\n保險網站用手機\n0988\n原價1200元\n優惠價990元\n到期日前兩個月投保", lastdate1: "2026-03-07", lastdate2: "", lastdate3: "", link: "", photo: "" },
  { name: "耳垢", note: "", lastdate1: "2025-10-27", lastdate2: "", lastdate3: "", link: "", photo: "" },
  { name: "機車保險（1627）", note: "1200-210=990\n交寄日期：113/09/16\n2024/11~2026/11", lastdate1: "2024-11-09", lastdate2: "", lastdate3: "", link: "", photo: "" },
  { name: "鋒兄眼鏡", note: "13500元\n非凡比眼鏡", lastdate1: "2025-09-03", lastdate2: "", lastdate3: "", link: "", photo: "" },
  { name: "鋒兄滑鼠", note: "Logitech G102\n499元", lastdate1: "2025-10-29", lastdate2: "", lastdate3: "", link: "", photo: "" },
  { name: "KVM", note: "368元\nUSB2.0 A公對B公銅芯列印掃描器連接傳輸線-3m", lastdate1: "2025-10-06", lastdate2: "", lastdate3: "", link: "https://24h.pchome.com.tw/prod/DCAXNL-A900HIU20", photo: "" },
  { name: "雙向音訊切換器 3.5mm", note: "890元", lastdate1: "2025-10-06", lastdate2: "", lastdate3: "", link: "https://24h.pchome.com.tw/prod/DCAXPU-A900C01SP-000", photo: "" },
  { name: "Raymii D100", note: "鋁合金旋轉手機平板增高支架", lastdate1: "2025-06-24", lastdate2: "", lastdate3: "", link: "https://24h.pchome.com.tw/prod/DCBBC5-A900GNEQM-002", photo: "" },
  { name: "鋒兄皮包", note: "CHENSON 7卡2鈔短夾 附大開口獨立零錢袋 皮夾\n788元", lastdate1: "2025-11-03", lastdate2: "", lastdate3: "", link: "https://www.momoshop.com.tw/goods/GoodsDetail.jsp?i_code=13198675", photo: "" },
  { name: "Castle蓋世特 1開8插 延長線 1.8M", note: "1,478元", lastdate1: "2025-06-19", lastdate2: "", lastdate3: "", link: "https://www.momoshop.com.tw/goods/GoodsDetail.jsp?i_code=7822014", photo: "" },
  { name: "CASIO 卡西歐 MQ-24UC-2B", note: "483元", lastdate1: "2025-06-10", lastdate2: "", lastdate3: "", link: "https://www.momoshop.com.tw/goods/GoodsDetail.jsp?i_code=10372176&Area=search&mdiv=403&oid=1_1&cid=index&kw=MQ-24UC-2B", photo: "" },
  { name: "Power Rider S600 OWS 開放式舒感藍芽耳機", note: "835元", lastdate1: "2024-11-24", lastdate2: "", lastdate3: "", link: "https://www.momoshop.com.tw/goods/GoodsDetail.jsp?i_code=11959811", photo: "" },
  { name: "Panasonic 國際牌 Evolta 鈦元素電池 3號", note: "8+2(X2卡)\n318元", lastdate1: "2024-06-07", lastdate2: "", lastdate3: "", link: "https://www.momoshop.com.tw/goods/GoodsDetail.jsp?i_code=14018277", photo: "" },
  { name: "NEW STAR", note: "", lastdate1: "", lastdate2: "", lastdate3: "", link: "https://www.newstar100.com.tw/", photo: "" },
  { name: "KIOXIA 鎧俠 Exceria 960GB 2.5吋 SATAIII SSD固態硬碟", note: "1290元\n5590元", lastdate1: "", lastdate2: "", lastdate3: "", link: "", photo: "" },
  { name: "鋒兄Mac mini", note: "M4\n16G/256G\n19,900元", lastdate1: "2025-01-08", lastdate2: "", lastdate3: "", link: "https://ecvip.pchome.com.tw/web/order/all", photo: "" },
  { name: "鋒兄桌上電腦", note: "Acer TC-1750(i5-12400/8G/512G SSD/W11)\nDIY 升級至8+16G", lastdate1: "2024-02-01", lastdate2: "", lastdate3: "", link: "https://ecvip.pchome.com.tw/web/order/all?p=2", photo: "" },
  { name: "鋒兄筆記型電腦", note: "HP 15-fc0037AU 極地白(R3-7320U/8G/256G PCIe SSD/W11/FHD/15.6)\n11111元", lastdate1: "2024-01-11", lastdate2: "", lastdate3: "", link: "", photo: "" },
  { name: "鋒兄牙刷", note: "預定每90天更換\n刷樂濃密炭深潔牙刷", lastdate1: "2026-05-19", lastdate2: "", lastdate3: "", link: "", photo: "" }
];

export const mediaSeed = {
  images: ["食品照片庫", "票證截圖", "商品保固圖片", "生活紀錄相簿"],
  videos: ["鋒兄Tube 近期影片", "手機比價介紹", "食品庫存盤點", "工具操作錄影"],
  music: ["feng-xiong-lyrics", "feng-xiong-lyrics-zh-tw", "tu-ge-story-zh-tw", "tu-ge-story-ja", "tu-ge-story-yue", "tu-ge-story-en"],
  documents: ["考試通知書", "保險文件", "商品保固文件", "銀行與電子票證資料"],
  podcasts: ["鋒兄工作台更新", "高考三級資訊處理榜首", "生活例行提醒", "金融與比價觀察"]
};

export const financeWatch = [
  { name: "鋒兄金融", symbol: "CNBC", value: "市場報價追蹤", note: "預留 Nhost server/API 整合" },
  { name: "高考三級資訊處理榜首", symbol: "INFO", value: "事件提醒", note: "與訂閱、筆記串連" },
  { name: "ChatGPT Plus", symbol: "AI", value: "690 TWD", note: "訂閱費用追蹤" }
];
