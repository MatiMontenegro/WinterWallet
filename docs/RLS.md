# Row Level Security

The schema in [`supabase/schema.sql`](../supabase/schema.sql) enables RLS
on every public table. Postgres itself — not the browser, not the
application code — enforces who can read or write what.

## The claim that drives every policy

After a successful Supabase Auth login (email/password, magic link, or
the SIWE Edge Function path), the session JWT carries the user's `auth.uid()`.
That's what every policy compares against.

```sql
auth.uid()        -- the authenticated Supabase user id (UUID)
```

## Tables and policies

### `profiles` (1 row per user)

| Operation | Predicate |
| --- | --- |
| `SELECT` | `user_id = auth.uid()` |
| `UPDATE` | `user_id = auth.uid()` (USING + WITH CHECK) |
| `INSERT` | **no user policy** — only the `handle_new_user` trigger (SECURITY DEFINER) inserts |
| `DELETE` | **no policy** — profiles cannot be deleted by users |

### `wallets` (many per user)

| Operation | Predicate |
| --- | --- |
| `SELECT` | `user_id = auth.uid()` |
| `ALL`    | `user_id = auth.uid()` (a single `FOR ALL` policy for CRUD) |

A partial unique index `wallets_one_primary` enforces at most one
`is_primary = true` row per user.

### `transactions` (append-only history)

| Operation | Predicate |
| --- | --- |
| `SELECT` | `user_id = auth.uid()` |
| `INSERT` | `user_id = auth.uid()` (`WITH CHECK`) |
| `UPDATE` | `user_id = auth.uid()` *but* `GRANT UPDATE (status, block_number, gas_used) ONLY` |
| `DELETE` | **no policy** — history is immutable |

The column-level grant matters. Without it, users could rewrite
`counterparty` or `amount` on their own rows. With it, the only
columns mutable post-broadcast are the receipt fields.

### `commissions` (operator revenue ledger)

| Operation | Predicate |
| --- | --- |
| `SELECT` | **`false`** — denies all reads from `authenticated` / `anon` |
| writes   | **no policy** — only the service-role key (Edge Function / cron) can write |

This is intentional. The `commissions` table is your private revenue
ledger. The browser-shipped anon key cannot see it under any
circumstance. Only your operator dashboard, using the service-role key
from a trusted environment, populates and reads it.

## Verifying the deny

Three independent checks. Run them after every schema change.

### 1. RLS is actually enabled

```sql
select tablename, rowsecurity from pg_tables
 where schemaname = 'public'
   and tablename in ('profiles','wallets','transactions','commissions');
```

All four must show `rowsecurity = true`. If any is `false`, an
`alter table … enable row level security;` was missed.

### 2. The anon key reads zero rows

```bash
curl -s "$SUPABASE_URL/rest/v1/transactions?select=*" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY"
# Expected: []
```

Anon writes should also fail:

```bash
curl -s "$SUPABASE_URL/rest/v1/transactions" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"00000000-0000-0000-0000-000000000000","tx_hash":"0x…","chain_id":1, …}'
# Expected: {"code":"42501","message":"new row violates row-level security policy"}
```

### 3. Cross-user isolation

Sign in as user A (browser session 1), insert a transaction. Sign in as
user B (browser session 2 — incognito), call:

```sql
select count(*) from transactions where user_id = '<user A id>';
-- Returns 0. RLS hides A's rows from B.
```

## Common mistakes (and fixes)

**RLS is on but everything is visible.**
Check `pg_policy`:

```sql
select polname, polrelid::regclass, polcmd, pg_get_expr(polqual, polrelid) using
  from pg_policy
 where polrelid::regclass::text like 'public.%';
```

Look for any policy with `using (true)` — that's an open door.

**Anon writes succeed.**
RLS only kicks in if the table has it enabled. Re-check `pg_tables` and
also consider `alter table … force row level security;` if you want
RLS even when the table owner is doing the query (paranoid mode).

**Service-role key shipped to the browser.**
Don't. The service-role key bypasses RLS by design — that's why it
exists. It belongs in Edge Function env or a server you control,
never in `VITE_*` env vars (which are baked into the browser bundle).

## Adding a new RLS-protected table

```sql
create table public.notifications (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  body        text not null,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy notif_select_own on public.notifications
  for select using (user_id = auth.uid());

create policy notif_insert_own on public.notifications
  for insert with check (user_id = auth.uid());

create policy notif_update_own on public.notifications
  for update using (user_id = auth.uid())
  with check    (user_id = auth.uid());
```

One helper, one predicate per operation. No shortcuts.
