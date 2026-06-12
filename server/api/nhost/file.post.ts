type FilePreviewBody = {
  url?: string;
  graphqlUrl?: string;
  adminSecret?: string;
  authorization?: string;
};

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const body = await readBody<FilePreviewBody>(event);
  if (!body?.url) {
    throw createError({ statusCode: 400, statusMessage: "Missing file URL" });
  }

  const headers: Record<string, string> = {};
  const adminSecret = body.adminSecret || config.nhostAdminSecret;
  const authorization = body.authorization || getHeader(event, "authorization");
  if (authorization) headers.Authorization = authorization;
  if (adminSecret) headers["x-hasura-admin-secret"] = String(adminSecret);

  const candidates = buildFileUrlCandidates(body.url);
  let lastError = "";

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, { headers });
      const contentType = response.headers.get("content-type") || "application/octet-stream";
      if (!response.ok) {
        lastError = `${response.status} ${response.statusText}`;
        continue;
      }

      const data = Buffer.from(await response.arrayBuffer());
      if (!data.length) {
        lastError = "Empty file response";
        continue;
      }

      return {
        ok: true,
        contentType,
        data: data.toString("base64")
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  throw createError({
    statusCode: 502,
    statusMessage: lastError || "Unable to load Nhost file"
  });
});

function buildFileUrlCandidates(rawUrl: string) {
  const candidates = new Set<string>();
  candidates.add(rawUrl);

  try {
    const url = new URL(rawUrl);
    const normalizedPath = url.pathname.replace(/\/+$/, "");
    if (!normalizedPath.endsWith("/download")) {
      const download = new URL(url);
      download.pathname = `${normalizedPath}/download`;
      candidates.add(download.toString());
    }
    if (!normalizedPath.endsWith("/preview")) {
      const preview = new URL(url);
      preview.pathname = `${normalizedPath}/preview`;
      candidates.add(preview.toString());
    }
  } catch {
    // Keep the original URL as the only candidate.
  }

  return [...candidates];
}
