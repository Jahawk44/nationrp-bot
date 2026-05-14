# 🗃️ ATLAS — Archived Roadmap Tickets & Session Logs

> This file contains tickets that are **fully implemented** and removed from the active roadmap,
> plus session history logs. Do not re-implement these. Reference only.

---

## ARCHIVED SESSION LOGS

### SESSION 2 — 2026-05-11 (v1.3.0) — Antigravity / Gemini 2.5 Pro

| Ticket | Status | Notes |
|--------|--------|-------|
| **Ticket 1.1** — Constants + Schema | ✅ DONE | Akha removed. Tora added (lore pending). `house` field on all ancestries. `GREAT_HOUSES`, `VITALE_FREE_HOUSES`, `PLAYER_RANKS` exported. Gagoon→Caossa, Cellesela→Sellesela everywhere. |
| **Ticket 1.2** — New Buildings | ✅ DONE | Mine, Deep Mine, Furnace, Smeltery, Exotic Workshop added to `constants.js` with `ore_consumption`, `metallurgy_prod`, `exotic_prod` fields. |
| **Ticket 2.1** — Economy Rewrite | ✅ DONE | Metallurgy + Exotics in tax production loop. Caossa ancestry bonus (+30% met, +20% ore). Rank-aware Vitale (Sovereigns pay, others see info only). Ore consumption from Furnace/Smeltery. `getPlayerRank`, `isVitaleFree`, `getNotificationChannel` added to `helpers.js`. New columns migrated via `initDB`. |
| **Bug Fixes (v1.3.0)** | ✅ DONE | Leaderboard deferUpdate. Username persisted on every command. Autocomplete shows CharacterName (discorduser). Turn notification → `#main-hall` (1502560573710270555). Roll GUI ephemeral + public result. Player-only lock on Roll Oracle (userId encoded in customId). LVL/XP/AC/HP removed from profile and audit. Profile now shows Rank + Great House color. Mercs_temp wipe in scheduler. |

**Files changed in this session:**
- `src/data/constants.js` — Full rewrite
- `src/utils/helpers.js` — New helpers + migrations
- `src/commands/atlas/economy.js` — Metallurgy/Exotics, rank-aware Vitale
- `src/commands/atlas/character.js` — Profile redesign
- `src/commands/atlas/action.js` — Roll GUI player lock
- `src/commands/atlas.js` — Roll ephemeral, leaderboard deferUpdate
- `src/events/interactionCreate.js` — Username persistence, autocomplete
- `src/scheduler.js` — Main hall notification, mercs_temp wipe
- `changelog.md` — v1.3.0 entry

---

### SESSION 1 — 2026-05-10 (v1.2.x) — Gemini Flash

Implemented: DB migration block in `helpers.js`, `calcNobleState`, `calcStabMultiplier`, `getCharBonuses`, stability soft curve, noble grace period (3 ticks), military maintenance deduction, servus drain, warning banners, new buildings constants (stab_bonus, food_cost, pop_cap_bonus fields), economy tax split into 2 embeds.

Broke / removed by mistake (fixed in Session 2): Username autocomplete, LVL/XP/AC removal, leaderboard button, turn notification channel.

---

## ARCHIVED TICKET 1.1 — Tora Ancestry, Rank System, New DB Columns

**Status: ✅ DONE 2026-05-11**

Full prompt and self-verify checklist preserved here for reference. Implementation is in:
- `src/data/constants.js` — ANCESTRIES, GREAT_HOUSES, VITALE_FREE_HOUSES, PLAYER_RANKS
- `src/utils/helpers.js` — getPlayerRank, isVitaleFree, getNotificationChannel, initDB migrations

Key migrations added:
```sql
ALTER TABLE users ADD COLUMN player_rank TEXT DEFAULT 'SCION'
ALTER TABLE users ADD COLUMN great_house TEXT DEFAULT NULL
ALTER TABLE users ADD COLUMN metallurgy INTEGER DEFAULT 0
ALTER TABLE users ADD COLUMN mercs_temp INTEGER DEFAULT 0
ALTER TABLE users ADD COLUMN trade_route_slots INTEGER DEFAULT 3
ALTER TABLE users ADD COLUMN custom_title TEXT DEFAULT NULL
ALTER TABLE users ADD COLUMN notification_channel TEXT DEFAULT NULL
ALTER TABLE users ADD COLUMN tax_count INTEGER DEFAULT 0
```

---

## ARCHIVED TICKET 1.2 — New Buildings

**Status: ✅ DONE 2026-05-11**

Buildings added to `src/data/constants.js`:
- MINE (tier 1, ore_prod: 30)
- DEEP_MINE (tier 2, ore_prod: 70, food_cost: 10)
- FURNACE (tier 1, ore_consumption: 50, metallurgy_prod: 10)
- SMELTERY (tier 2, ore_consumption: 80, metallurgy_prod: 20)
- EXOTIC_WORKSHOP (tier 1, exotic_prod: 2, stab_bonus: 1)

---

## ARCHIVED TICKET 2.1 — handleTax, handlePopulation, handleBalance Rewrite

**Status: ✅ DONE 2026-05-11**

Full production loop implemented in `src/commands/atlas/economy.js`:
- Metallurgy and Exotics tracked and stored
- Caossa ancestry bonus (+30% met, +20% ore) applied before stab multiplier
- Rank-aware Vitale: only SOVEREIGN pays; SCION/DOMINAR see informational text only
- Ore consumption can go negative in embed (stored as MAX(0,...) in DB)
- Single DB UPDATE per tax call
- handleBalance shows metallurgy row

---

## ARCHIVED KNOWN BUGS — All Fixed

| Bug | Fix Applied |
|-----|-------------|
| Leaderboard `lb` button missing `deferUpdate()` | ✅ Fixed in atlas.js |
| Gagoon in FACTIONS array | ✅ Renamed to Caossa |
| `stat_*` vs `attr_*` column drift | ✅ Patched in helpers.js initDB |
| Orphaned buildings | ✅ Patched in helpers.js initDB |
| Username not saved for autocomplete | ✅ Fixed in interactionCreate.js |
| Turn notification going to wrong channel | ✅ Now goes to #main-hall |
| Roll GUI not player-locked | ✅ Fixed in action.js |
| LVL/XP/AC/HP showing in profile | ✅ Removed from character.js |

---

*Archive last updated: 2026-05-11 (Session 3)*
