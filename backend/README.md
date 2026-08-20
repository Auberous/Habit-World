# EverWorld — Backend

Not yet provisioned. This documents the intended schema so either Firebase
(Firestore) or Supabase (Postgres) can be stood up against it — pick one
when you're ready to wire up auth/sync; the shape below works for either.

## Why a backend at all

Everything computed by `src/engine/habitEngine.js` is derived from habit
logs, so the backend's only job is durable storage + sync across devices:
it stores raw logs and profile data, never precomputed world state (that's
always recomputed client-side from logs, so the engine stays the single
source of truth and nothing can drift out of sync with it).

## Collections / Tables

### `users`
| field | type | notes |
|---|---|---|
| id | string (uid) | auth-provided |
| createdAt | timestamp | |
| displayName | string | optional |
| selectedHabits | array\<HabitDefinition\> | see shared/config/habits.json shape — 1-6 entries |

### `habitLogs`
| field | type | notes |
|---|---|---|
| id | string | |
| userId | string | fk -> users.id |
| habitId | string | matches an id in selectedHabits |
| date | string (ISO yyyy-mm-dd) | one log per habit per day (upsert on conflict) |
| loggedAt | timestamp | server time, for streak/decay calculations |

### `worldStateCache` (optional)
| field | type | notes |
|---|---|---|
| userId | string | pk |
| lastComputedState | json | cached output of computeWorldState(), for fast cold-start render before a fresh recompute finishes |
| computedAt | timestamp | |

This table is a pure performance cache, safe to delete and regenerate at
any time — never treat it as authoritative.

## Sync flow

1. App logs a habit completion -> writes one `habitLogs` row (offline-first;
   queue locally if offline, flush on reconnect).
2. On read, app fetches all `habitLogs` for the signed-in user (paginated
   by date range — only the last ~60 days matter for decay/streak math)
   and recomputes world state locally via `habitEngine.js`.
3. Optionally writes the fresh result to `worldStateCache` so the next cold
   start can render immediately while the authoritative recompute runs in
   the background.

## Firebase-specific notes
- Firestore security rules: a user may only read/write documents where
  `userId == request.auth.uid`.
- Use a Cloud Function on `habitLogs` writes only if you later want
  server-side push notifications ("your world is thriving!") — not needed
  for the core loop.

## Supabase-specific notes
- Same three tables as plain Postgres tables; enable Row Level Security
  with a policy mirroring the Firestore rule above.
- Realtime subscriptions on `habitLogs` give you free multi-device sync
  without extra plumbing.
