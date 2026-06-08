export default defineNuxtConfig({
  compatibilityDate: "2026-06-07",
  css: ["~/assets/css/main.css"],
  devtools: { enabled: true },
  modules: [],
  runtimeConfig: {
    nhostAdminSecret: process.env.NUXT_NHOST_ADMIN_SECRET || "",
    public: {
      nhostGraphqlUrl:
        process.env.NUXT_PUBLIC_NHOST_GRAPHQL_URL ||
        (process.env.NUXT_PUBLIC_NHOST_SUBDOMAIN && process.env.NUXT_PUBLIC_NHOST_REGION
          ? `https://${process.env.NUXT_PUBLIC_NHOST_SUBDOMAIN}.graphql.${process.env.NUXT_PUBLIC_NHOST_REGION}.nhost.run/v1`
          : "")
    }
  },
  app: {
    head: {
      title: "NhostFengBroAI",
      htmlAttrs: { lang: "zh-Hant" },
      meta: [
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        {
          name: "description",
          content: "鋒兄個人資料工作台，使用 Nhost GraphQL 實際資料。"
        }
      ]
    }
  }
});

