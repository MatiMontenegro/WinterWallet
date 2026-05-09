-- =============================================================================
-- WinterWallet — Postgres schema with Row Level Security
-- =============================================================================
--
-- Apply with the Supabase SQL editor or `supabase db push`.
--
-- AUTH MODEL
-- ----------
-- Every signed-in user has a `wallet_address` JWT claim, set by the
-- `siwe-verify` Edge Function after verifying an EIP-4361 (Sign-In With
-- Ethereum) message. Two equally valid ways to read it from RLS:
--   1. (auth.jwt() ->> 'wallet_address')                   — direct claim
--   2. (auth.jwt() -> 'app_metadata' ->> 'wallet_address') — when stored
--      under app_metadata (which is the case for users created with
--      auth.admin.createUser({ app_metadata: { wallet_address } })).
--
-- We expose a stable helper so policies stay readable.

-- -----------------------------------------------------------------------------
-- Helper: extract the active wallet from the JWT (lowercased, normalised)
-- -----------------------------------------------------------------------------
create or replace function public.current_wallet()
returns text
language sql
stable
as $$
  select lower(coalesce(
    auth.jwt() ->> 'wallet_address',
    auth.jwt() -> 'app_metadata' ->> 'wallet_address'
  ))
$$;

comment on function public.current_wallet() is
  'Lowercased Ethereum address of the currently authenticated user, sourced from JWT claims set by the siwe-verify Edge Function.';

-- -----------------------------------------------------------------------------
-- profiles — one row per wallet (display name, settings)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  wallet_address  text primary key
                  check (wallet_address = lower(wallet_address)
                         and wallet_address ~ '^0x[0-9a-f]{40}$'),
  display_name    text,
  default_chain_id integer,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- transactions — append-only history
-- -----------------------------------------------------------------------------
create table if not exists public.transactions (
  id              bigserial primary key,
  wallet_address  text not null
                  check (wallet_address = lower(wallet_address)
                         and wallet_address ~ '^0x[0-9a-f]{40}$'),
  tx_hash         text not null
                  check (tx_hash ~ '^0x[0-9a-fA-F]{64}$'),
  chain_id        integer not null,
  direction       text not null check (direction in ('in', 'out')),
  counterparty    text not null
                  check (counterparty ~ '^0x[0-9a-fA-F]{40}$'),
  -- Stored as text so uint256 values fit losslessly. The JS client formats
  -- to a human-readable decimal string before insert.
  amount          text not null,
  asset_symbol    text not null,
  asset_address   text,                           -- null for native asset
  status          text not null default 'pending'
                  check (status in ('pending', 'confirmed', 'reverted')),
  block_number    bigint,
  gas_used        numeric(78, 0),
  created_at      timestamptz not null default now(),

  unique (wallet_address, tx_hash, chain_id)
);

create index if not exists transactions_wallet_chain_idx
  on public.transactions (wallet_address, chain_id, created_at desc);

-- -----------------------------------------------------------------------------
-- address_book — per-wallet contact list
-- -----------------------------------------------------------------------------
create table if not exists public.address_book (
  id              bigserial primary key,
  wallet_address  text not null
                  check (wallet_address = lower(wallet_address)
                         and wallet_address ~ '^0x[0-9a-f]{40}$'),
  label           text not null,
  contact_address text not null
                  check (contact_address ~ '^0x[0-9a-fA-F]{40}$'),
  chain_id        integer,
  notes           text,
  created_at      timestamptz not null default now(),
  unique (wallet_address, contact_address, chain_id)
);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
-- Without RLS, the anon key shipped to the browser would expose every row.
-- With these policies, Postgres itself rejects any read or write that does
-- not belong to the signed-in wallet. The anon key cannot bypass them.

alter table public.profiles      enable row level security;
alter table public.transactions  enable row level security;
alter table public.address_book  enable row level security;

-- ---- profiles ---------------------------------------------------------------
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (wallet_address = public.current_wallet());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert with check (wallet_address = public.current_wallet());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (wallet_address = public.current_wallet())
  with check    (wallet_address = public.current_wallet());

-- profiles intentionally has no DELETE policy; users cannot delete their row.

-- ---- transactions -----------------------------------------------------------
drop policy if exists tx_select_own on public.transactions;
create policy tx_select_own on public.transactions
  for select using (wallet_address = public.current_wallet());

drop policy if exists tx_insert_own on public.transactions;
create policy tx_insert_own on public.transactions
  for insert with check (wallet_address = public.current_wallet());

-- Updates restricted to status / receipt fields only. Other columns are
-- protected via column grants below.
drop policy if exists tx_update_own on public.transactions;
create policy tx_update_own on public.transactions
  for update using (wallet_address = public.current_wallet())
  with check    (wallet_address = public.current_wallet());

-- transactions are append-only history — no DELETE policy.

-- ---- address_book -----------------------------------------------------------
drop policy if exists ab_select_own on public.address_book;
create policy ab_select_own on public.address_book
  for select using (wallet_address = public.current_wallet());

drop policy if exists ab_modify_own on public.address_book;
create policy ab_modify_own on public.address_book
  for all using (wallet_address = public.current_wallet())
  with check (wallet_address = public.current_wallet());

-- =============================================================================
-- COLUMN-LEVEL HARDENING
-- =============================================================================
-- Limit which columns the `authenticated` role can update on `transactions`.
-- The wallet should only ever upgrade pending → confirmed/reverted, never
-- rewrite history.

revoke update on public.transactions from authenticated;
grant  update (status, block_number, gas_used) on public.transactions to authenticated;

-- =============================================================================
-- AUTO-PROVISION PROFILE ON FIRST SIGN-IN
-- =============================================================================
-- Triggered after the SIWE Edge Function creates the auth.users row.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wa text;
begin
  wa := lower(coalesce(
    new.raw_app_meta_data ->> 'wallet_address',
    new.raw_user_meta_data ->> 'wallet_address'
  ));
  if wa is not null then
    insert into public.profiles (wallet_address)
    values (wa)
    on conflict (wallet_address) do nothing;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- VERIFICATION — run after applying to confirm RLS is on
-- =============================================================================
-- select tablename, rowsecurity
--   from pg_tables
--  where schemaname = 'public';
--
-- Expect rowsecurity = true for profiles, transactions, address_book.
