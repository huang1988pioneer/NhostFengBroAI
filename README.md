# NhostFengBroAI

Nuxt 版鋒兄個人資料工作台。此版本優先讀取 Nhost GraphQL 實際資料，只有在 Nhost 未設定、連線失敗，或 schema 找不到相符資料表時，才會顯示本地備援資料。

## Stack

- Nuxt 4 / Vue 3
- TypeScript
- `@lucide/vue`
- Nhost GraphQL / Hasura

## Nhost 設定

建立 `.env`，可參考 `.env.example`：

```bash
NUXT_PUBLIC_NHOST_GRAPHQL_URL=https://your-subdomain.graphql.your-region.nhost.run/v1
NUXT_NHOST_ADMIN_SECRET=your-hasura-admin-secret
```

也可以改用：

```bash
NUXT_PUBLIC_NHOST_SUBDOMAIN=your-subdomain
NUXT_PUBLIC_NHOST_REGION=your-region
NUXT_NHOST_ADMIN_SECRET=your-hasura-admin-secret
```

`NUXT_NHOST_ADMIN_SECRET` 只會在 server-side `/api/nhost/graphql` proxy 使用，不會送到瀏覽器。

## 支援的資料表

系統會先 introspect Nhost GraphQL schema，再自動尋找常見 table 名稱：

- 訂閱：`subscriptions`, `subscription`, `fengbro_subscriptions`, `subscription_items`
- 食品：`foods`, `food`, `food_items`, `fengbro_foods`
- 筆記：`articles`, `article`, `notes`, `note`, `fengbro_articles`
- 銀行：`banks`, `bank`, `bank_accounts`, `fengbro_banks`
- 例行：`routines`, `routine`, `routine_items`, `fengbro_routines`
- 常用帳號：`common_accounts`, `accounts`, `commonAccounts`, `fengbro_accounts`
- 媒體：`media_items`, `media`, `fengbro_media`
- 金融追蹤：`finance_watch`, `finance`, `watchlist`, `fengbro_finance_watch`

欄位也支援常見別名，例如 `nextdate` / `next_date` / `due_date`、`newDate` / `new_date` / `created_at`。

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

