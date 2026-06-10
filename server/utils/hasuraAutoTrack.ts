import { nhostTableSchemas } from "~/utils/nhostSchema";

type GraphqlError = {
  message: string;
};

type GraphqlResponse<T> = {
  data?: T;
  errors?: GraphqlError[];
};

type HasuraMetadataResponse = {
  message?: string;
  error?: string;
};

const tableAliases: Record<string, string> = {
  article: "article",
  articles: "article",
  note: "article",
  notes: "article",
  landtophistory: "landtophistory",
  bank: "bank",
  banks: "bank",
  commonaccount: "commonaccount",
  commonaccounts: "commonaccount",
  common_accounts: "commonaccount",
  accounts: "commonaccount",
  commondocument: "commondocument",
  commondocuments: "commondocument",
  documents: "commondocument",
  food: "food",
  foods: "food",
  image: "image",
  images: "image",
  music: "music",
  podcast: "podcast",
  podcasts: "podcast",
  routine: "routine",
  routines: "routine",
  subscription: "subscription",
  subscriptions: "subscription",
  video: "video",
  videos: "video"
};

const knownTables = new Set(nhostTableSchemas.map((schema) => schema.name));

export async function executeGraphqlWithAutoTrack<T>(
  graphqlUrl: string,
  headers: Record<string, string>,
  query: string,
  variables?: Record<string, unknown>,
  adminSecret?: string
): Promise<GraphqlResponse<T>> {
  const first = await executeGraphql<T>(graphqlUrl, headers, query, variables);
  if (!shouldAutoTrack(first.errors) || !adminSecret) return first;

  const tables = extractTablesFromQuery(query);
  if (!tables.length) return first;

  await trackTables(graphqlUrl, adminSecret, tables);
  return await executeGraphql<T>(graphqlUrl, headers, query, variables);
}

async function executeGraphql<T>(
  graphqlUrl: string,
  headers: Record<string, string>,
  query: string,
  variables?: Record<string, unknown>
) {
  return await $fetch<GraphqlResponse<T>>(graphqlUrl, {
    method: "POST",
    headers,
    body: { query, variables }
  });
}

function shouldAutoTrack(errors?: GraphqlError[]) {
  if (!errors?.length) return false;
  const message = errors.map((error) => error.message).join(" ").toLowerCase();
  return message.includes("not tracked") || (message.includes("field") && message.includes("query_root"));
}

function extractTablesFromQuery(query: string) {
  const found = new Set<string>();
  const normalizedQuery = query.replace(/[\r\n\t]+/g, " ");

  for (const match of normalizedQuery.matchAll(/\b(?:insert|update|delete)_([A-Za-z0-9_]+?)(?:_one|_by_pk)?\b/g)) {
    const resolved = normalizeTableName(match[1]);
    if (resolved) found.add(resolved);
  }

  for (const [alias, target] of Object.entries(tableAliases)) {
    const pattern = new RegExp(`(^|[^A-Za-z0-9_])${escapeRegex(alias)}(?=[^A-Za-z0-9_]|$)`, "i");
    if (pattern.test(normalizedQuery) && knownTables.has(target)) {
      found.add(target);
    }
  }

  return [...found];
}

function normalizeTableName(raw: string) {
  const trimmed = raw.replace(/_(aggregate|one|by_pk)$/i, "");
  const direct = tableAliases[trimmed] || tableAliases[trimmed.toLowerCase()];
  if (direct && knownTables.has(direct)) return direct;
  return knownTables.has(trimmed) ? trimmed : undefined;
}

async function trackTables(graphqlUrl: string, adminSecret: string, tables: string[]) {
  const metadataEndpoint = deriveHasuraMetadataEndpoint(graphqlUrl);

  for (const table of tables) {
    try {
      const response = await $fetch<HasuraMetadataResponse>(metadataEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hasura-admin-secret": adminSecret
        },
        body: {
          type: "pg_track_table",
          args: {
            source: "default",
            table: {
              schema: "public",
              name: table
            }
          }
        }
      });

      if (response.error && !isAlreadyTracked(response.error)) {
        throw new Error(response.error);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!isAlreadyTracked(message)) {
        throw error;
      }
    }
  }
}

function deriveHasuraMetadataEndpoint(graphqlUrl: string) {
  const url = new URL(graphqlUrl);
  url.hostname = url.hostname.replace(".graphql.", ".hasura.");
  url.pathname = "/v1/metadata";
  return url.toString();
}

function isAlreadyTracked(message: string) {
  const lower = message.toLowerCase();
  return lower.includes("already") && lower.includes("track");
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
