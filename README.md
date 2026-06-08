# NhostFengBroAI

Nuxt 版鋒兄個人資料工作台。此版本優先讀取 Nhost GraphQL 實際資料，只有在 Nhost 未設定、連線失敗，或 schema 找不到相符資料表時，才會顯示本地備援資料。

## Stack

- Nuxt 4 / Vue 3
- TypeScript
- `@lucide/vue`
- Nhost GraphQL / Hasura

## Nhost 設定

可直接在 App 的「設定」頁輸入 Nhost API 資訊：

- `GraphQL URL`
- `Hasura Admin Secret`
- `Authorization Token`（可選）

設定會儲存在目前瀏覽器的 `localStorage`。若不勾選「把 Admin Secret 一起儲存在此瀏覽器」，Admin Secret 只會保留在目前畫面狀態中。

也可以建立 `.env`，可參考 `.env.example`：

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

## 生成 Table

進入「鋒兄設定」後可以使用「生成 Nhost Table」區塊：

- `複製 SQL`：複製所有 `CREATE TABLE IF NOT EXISTS` SQL，可貼到 Nhost SQL Editor。
- `下載 SQL`：下載 `fengbro-nhost-tables.sql`。
- `生成 Table`：呼叫 `/api/nhost/create-tables`，使用 `NUXT_NHOST_ADMIN_SECRET` 透過 Hasura `run_sql` 建立資料表。

若未設定 `NUXT_NHOST_ADMIN_SECRET`，一鍵生成會失敗，但仍可複製 SQL 到 Nhost SQL Editor 手動執行。
若已在設定頁輸入 Admin Secret，則不需要部署環境變數也能使用「生成 Table」。

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
