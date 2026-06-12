type FileDeleteBody = {
  graphqlUrl?: string;
  adminSecret?: string;
  authorization?: string;
};

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Missing Nhost file id" });
  }

  const body = await readBody<FileDeleteBody>(event).catch(() => ({} as FileDeleteBody));
  const graphqlUrl = body.graphqlUrl || config.public.nhostGraphqlUrl;
  if (!graphqlUrl || typeof graphqlUrl !== "string") {
    throw createError({ statusCode: 400, statusMessage: "Missing Nhost GraphQL URL" });
  }

  const headers: Record<string, string> = {};
  const adminSecret = body.adminSecret || config.nhostAdminSecret;
  const authorization = body.authorization || getHeader(event, "authorization");
  if (authorization) headers.Authorization = authorization;
  if (adminSecret) headers["x-hasura-admin-secret"] = String(adminSecret);

  const response = await fetch(`${deriveStorageFilesEndpoint(graphqlUrl)}/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw createError({
      statusCode: response.status || 502,
      statusMessage: detail || `Nhost Storage delete failed (${response.status || "unknown"})`
    });
  }

  return { ok: true, id };
});

function deriveStorageFilesEndpoint(graphqlUrl: string) {
  const url = new URL(graphqlUrl);
  url.hostname = url.hostname.replace(".graphql.", ".storage.");
  url.pathname = "/v1/files";
  url.search = "";
  return url.toString().replace(/\/$/, "");
}
