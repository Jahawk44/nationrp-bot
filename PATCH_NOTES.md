# ATLAS Patch Notes — Balance & Bug Fix Pass

## Files changed

| File | Status |
|------|--------|
| `src/utils/helpers.js` | Rewritten |
| `src/commands/atlas/economy.js` | Rewritten |
| `src/commands/atlas/action.js` | Rewritten |
| `src/scheduler.js` | Rewritten |

---

## Critical bug fixes

### 1. Duplicate stat columns (attr_* vs stat_*)
**Problem:** The DB had both `attr_str/mot/men/int/wis/cha` (new) and `stat_str/mot/men/int/wis/cha` (old, stuck at 8/8/8/8/10/10). Character creation was writing to `attr_*` correctly, but the `stat_*` columns were never removed, causing confusion in any code that read the wrong set.

**Fix (helpers.js → `initDB`):** On boot, any user row where `attr_*` is still at the new default (10) but `stat_*` has been customized is automatically migrated: `attr_* = stat_*`. This is idempotent — safe to run every boot.

### 2. Duplicate population columns (pop_common vs pop_commoners)
**Problem:** The old schema had `pop_common`; migrations added `pop_commoners`. Growth was writing to one, commands were reading the other.

**Fix (helpers.js → `initDB`):** On boot, copies `pop_common → pop_commoners` for any row where they differ.

### 3. Orphaned buildings (town IDs 2, 4, 5 missing)
**Problem:** Buildings referenced town IDs that no longer exist. These were producing phantom resources or crashing JOIN queries.

**Fix (helpers.js → `initDB`):** On boot, `DELETE FROM buildings WHERE town_id NOT IN (SELECT id FROM towns)` cleans all orphans.

### 4. Military maintenance never charged
**Problem:** `mil_maintenance_cost` was set to 0 for all rows even when `pop_soldiers > 0`. Soldiers were free to maintain indefinitely.

**Fix (helpers.js → `initDB` + scheduler.js):**
- `initDB` now sets `mil_maintenance_cost = pop_soldiers` for any row where soldiers > 0 but cost is 0.
- `handleRecruit` (action.js) now increments `mil_maintenance_cost` by the number of soldiers recruited.
- The daily scheduler now deducts maintenance from `food_surplus`. If food runs out, soldiers desert proportionally and stability takes -1.

---

## Balance fixes

### 5. Stability multiplier — soft curve replaces zero-floor
**Old formula:** `stabMult = (rate_stab + 10) / 20`
- At default +10: gives 1.0 (no upside ever, new players already at ceiling)
- At -10: gives 0.0 (total production wipe — unrecoverable)

**New formula (helpers.js → `calcStabMultiplier`):**
```
stabMult = 0.30 + ((rate_stab + 10) * 0.05)
```
| rate_stab | Old mult | New mult |
|-----------|----------|----------|
| +10 (max) | 1.00     | **1.30** |
|  0 (neutral) | 0.50  | **0.75** |
| −5 (danger)  | 0.25  | **0.55** |
| −10 (floor)  | 0.00  | **0.30** |

Players now have a meaningful **+30% upside** for maintaining high stability, and a **30% floor** instead of total wipe.

### 6. Noble generation delayed until 200 commoners
**Old behavior:** 100-pop starting town immediately generates 2 nobles who demand Vitale on day one. New players have no Vitale income → instant -2 stab, -3 prestige.

**New behavior (helpers.js → `calcNobleState`):** Nobles don't appear until population reaches 200. Below that, `nobles = 0` and no Vitale demand fires.

### 7. Grace period for new players (3 tax ticks)
**New column:** `tax_count INTEGER DEFAULT 0` (added via migration in `initDB`).

**New behavior:** For the first 3 tax collections, noble penalties and Vitale deficit penalties are suppressed even if Vitale is short. A "Grace Period — N ticks remaining" message shows in the population report so players understand the window.

### 8. Character stats now feed the macro game
New exported function: `getCharBonuses(user)` in helpers.js.

| Stat | Macro effect |
|------|-------------|
| STR mod | Reduces military maintenance cost by 1% per point (capped 30%) |
| MEN mod | Added to scout offense roll (shown in roll breakdown) |
| INT mod | +2% wealth production per point above 0 |
| WIS mod | +2% food production per point above 0 |
| CHA mod | Reserved for future faction relation system |
| MOT mod | Reserved for future build-timer reduction |

These bonuses are applied automatically in `handleTax` and `handleScout`. No code changes needed elsewhere — just use `getCharBonuses(user)`.

### 9. Tiered scout reveal
**Old behavior:** Success = dump everything; failure = nothing.

**New behavior (action.js → `handleScout`):**
- Roll margin < 5 above DC → partial reveal (building count only, names hidden)
- Roll margin ≥ 5 above DC → full reveal (all building names and details)
- MEN mod added to roll and shown in the breakdown

---

## UX improvements

### 10. Pre-crisis warning banners
New helpers: `getWarningLevel(rateStab, ratePrest)` and `formatWarningBanner(...)`.

- 🟡 Yellow warning appears in tax and census embeds when `rate_stab ≤ -2` or `rate_prest ≤ -1`
- 🔴 Red danger banner when `rate_stab ≤ -5` or `rate_prest ≤ -3`
- Embed color changes to match severity

### 11. Servus risk shown in `/atlas balance`
The balance embed now shows the Servus stability drain and adds a "⚠️ Rebellion risk" note if the drain puts stability in danger territory.

---

## Deployment steps

1. **Copy the 4 patched files** into their respective directories:
   - `helpers.js` → `src/utils/helpers.js`
   - `economy.js` → `src/commands/atlas/economy.js`
   - `action.js`  → `src/commands/atlas/action.js`
   - `scheduler.js` → `src/scheduler.js`

2. **Run the bot once** — `initDB` will apply all 5 data fixes automatically on boot. Check the console for `[DB] FIX 1–5` messages.

3. **Verify in Discord:**
   - `/atlas profile` — stats should reflect actual choices, not 8/8/8/8/10/10
   - `/atlas tax` — multiplier breakdown should show `Stability(×1.30)` for max-stab players
   - `/atlas population` — new players should show "None yet (appear at 200 commoners)"
   - `/atlas action scout` — roll breakdown should include MEN bonus if applicable

4. **No slash command re-sync needed** — no command signatures changed.
