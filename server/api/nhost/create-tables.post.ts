import { createNhostTablesSql, nhostTableSchemas } from "~/utils/nhostSchema";
import { seedNhostTablesSql } from "~/utils/nhostSeed";

type HasuraRunSqlResponse = {
  result_type?: string;
  result?: string[][];
  error?: string;
  code?: string;
};

type HasuraMetadataResponse = {
  message?: string;
  error?: string;
  code?: string;
};

type CreateTablesBody = {
  graphqlUrl?: string;
  adminSecret?: string;
};

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const body = await readBody<CreateTablesBody>(event);
  const graphqlUrl = body.graphqlUrl || config.public.nhostGraphqlUrl;
  const adminSecret = body.adminSecret || config.nhostAdminSecret;

  if (!graphqlUrl || typeof graphqlUrl !== "string") {
    throw createError({
      statusCode: 500,
      statusMessage: "Missing Nhost GraphQL URL"
    });
  }

  if (!adminSecret) {
    throw createError({
      statusCode: 500,
      statusMessage: "Missing Nhost admin secret"
    });
  }

  const sqlEndpoint = deriveHasuraQueryEndpoint(graphqlUrl);
  const metadataEndpoint = deriveHasuraMetadataEndpoint(graphqlUrl);
  const response = await $fetch<HasuraRunSqlResponse>(sqlEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hasura-admin-secret": String(adminSecret)
    },
    body: {
      type: "run_sql",
      args: {
        source: "default",
        sql: createNhostTablesSql,
        cascade: false,
        read_only: false
      }
    }
  });

  if (response.error) {
    throw createError({
      statusCode: 500,
      statusMessage: response.error,
      data: response
    });
  }

  const trackResult = await trackTables(metadataEndpoint, String(adminSecret));
  const seedResponse = await $fetch<HasuraRunSqlResponse>(sqlEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hasura-admin-secret": String(adminSecret)
    },
    body: {
      type: "run_sql",
      args: {
        source: "default",
        sql: seedNhostTablesSql,
        cascade: false,
        read_only: false
      }
    }
  });

  if (seedResponse.error) {
    throw createError({
      statusCode: 500,
      statusMessage: seedResponse.error,
      data: seedResponse
    });
  }

  return {
    ok: true,
    endpoint: sqlEndpoint,
    metadataEndpoint,
    tables: nhostTableSchemas.length,
    tracked: trackResult.tracked,
    trackSkipped: trackResult.skipped,
    resultType: response.result_type || "CommandOk"
  };
});

function deriveHasuraQueryEndpoint(graphqlUrl: string) {
  const url = new URL(graphqlUrl);
  url.hostname = url.hostname.replace(".graphql.", ".hasura.");
  url.pathname = url.pathname.replace(/\/v1\/graphql\/?$/, "/v2/query").replace(/\/v1\/?$/, "/v2/query");

  if (!url.pathname.endsWith("/v2/query")) {
    url.pathname = `${url.pathname.replace(/\/$/, "")}/v2/query`;
  }

  return url.toString();
}

function deriveHasuraMetadataEndpoint(graphqlUrl: string) {
  const url = new URL(graphqlUrl);
  url.hostname = url.hostname.replace(".graphql.", ".hasura.");
  url.pathname = "/v1/metadata";
  return url.toString();
}

async function trackTables(metadataEndpoint: string, adminSecret: string) {
  let tracked = 0;
  let skipped = 0;

  for (const schema of nhostTableSchemas) {
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
              name: schema.name
            }
          }
        }
      });

      if (response.error) {
        if (isAlreadyTracked(response.error)) skipped += 1;
        else throw new Error(response.error);
      } else {
        tracked += 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isAlreadyTracked(message)) {
        skipped += 1;
        continue;
      }

      throw createError({
        statusCode: 500,
        statusMessage: `Unable to track public.${schema.name}: ${message}`
      });
    }
  }

  return { tracked, skipped };
}

function isAlreadyTracked(message: string) {
  return message.toLowerCase().includes("already") && message.toLowerCase().includes("track");
}
