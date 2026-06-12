const DEFAULT_HEADERS = {
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Safari/537.36",
  "accept-language": "zh-TW,zh;q=0.9,en;q=0.8"
};

const DEFAULT_CHANNELS = [
  { id: "sjdiao", label: "SJdiao", handle: "@SJdiao", url: "https://www.youtube.com/@SJdiao/videos" },
  { id: "libertas1984", label: "libertas1984", handle: "@libertas1984", url: "https://www.youtube.com/@libertas1984/videos" },
  { id: "sunlao", label: "sunlao", handle: "@sunlao", url: "https://www.youtube.com/@sunlao/videos" },
  { id: "torontobigface", label: "Torontobigface", handle: "@Torontobigface", url: "https://www.youtube.com/@Torontobigface/videos" }
];

type TubeChannel = typeof DEFAULT_CHANNELS[number];

export default defineEventHandler(async (event) => {
  const channels = readChannels(event);
  const results = await Promise.all(channels.map(fetchChannel));
  const recentVideos = results
    .flatMap((channel) => channel.videos.map((video) => ({ ...video, channelLabel: channel.label })))
    .sort((a, b) => b.published.localeCompare(a.published))
    .slice(0, 24);

  return {
    fetchedAt: new Date().toISOString(),
    channels: results,
    recentVideos
  };
});

function readChannels(event: any): TubeChannel[] {
  const raw = getQuery(event).channels;
  if (typeof raw !== "string") return DEFAULT_CHANNELS;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_CHANNELS;
    return parsed
      .map((item) => ({
        id: String(item.id || item.handle || item.label || "").replace(/[^a-z0-9-]/gi, "").toLowerCase(),
        label: String(item.label || item.handle || "YouTube"),
        handle: String(item.handle || ""),
        url: String(item.url || "")
      }))
      .filter((item) => item.id && /^https:\/\/www\.youtube\.com\/@[^/]+\/videos$/i.test(item.url))
      .slice(0, 20);
  } catch {
    return DEFAULT_CHANNELS;
  }
}

async function fetchChannel(channel: TubeChannel) {
  try {
    const html = await fetchText(channel.url);
    const channelId = html.match(/<meta itemprop="channelId" content="([^"]+)"/i)?.[1] ||
      html.match(/"browseId":"(UC[^"]+)"/i)?.[1] ||
      "";
    if (!channelId) throw new Error("找不到 YouTube channel id");

    const xml = await fetchText(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`);
    return {
      ...channel,
      channelId,
      videos: parseFeed(xml),
      error: ""
    };
  } catch (error) {
    return {
      ...channel,
      channelId: "",
      videos: [],
      error: error instanceof Error ? error.message : "YouTube 讀取失敗"
    };
  }
}

async function fetchText(url: string) {
  const response = await fetch(url, { headers: DEFAULT_HEADERS, redirect: "follow" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.text();
}

function parseFeed(xml: string) {
  return xml
    .split(/<entry>/i)
    .slice(1)
    .map((chunk) => {
      const entry = chunk.split(/<\/entry>/i)[0] || "";
      const id = extractTag(entry, "yt:videoId");
      return {
        id,
        title: extractTag(entry, "title") || "未命名影片",
        url: extractLink(entry) || (id ? `https://www.youtube.com/watch?v=${id}` : ""),
        published: extractTag(entry, "published"),
        updated: extractTag(entry, "updated"),
        thumbnail: id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : ""
      };
    })
    .filter((video) => video.id && video.url)
    .slice(0, 10);
}

function extractTag(xml: string, tagName: string) {
  const escaped = tagName.replace(":", "\\:");
  return decodeEntities(xml.match(new RegExp(`<${escaped}[^>]*>([\\s\\S]*?)<\\/${escaped}>`, "i"))?.[1]?.trim() || "");
}

function extractLink(entry: string) {
  return decodeEntities(entry.match(/<link[^>]+href="([^"]+)"/i)?.[1]?.trim() || "");
}

function decodeEntities(value: string) {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}
