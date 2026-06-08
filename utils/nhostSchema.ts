export type NhostTableSchema = {
  name: string;
  label: string;
  sql: string;
};

export const nhostTableSchemas: NhostTableSchema[] = [
  {
    name: "subscriptions",
    label: "訂閱",
    sql: `create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  site text default '',
  price numeric default 0,
  nextdate date,
  note text default '',
  account text default '',
  currency text default 'TWD',
  continue boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);`
  },
  {
    name: "foods",
    label: "食品庫存",
    sql: `create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount integer default 1,
  todate date,
  photo text default '',
  price numeric default 0,
  shop text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);`
  },
  {
    name: "articles",
    label: "筆記",
    sql: `create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text default '',
  category text default '',
  "newDate" date default current_date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);`
  },
  {
    name: "banks",
    label: "銀行",
    sql: `create table if not exists public.banks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  deposit numeric default 0,
  site text default '',
  withdrawals integer default 0,
  transfer integer default 0,
  activity text default '',
  card text default '',
  account text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);`
  },
  {
    name: "routines",
    label: "例行事項",
    sql: `create table if not exists public.routines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  note text default '',
  lastdate1 date,
  lastdate2 date,
  lastdate3 date,
  link text default '',
  photo text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);`
  },
  {
    name: "common_accounts",
    label: "常用帳號",
    sql: `create table if not exists public.common_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sites jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);`
  },
  {
    name: "media_items",
    label: "媒體",
    sql: `create table if not exists public.media_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null,
  url text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);`
  },
  {
    name: "finance_watch",
    label: "金融追蹤",
    sql: `create table if not exists public.finance_watch (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  symbol text default '',
  value text default '',
  note text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);`
  }
];

export const createNhostTablesSql = `${nhostTableSchemas.map((schema) => schema.sql).join("\n\n")}

comment on table public.subscriptions is 'FengBro subscriptions';
comment on table public.foods is 'FengBro food inventory';
comment on table public.articles is 'FengBro notes';
comment on table public.banks is 'FengBro bank records';
comment on table public.routines is 'FengBro routines';
comment on table public.common_accounts is 'FengBro common accounts';
comment on table public.media_items is 'FengBro media library';
comment on table public.finance_watch is 'FengBro finance watchlist';`;

