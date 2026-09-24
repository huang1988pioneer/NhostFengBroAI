// 日期與狀態判斷工具：供訂閱、食品、例行事項、銀行等模組共用。

const DAY_MS = 86400000;

export function todayIso() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

/** 目標日期距今天幾天；無效日期回傳 null。負數代表已過。 */
export function dayDiff(date: string | null | undefined, from = todayIso()): number | null {
  if (!date) return null;
  const target = Date.parse(`${date.slice(0, 10)}T00:00:00Z`);
  const base = Date.parse(`${from.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(target) || Number.isNaN(base)) return null;
  return Math.round((target - base) / DAY_MS);
}

export type DueLevel = "none" | "overdue" | "urgent" | "soon" | "ok";

/** 依剩餘天數分級：已過期 / urgentDays 內 / soonDays 內 / 正常 */
export function dueLevel(date: string | null | undefined, urgentDays = 7, soonDays = 30): DueLevel {
  const diff = dayDiff(date);
  if (diff === null) return "none";
  if (diff < 0) return "overdue";
  if (diff <= urgentDays) return "urgent";
  if (diff <= soonDays) return "soon";
  return "ok";
}

export function addMonths(date: string | null | undefined, months: number) {
  const base = date && !Number.isNaN(Date.parse(date)) ? date.slice(0, 10) : todayIso();
  const [year = 1970, month = 1, day = 1] = base.split("-").map(Number);
  const targetMonthIndex = month - 1 + months;
  const lastDay = new Date(Date.UTC(year, targetMonthIndex + 1, 0)).getUTCDate();
  const result = new Date(Date.UTC(year, targetMonthIndex, Math.min(day, lastDay)));
  return result.toISOString().slice(0, 10);
}

/** 兩個日期間隔天數（a - b），任一無效回傳 null */
export function gapDays(a: string | null | undefined, b: string | null | undefined): number | null {
  if (!a || !b) return null;
  return dayDiff(a, b);
}

/** 天數轉為易讀字串，例如 400 → 1 年 1 個月 */
export function humanizeDays(days: number | null) {
  if (days === null) return "-";
  const abs = Math.abs(days);
  if (abs < 31) return `${abs} 天`;
  const years = Math.floor(abs / 365);
  const months = Math.floor((abs % 365) / 30);
  if (years && months) return `${years} 年 ${months} 個月`;
  if (years) return `${years} 年`;
  return `${months} 個月`;
}

export type RoutineRhythm = {
  sinceLast: number | null;
  gaps: number[];
  averageGap: number | null;
  nextDate: string;
  nextIn: number | null;
};

/** 依最近三次日期推算平均間隔與預估下次日期 */
export function routineRhythm(dates: Array<string | null | undefined>): RoutineRhythm {
  const valid = dates.filter((date): date is string => Boolean(date) && dayDiff(date) !== null);
  const gaps: number[] = [];
  for (let index = 0; index < valid.length - 1; index += 1) {
    const gap = gapDays(valid[index], valid[index + 1]);
    if (gap !== null && gap > 0) gaps.push(gap);
  }
  const averageGap = gaps.length ? Math.round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length) : null;
  const last = valid[0] || "";
  const sinceLast = last ? -(dayDiff(last) as number) : null;
  let nextDate = "";
  let nextIn: number | null = null;
  if (last && averageGap) {
    const next = new Date(Date.parse(`${last}T00:00:00Z`) + averageGap * DAY_MS);
    nextDate = next.toISOString().slice(0, 10);
    nextIn = dayDiff(nextDate);
  }
  return { sinceLast, gaps, averageGap, nextDate, nextIn };
}

/** 將任意字串整理為可開啟的網址；無法判斷時回傳空字串 */
export function toOpenableUrl(value: string | null | undefined) {
  const raw = (value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(raw)) return `https://${raw}`;
  return "";
}
