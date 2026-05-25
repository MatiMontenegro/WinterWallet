-- =============================================================================
-- WinterWallet — Postgres schema with Row Level Security
-- =============================================================================
-- Identity model:
--   * Supabase Auth `auth.users` is the source of identity (email/password,
--     magic link, or SIWE-via-Edge-Function — all paths land here).
--   * `public.profiles` mirrors the user with a 1:1 row, auto-created by a
--     trigger on `auth.users`.
--   * `public.wallets` is many-to-one: a user may attach multiple addresses.
--   * `public.transactions` is append-only, RLS-keyed to `auth.uid()`.
--   * `public.commissions` is operator-internal: every fee taken by the
--     FeeRouter contract is recorded here for revenue dashboards.

-- ===========================================================================
-- Helpers
-- ===========================================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

-- ===========================================================================
-- profiles
-- ===========================================================================
create table if not exists public.profiles (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  email            text,
  display_name     text,
  default_chain_id integer,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Auto-provision a profile when a new auth user appears (email signup,
-- magic-link first sign-in, or SIWE-created user).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', null)
  )
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===========================================================================
-- wallets — addresses linked to a user
-- ===========================================================================
create table if not exists public.wallets (
  id            bigserial primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  address       text not null
                check (address = lower(address) and address ~ '^0x[0-9a-f]{40}$'),
  label         text,
  is_primary    boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (user_id, address)
);

create index if not exists wallets_user_idx on public.wallets (user_id);

-- Only one primary per user.
create unique index if not exists wallets_one_primary
  on public.wallets (user_id) where (is_primary);

-- ===========================================================================
-- transactions — append-only history per user
-- ===========================================================================
create table if not exists public.transactions (
  id              bigserial primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  wallet_address  text not null
                  check (wallet_address = lower(wallet_address)
                         and wallet_address ~ '^0x[0-9a-f]{40}$'),
  tx_hash         text not null
                  check (tx_hash ~ '^0x[0-9a-fA-F]{64}$'),
  chain_id        integer not null,
  direction       text not null check (direction in ('in', 'out')),
  counterparty    text not null
                  check (counterparty ~ '^0x[0-9a-fA-F]{40}$'),
  amount          text not null,                    -- decimal string
  asset_symbol    text not null,
  asset_address   text,                             -- null for native
  fee_amount      text,                             -- decimal string, null = no fee taken
  fee_bps         integer,
  fee_recipient   text,
  status          text not null default 'pending'
                  check (status in ('pending', 'confirmed', 'reverted')),
  block_number    bigint,
  gas_used        numeric(78, 0),
  created_at      timestamptz not null default now(),
  unique (user_id, tx_hash, chain_id)
);

create index if not exists transactions_user_chain_idx
  on public.transactions (user_id, chain_id, created_at desc);

-- ===========================================================================
-- commissions — operator revenue ledger
-- ===========================================================================
-- Populated by an indexer or backfilled from `Forwarded` events on the
-- FeeRouter contract. We keep it separate from `transactions` because it is
-- a *business* table — only the operator role should ever query it.
create table if not exists public.commissions (
  id              bigserial primary key,
  chain_id        integer not null,
  router_address  text not null
                  check (router_address ~ '^0x[0-9a-fA-F]{40}$'),
  tx_hash         text not null
                  check (tx_hash ~ '^0x[0-9a-fA-F]{64}$'),
  block_number    bigint not null,
  from_address    text not null,
  to_address      text not null,
  token_address   text,                             -- null = native
  asset_symbol    text,
  total_amount    text not null,                    -- decimal string
  fee_amount      text not null,
  fee_bps         integer not null,
  recorded_at     timestamptz not null default now(),
  unique (chain_id, tx_hash)
);

create index if not exists commissions_chain_idx
  on public.commissions (chain_id, recorded_at desc);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
alter table public.profiles      enable row level security;
alter table public.wallets       enable row level security;
alter table public.transactions  enable row level security;
alter table public.commissions   enable row level security;

-- ---- profiles -------------------------------------------------------------
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (user_id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (user_id = auth.uid())
  with check    (user_id = auth.uid());

-- INSERT happens only via the handle_new_user trigger (security definer);
-- regular users have no INSERT policy and therefore cannot self-create rows.

-- ---- wallets --------------------------------------------------------------
drop policy if exists wallets_select_own on public.wallets;
create policy wallets_select_own on public.wallets
  for select using (user_id = auth.uid());

drop policy if exists wallets_modify_own on public.wallets;
create policy wallets_modify_own on public.wallets
  for all using (user_id = auth.uid())
  with check    (user_id = auth.uid());

-- ---- transactions ---------------------------------------------------------
drop policy if exists tx_select_own on public.transactions;
create policy tx_select_own on public.transactions
  for select using (user_id = auth.uid());

drop policy if exists tx_insert_own on public.transactions;
create policy tx_insert_own on public.transactions
  for insert with check (user_id = auth.uid());

drop policy if exists tx_update_own on public.transactions;
create policy tx_update_own on public.transactions
  for update using (user_id = auth.uid())
  with check    (user_id = auth.uid());

-- Users can update only the post-broadcast columns. The static columns
-- (counterparty, amount, fee_*) stay tamper-evident.
revoke update on public.transactions from authenticated;
grant  update (status, block_number, gas_used) on public.transactions to authenticated;

-- ---- commissions ----------------------------------------------------------
-- Default deny: regular users see nothing. The operator reads via the
-- service-role key (which bypasses RLS) — typically from a dashboard or
-- scheduled aggregation function, never from the browser bundle.
drop policy if exists commissions_no_user on public.commissions;
create policy commissions_no_user on public.commissions
  for select using (false);

-- =============================================================================
-- Convenience views (operator-only thanks to the RLS deny above)
-- =============================================================================
create or replace view public.commission_daily as
  select
    chain_id,
    coalesce(asset_symbol, 'NATIVE') as asset_symbol,
    date_trunc('day', recorded_at)   as day,
    sum((fee_amount)::numeric)       as total_fee,
    count(*)                         as tx_count
  from public.commissions
  group by 1, 2, 3
  order by 3 desc;

-- =============================================================================
-- Verification — run after applying
-- =============================================================================
-- select tablename, rowsecurity from pg_tables
--  where schemaname='public'
--    and tablename in ('profiles','wallets','transactions','commissions');
-- All four rows should show rowsecurity = true.
