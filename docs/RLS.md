# Row Level Security

This document maps every table, every policy, and explains how to verify
that the database itself rejects cross-wallet access.

## The claim that drives every policy

After a successful SIWE sign-in, the Edge Function creates (or updates) the
authenticated user with `app_metadata.wallet_address = <lower(address)>`.
Supabase signs that into the JWT, where it appears at:

```
auth.jwt() -> 'app_metadata' ->> 'wallet_address'
```

We expose a stable, typed helper:

```sql
create or replace function public.current_wallet()
returns text language sql stable as $$
  select lower(coalesce(
    auth.jwt() ->> 'wallet_address',
    auth.jwt() -> 'app_metadata' ->> 'wallet_address'
  ))
$$;
```

Every policy compares its row to `public.current_wallet()`. Because the JWT
is signed with the project's JWT secret, a stolen anon key cannot forge it.

## Tables and policies

### `profiles` (one row per wallet)

| Operation | Policy | Predicate |
| --- | --- | --- |
| `SELECT` | `profiles_select_own` | `wallet_address = current_wallet()` |
| `INSERT` | `profiles_insert_own` | `WITH CHECK (wallet_address = current_wallet())` |
| `UPDATE` | `profiles_update_own` | both `USING` and `WITH CHECK` clauses |
| `DELETE` | (none) | nobody can delete profiles |

### `transactions` (append-only history)

| Operation | Policy | Predicate |
| --- | --- | --- |
| `SELECT` | `tx_select_own` | `wallet_address = current_wallet()` |
| `INSERT` | `tx_insert_own` | `WITH CHECK (wallet_address = current_wallet())` |
| `UPDATE` | `tx_update_own` | restricted to `status`, `block_number`, `gas_used` columns via `GRANT UPDATE (...)` to `authenticated` |
| `DELETE` | (none) | append-only |

The column-level grant is critical: the policy alone permits `UPDATE`, but
without the column grant the user cannot rewrite `wallet_address`,
`tx_hash`, `counterparty`, `amount`, or `direction`. History stays
tamper-evident.

### `address_book`

| Operation | Policy | Predicate |
| --- | --- | --- |
| `ALL` (CRUD) | `ab_modify_own` | `wallet_address = current_wallet()` (USING & WITH CHECK) |

A single `FOR ALL` policy is fine here because users *should* be able to
delete their own contacts.

## What an attacker with the anon key can do

Test it yourself:

```bash
curl -s "$SUPABASE_URL/rest/v1/transactions?select=*" \
     -H "apikey: $ANON_KEY" \
     -H "Authorization: Bearer $ANON_KEY"
# → []   (RLS denies the read)

curl -s "$SUPABASE_URL/rest/v1/transactions" \
     -H "apikey: $ANON_KEY" \
     -H "Authorization: Bearer $ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{"wallet_address":"0x000…","tx_hash":"0x…","chain_id":1, ...}'
# → {"code":"42501","message":"new row violates row-level security policy ..."}
```

The same calls with a freshly-issued user JWT succeed only when
`wallet_address` matches the JWT's `wallet_address` claim.

## Cross-wallet test

Sign in as wallet A, insert a tx, then sign in as wallet B and try to read
or update wallet A's row. RLS rejects both — the row is invisible.

```sql
-- as wallet A:
select set_config('request.jwt.claims',
                  '{"role":"authenticated","app_metadata":{"wallet_address":"0xaaa…"}}',
                  true);
insert into transactions (wallet_address, tx_hash, chain_id, direction,
                          counterparty, amount, asset_symbol)
values ('0xaaa…', '0x' || repeat('a',64), 11155111, 'out',
        '0xbbb…', '0.01', 'ETH');

-- as wallet B:
select set_config('request.jwt.claims',
                  '{"role":"authenticated","app_metadata":{"wallet_address":"0xbbb…"}}',
                  true);
select * from transactions;             -- → 0 rows
update transactions set status='confirmed' where wallet_address='0xaaa…'; -- → 0 rows
```

## Common mistakes (and how to avoid them)

### "RLS is enabled but everything is visible"

You probably forgot `revoke select on … from anon` or the table has a
permissive policy you didn't expect. Run:

```sql
select tablename, rowsecurity
  from pg_tables
 where schemaname = 'public'
   and tablename in ('profiles','transactions','address_book');
-- expect rowsecurity = true on each.

select polname, polrelid::regclass, polcmd, pg_get_expr(polqual, polrelid) as using
  from pg_policy
 where polrelid::regclass::text in ('public.profiles','public.transactions','public.address_book');
```

### "Anon writes succeed"

The anon role bypasses RLS only on tables for which RLS is **not** enabled.
Make sure `alter table … enable row level security;` ran for every table.
Supabase additionally lets you `force row level security` to be paranoid:

```sql
alter table public.transactions force row level security;
```

### "Service-role key in the browser"

Don't. The service-role key bypasses RLS by design. Only use it inside Edge
Functions or trusted server contexts, never `config.js`.

## Extending the model

Add a new table:

```sql
create table public.notifications (
  id bigserial primary key,
  wallet_address text not null check (wallet_address = lower(wallet_address)),
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
create policy notif_select_own on public.notifications
  for select using (wallet_address = public.current_wallet());
create policy notif_insert_own on public.notifications
  for insert with check (wallet_address = public.current_wallet());
create policy notif_update_own on public.notifications
  for update using (wallet_address = public.current_wallet())
  with check    (wallet_address = public.current_wallet());
```

That is the entire pattern: one helper, one predicate per operation, no
shortcuts.
