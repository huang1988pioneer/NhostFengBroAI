export type NhostTableSchema = {
  name: string;
  label: string;
  sql: string;
};

const baseColumns = `  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()`;

export const nhostTableSchemas: NhostTableSchema[] = [
  {
    name: "article",
    label: "筆記",
    sql: `create table if not exists public.article (
${baseColumns},
  title text not null,
  content text default '',
  category text default '',
  "newDate" date default current_date
);`
  },
  {
    name: "bank",
    label: "銀行",
    sql: `create table if not exists public.bank (
${baseColumns},
  name text not null,
  deposit numeric default 0,
  site text default '',
  withdrawals integer default 0,
  transfer integer default 0,
  activity text default '',
  card text default '',
  account text default ''
);`
  },
  {
    name: "commonaccount",
    label: "常用帳號",
    sql: `create table if not exists public.commonaccount (
${baseColumns},
  name text not null,
  sites jsonb default '[]'::jsonb,
  note text default ''
);`
  },
  {
    name: "commondocument",
    label: "常用文件",
    sql: `create table if not exists public.commondocument (
${baseColumns},
  name text not null,
  url text default '',
  note text default ''
);`
  },
  {
    name: "food",
    label: "食品庫存",
    sql: `create table if not exists public.food (
${baseColumns},
  name text not null,
  amount integer default 1,
  todate date,
  photo text default '',
  price numeric default 0,
  shop text default ''
);`
  },
  {
    name: "image",
    label: "圖片",
    sql: `create table if not exists public.image (
${baseColumns},
  name text not null,
  url text default '',
  note text default ''
);`
  },
  {
    name: "landtophistory",
    label: "價格歷史",
    sql: `create table if not exists public.landtophistory (
${baseColumns},
  title text not null,
  content text default '',
  category text default '價格比較',
  "newDate" date default current_date,
  url text default ''
);`
  },
  {
    name: "music",
    label: "音樂",
    sql: `create table if not exists public.music (
${baseColumns},
  name text not null,
  url text default '',
  note text default ''
);`
  },
  {
    name: "podcast",
    label: "Podcast",
    sql: `create table if not exists public.podcast (
${baseColumns},
  name text not null,
  url text default '',
  note text default ''
);`
  },
  {
    name: "routine",
    label: "例行事項",
    sql: `create table if not exists public.routine (
${baseColumns},
  name text not null,
  note text default '',
  lastdate1 date,
  lastdate2 date,
  lastdate3 date,
  link text default '',
  photo text default ''
);`
  },
  {
    name: "subscription",
    label: "訂閱",
    sql: `create table if not exists public.subscription (
${baseColumns},
  name text not null,
  site text default '',
  price numeric default 0,
  nextdate date,
  note text default '',
  account text default '',
  currency text default 'TWD',
  continue boolean default true
);`
  },
  {
    name: "video",
    label: "影片",
    sql: `create table if not exists public.video (
${baseColumns},
  name text not null,
  url text default '',
  note text default ''
);`
  }
];

export const createNhostTablesSql = `${nhostTableSchemas.map((schema) => schema.sql).join("\n\n")}

${nhostTableSchemas
  .map((schema) => `comment on table public.${schema.name} is 'FengBro ${schema.name} imported from Appwrite naming';`)
  .join("\n")}`;

