export default defineNuxtConfig({
  compatibilityDate: "2026-06-07",
  css: ["~/assets/css/main.css"],
  devtools: { enabled: true },
  modules: [],
  app: {
    head: {
      title: "NhostFengBroAI",
      htmlAttrs: { lang: "zh-Hant" },
      meta: [
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        {
          name: "description",
          content: "鋒兄 Nuxt 個人資料工作台，管理訂閱、食品庫存、筆記、銀行、例行與工具。"
        }
      ]
    }
  }
});
