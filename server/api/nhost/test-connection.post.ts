type TestConnectionBody = {
  graphqlUrl?: string;
  adminSecret?: string;
  authorization?: string;
};

type IntrospectionResponse = {
  data?: {
    __schema?: {
      queryType?: {
        name?: string;
        fields?: Array<{ name: string }>;
      };
    };
  };
  errors?: Array<{ message: string }>;
};

const testQuery = `query FengbroConnectionTest {
  __schema {
    queryType {
      name
      fields {
        name
      }
    }
  }
}`;

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const body = await readBody<TestConnectionBody>(event);
  const graphqlUrl = body.graphqlUrl || config.public.nhostGraphqlUrl;

  if (!graphqlUrl || typeof graphqlUrl !== "string") {
    return {
      ok: false,
      error: "Missing Nhost GraphQL URL",
      hint: "請輸入格式如 https://<subdomain>.graphql.<region>.nhost.run/v1 的 Nhost GraphQL URL。"
    };
  }

  const urlCheck = validateNhostGraphqlUrl(graphqlUrl);
  if (!urlCheck.ok) {
    return {
      ok: false,
      error: urlCheck.error,
      hint: urlCheck.hint
    };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  const authorization = body.authorization || getHeader(event, "authorization");
  if (authorization) {
    headers.Authorization = authorization;
  }

  const adminSecret = body.adminSecret || config.nhostAdminSecret;
  if (adminSecret) {
    headers["x-hasura-admin-secret"] = String(adminSecret);
  }

  try {
    const response = await $fetch<IntrospectionResponse>(graphqlUrl, {
      method: "POST",
      headers,
      body: { query: testQuery }
    });

    if (response.errors?.length) {
      return {
        ok: false,
        error: response.errors.map((error) => error.message).join("; "),
        hint: "Nhost 有回應，但 GraphQL 回傳錯誤。若資料表受保護，請填入 Hasura Admin Secret 或 Authorization Token 後再測試。"
      };
    }

    const fields = response.data?.__schema?.queryType?.fields || [];
    const sampleFields = fields.slice(0, 8).map((field) => field.name);

    if (!fields.length || sampleFields.every((field) => field === "no_queries_available")) {
      return {
        ok: false,
        error: "Nhost connected, but no public tables are tracked in GraphQL",
        hint: "請到設定頁執行「生成 Table」，或在 Nhost Console 按 Track now，讓 public 資料表進入 Hasura GraphQL。"
      };
    }

    return {
      ok: true,
      graphqlUrl,
      queryType: response.data?.__schema?.queryType?.name || "query_root",
      rootFields: fields.length,
      sampleFields
    };
  } catch (error) {
    return {
      ok: false,
      error: extractConnectionError(error),
      hint: "請確認 URL、region、專案 subdomain 是否正確；若是私有 schema，請填入 Hasura Admin Secret 後再測試。"
    };
  }
});

function validateNhostGraphqlUrl(rawUrl: string):
  | { ok: true }
  | { ok: false; error: string; hint: string } {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return {
      ok: false,
      error: "Invalid URL",
      hint: "請輸入完整 URL，例如 https://ullnfgbmboomsrmvscge.graphql.ap-southeast-1.nhost.run/v1。"
    };
  }

  if (url.hostname.endsWith(".nhost.run") && !url.hostname.includes(".graphql.")) {
    return {
      ok: false,
      error: "Nhost GraphQL URL format is missing service/region",
      hint: "Nhost Cloud GraphQL URL 格式是 https://<subdomain>.graphql.<region>.nhost.run/v1，例如 https://ullnfgbmboomsrmvscge.graphql.ap-southeast-1.nhost.run/v1。"
    };
  }

  return { ok: true };
}

function extractConnectionError(error: unknown) {
  if (error instanceof Error) {
    const cause = (error as Error & { cause?: unknown }).cause;
    if (cause && typeof cause === "object" && "code" in cause) {
      const record = cause as Record<string, unknown>;
      if (record.code === "ENOTFOUND") {
        return `DNS lookup failed for ${String(record.hostname || "Nhost host")}`;
      }
    }

    return error.message;
  }

  return "Nhost connection test failed";
}
