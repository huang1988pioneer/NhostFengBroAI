import type { NhostConnection } from "./nhostData";
import type { Article, Bank, CommonAccount, Food, Routine, Subscription } from "~/data/fengbro";

// ── helpers ──────────────────────────────────────────────────────────────────

async function runMutation(
  conn: NhostConnection,
  query: string,
  variables: Record<string, unknown>
): Promise<{ inserted: number; errors?: string[] }> {
  const result = await $fetch<{ data?: Record<string, { affected_rows: number }>; errors?: { message: string }[] }>(
    "/api/nhost/graphql",
    {
      method: "POST",
      body: { ...conn, query, variables }
    }
  );

  if (result.errors?.length) {
    return { inserted: 0, errors: result.errors.map((e) => e.message) };
  }

  const key = Object.keys(result.data ?? {})[0];
  const affected = key ? (result.data?.[key]?.affected_rows ?? 0) : 0;
  return { inserted: affected };
}

// ── Subscription ─────────────────────────────────────────────────────────────

export async function upsertSubscriptions(conn: NhostConnection, rows: Subscription[]) {
  const objects = rows.map((r) => ({
    name: r.name,
    site: r.site ?? "",
    price: r.price ?? 0,
    nextdate: r.nextdate || null,
    note: r.note ?? "",
    account: r.account ?? "",
    currency: r.currency ?? "TWD",
    continue: r.continue ?? false
  }));

  const query = `
    mutation UpsertSubscriptions($objects: [subscription_insert_input!]!) {
      insert_subscription(
        objects: $objects,
        on_conflict: { constraint: subscription_pkey, update_columns: [name, site, price, nextdate, note, account, currency, continue] }
      ) { affected_rows }
    }`;

  return runMutation(conn, query, { objects });
}

// ── Food ─────────────────────────────────────────────────────────────────────

export async function upsertFoods(conn: NhostConnection, rows: Food[]) {
  const objects = rows.map((r) => ({
    name: r.name,
    amount: r.amount ?? 1,
    todate: r.todate || null,
    photo: r.photo ?? "",
    price: r.price ?? 0,
    shop: r.shop ?? ""
  }));

  const query = `
    mutation UpsertFoods($objects: [food_insert_input!]!) {
      insert_food(
        objects: $objects,
        on_conflict: { constraint: food_pkey, update_columns: [name, amount, todate, photo, price, shop] }
      ) { affected_rows }
    }`;

  return runMutation(conn, query, { objects });
}

// ── Article ───────────────────────────────────────────────────────────────────

export async function upsertArticles(conn: NhostConnection, rows: Article[]) {
  const objects = rows.map((r) => ({
    title: r.title,
    content: r.content ?? "",
    category: r.category ?? "",
    newDate: r.newDate || null
  }));

  const query = `
    mutation UpsertArticles($objects: [article_insert_input!]!) {
      insert_article(
        objects: $objects,
        on_conflict: { constraint: article_pkey, update_columns: [title, content, category, newDate] }
      ) { affected_rows }
    }`;

  return runMutation(conn, query, { objects });
}

// ── CommonAccount ─────────────────────────────────────────────────────────────

export async function upsertCommonAccounts(conn: NhostConnection, rows: CommonAccount[]) {
  const objects = rows.map((r) => ({
    name: r.name,
    sites: r.sites ?? []
  }));

  const query = `
    mutation UpsertCommonAccounts($objects: [commonaccount_insert_input!]!) {
      insert_commonaccount(
        objects: $objects,
        on_conflict: { constraint: commonaccount_pkey, update_columns: [name, sites] }
      ) { affected_rows }
    }`;

  return runMutation(conn, query, { objects });
}

// ── Bank ──────────────────────────────────────────────────────────────────────

export async function upsertBanks(conn: NhostConnection, rows: Bank[]) {
  const objects = rows.map((r) => ({
    name: r.name,
    deposit: r.deposit ?? 0,
    site: r.site ?? "",
    withdrawals: r.withdrawals ?? 0,
    transfer: r.transfer ?? 0,
    activity: r.activity ?? "",
    card: r.card ?? "",
    account: r.account ?? ""
  }));

  const query = `
    mutation UpsertBanks($objects: [bank_insert_input!]!) {
      insert_bank(
        objects: $objects,
        on_conflict: { constraint: bank_pkey, update_columns: [name, deposit, site, withdrawals, transfer, activity, card, account] }
      ) { affected_rows }
    }`;

  return runMutation(conn, query, { objects });
}

// ── Routine ───────────────────────────────────────────────────────────────────

export async function upsertRoutines(conn: NhostConnection, rows: Routine[]) {
  const objects = rows.map((r) => ({
    name: r.name,
    note: r.note ?? "",
    lastdate1: r.lastdate1 || null,
    lastdate2: r.lastdate2 || null,
    lastdate3: r.lastdate3 || null,
    link: r.link ?? "",
    photo: r.photo ?? ""
  }));

  const query = `
    mutation UpsertRoutines($objects: [routine_insert_input!]!) {
      insert_routine(
        objects: $objects,
        on_conflict: { constraint: routine_pkey, update_columns: [name, note, lastdate1, lastdate2, lastdate3, link, photo] }
      ) { affected_rows }
    }`;

  return runMutation(conn, query, { objects });
}
