# 🏛️ ATLAS — Claude Design Roadmap v3.1 · Part 2
**All confirmed answers · Full implementation prompts · Army type system · Everything not in Part 1**

---

## ⚡ EXECUTION INSTRUCTION FOR THE AI (DeepSeek V4 Pro / any model)

You are reading a **multi-ticket specification**. Do **not** implement everything at once.

### How to execute this document

1. **First, read the entire document** to understand dependencies, confirmed answers, and the overall order. Do not write any code yet.

2. **Then, implement tickets one by one**, in the exact order shown in the **Implementation Order** section at the bottom.  
   - After finishing one ticket, **stop** and ask the user:  
     *“Ticket X.Y complete. Self-verify checklist passed. Ready for next ticket?”*  
   - Do **not** proceed to the next ticket without confirmation.

3. **For each ticket**:
   - **Only edit the files specified** in the ticket's `FILES TO EDIT` / `DO NOT TOUCH` lists.
   - **Assume Part 1 is already fully implemented** (the user confirmed this).
   - **Use the exact function names, SQL columns, and constants** provided in the ticket.
   - **Output the code changes** (or describe them if the user asks for explanation).
   - **Run the self-verify checklist** (the `[ ]` items at the end of the ticket) and report the results.

4. **Context awareness** – The user will have their existing codebase open in the IDE. If you need to see the current state of a file (e.g., `economy.js`), ask the user to share it or rely on the IDE’s context. Do **not** hallucinate missing code.

5. **Preserve all planning detail** – The long tables, confirmed answers, army system, production loop steps, and exact multiplier values are **not** optional. They are the “strength of Sonnet” – treat them as immutable specifications.

6. **If a ticket references a LOREBOOK PENDING item**, implement the **stub behaviour** described (e.g., show “⚠️ Coming soon” in GUI). Do not invent lore text.

7. **Never auto-apply GM-only effects** (e.g., Atomic Guild low‑relation notifications are just GM alerts, no auto‑damage).

---

> **This document supersedes any placeholder or ⚠️ CONFIRM note in Part 1.**
> All answers confirmed by Suns are applied here. LOREBOOK PENDING items are clearly marked and must not have flavor text written until lorebook.md is complete.
>
> **Quick answer index:**
> Q1 Embargo = -20 · Q5 Army types = Infantry/Cavalry/Ranged/Siege · Q6 Akha = Removed ·
> Q10 Mercenary text = confirmed below · Q11 Atomic Guild = all rolls ·
> Q12 NPC route text = brief, confirmed below · Q13 Event text = brief, confirmed below ·
> Q15 Prestige loss = permanent, recoverable only via events/choices

---

## CONFIRMED ANSWERS REFERENCE

| # | Question | Answer |
|---|----------|--------|
| Q1 | Vitale embargo threshold | **-20** Tyrannite relation score |
| Q2 | Rhagaia mechanic | **LOREBOOK PENDING** |
| Q3 | Cellesela mechanic | **LOREBOOK PENDING** |
| Q4 | Gaius mechanic | **LOREBOOK PENDING** |
| Q5 | Army types | **Infantry / Cavalry / Ranged / Siege** — see army system below |
| Q6 | Akha ancestry | **Removed** from character creation entirely |
| Q7 | Tora description | **LOREBOOK PENDING** |
| Q8 | Song/Linerian descriptions | **LOREBOOK PENDING** |
| Q9 | Mercenary description | Confirmed — see below |
| Q10 | Atomic Guild INT/WIS bonus | Applies to **all rolls** |
| Q11 | NPC trade route text | Brief, confirmed — see Ticket 4.1 |
| Q12 | GM event narrative text | Brief, confirmed — see Ticket 3.2 |
| Q13 | Rhagaia/Cellesela/Gaius/Fathers/Mothers lore text | **LOREBOOK PENDING** |
| Q14 | Prestige loss recovery | **Permanent** — only recoverable via GM events or player choices, never automatically |

### Confirmed: Mercenary Description
> *"Soldiers-for-hire drawn from various lands and backgrounds, bound by coin rather than loyalty. They fight effectively but disband at the end of each Imperial turn."*

---

## CONFIRMED ARMY TYPE SYSTEM

Replaces the old `mil_strength` blob with four distinct unit types. Each has a combat role, cost, building requirement, and food upkeep. Inspired by balanced wargame systems (Total War, PF2e mass combat, Dominions).

### Unit Definitions

| Type | Emoji | Balance Cost | Met Cost | Requires | Food/unit/day | Notes |
|------|-------|-------------|----------|----------|---------------|-------|
| **Infantry** | ⚔️ | 50🪙 | 0 | Nothing | 1 | Core melee. Reliable, cheap. |
| **Cavalry** | 🐎 | 150🪙 | 0 | Barracks | 2 | Fast flankers. Bonus vs Ranged. |
| **Ranged** | 🏹 | 80🪙 | 0 | Barracks | 1 | Bonus vs Infantry. Weak vs Cavalry. |
| **Siege** | 🪨 | 500🪙 | 5🔩 | Castle | 3 | Siege offense only. Useless in field. |
| **Mercenary** | 🗡️ | 500🪙 | 0 | Nothing | 1 | Any type (default Infantry). Expires weekly. |

### Combat Power Multipliers

```
FIELD BATTLE:
  Infantry  × 1.0  (baseline)
  Cavalry   × 1.5  (speed, flanking)
  Ranged    × 1.0  (effective at distance, matched strength in melee)
  Siege     × 0.0  (too slow for open field — contributes nothing)
  Mercs     × 1.0  (treated as Infantry)

SIEGE OFFENSE (attacker):
  Infantry  × 1.0
  Cavalry   × 0.8  (difficult to maneuver near walls)
  Ranged    × 1.0
  Siege     × 2.0  (catapults, rams, ballistas — dominant in sieges)
  Mercs     × 1.0

SIEGE DEFENSE (defender):
  Infantry  × 1.0
  Cavalry   × 0.8
  Ranged    × 1.2  (elevated position bonus)
  Siege     × 0.5  (siege engines repurposed for defense)
  Mercs     × 1.0
```

### Counter-Interaction Bonuses (Field Battle Only)

| Situation | Bonus |
|-----------|-------|
| Attacker has Cavalry AND defender is majority Ranged | +5 attack |
| Attacker has Ranged AND defender is majority Infantry | +3 attack |

### Ancestry Combat Bonuses

| Ancestry | Bonus | Condition |
|----------|-------|-----------|
| Polysia-Estuarin / Polysia-Riparian | +10 attack roll | Only if `mil_cavalry > 0` |
| Any Styx-house ancestry (Tyrannite/Rhagaia/Cellesela/Gaius/Caossa) | +8 defense in siege | Always |

### Maintenance Formula
```
mil_maintenance_cost = (mil_infantry × 1) + (mil_cavalry × 2) + (mil_ranged × 1) + (mil_siege × 3)
```
Charged **daily by scheduler only**. Never deducted in `handleTax`.

### New DB Columns Required
```sql
mil_infantry INTEGER DEFAULT 0
mil_cavalry  INTEGER DEFAULT 0
mil_ranged   INTEGER DEFAULT 0
mil_siege    INTEGER DEFAULT 0
-- mil_strength kept as computed total for leaderboard; updated on recruit/casualties
-- mercs_temp already planned in Ticket 1.1
```

### Prestige Loss: Permanent (Q14)
Field battle prestige penalties do **not** recover automatically over time. They can only be increased again through:
- GM events (e.g. `imperial_favor`, `harvest` bonus)
- Winning a future battle or siege
- Specific player choices in story embed events

No passive prestige regeneration in the scheduler.

---

## PHASE 1 — CONSTANTS & SCHEMA

### TICKET 1.1 — Tora, Rank System, Army Columns, New DB Columns
**Model:** 🟢 Haiku 4.5 | Ready to implement (Q6 confirmed: remove Akha)

**PROMPT:**
```
You are updating ATLAS bot constants and database schema. No logic changes.

FILES TO EDIT:
  src/data/constants.js   (constants only)
  src/utils/helpers.js    (migrations + helper functions only)

DO NOT TOUCH: any handler, command, or event file.

═══ TASK 1 — constants.js: Add Tora to ANCESTRIES ═══

  TORA: {
    name: 'Tora',
    bonuses: { stat_wis: 2, stat_str: 1 },
    desc: '⚠️ LOREBOOK PENDING — do not display description text',
    color: 0xC19A6B,
    emoji: '🏺',
    style: ButtonStyle.Secondary,
    house: 'CAOSSA'
  }

═══ TASK 2 — constants.js: Add 'house' field to ALL ANCESTRIES ═══

  AKHA:               house: 'REMOVED'          ← do not render this in any UI
  ALEXIANS:           house: 'INDEPENDENT'
  DAXOS:              house: 'CAOSSA'
  ELVISH:             house: 'COLONIA_FREE_TRIBE'
  INCANZIL:           house: 'RHAGAIA'
  LINERIAN:           house: 'INDEPENDENT'
  'POLYSIA-ESTUARIN': house: 'CELLESELA'
  'POLYSIA-RIPARIAN': house: 'CELLESELA'
  SCIATIC:            house: 'SCIATIC_LEAGUE'
  SONG:               house: 'INDEPENDENT'
  STYX:               house: 'TYRANNITE'
  TOLKHAI:            house: 'GAIUS'
  TORA:               house: 'CAOSSA'

═══ TASK 3 — constants.js: New constant blocks ═══

  const VITALE_FREE_HOUSES = ['INDEPENDENT', 'SCIATIC_LEAGUE', 'COLONIA_FREE_TRIBE'];

  const GREAT_HOUSES = {
    TYRANNITE: { name: 'Tyrannite', color: 0xFF0000,  emoji: '⚔️' },
    RHAGAIA:   { name: 'Rhagaia',   color: 0xEDB2ED,  emoji: '📜' },
    CELLESELA: { name: 'Cellesela', color: 0x512E5F,  emoji: '🗿' },
    GAIUS:     { name: 'Gaius',     color: 0xC6EDB2,  emoji: '🐎' },
    CAOSSA:    { name: 'Caossa',    color: 0xFFDAB9,  emoji: '🏺' }
  };

  const PLAYER_RANKS = {
    SCION:     { name: 'Scion',     titleFormat: 'Scion of {house}' },
    DOMINAR:   { name: 'Dominar',   titleFormat: 'Dominar of {town}' },
    SOVEREIGN: { name: 'Sovereign', titleFormat: '{custom_title}' }
  };

  const ARMY_TYPES = {
    INFANTRY: { name: 'Infantry', emoji: '⚔️', cost_balance: 50,  cost_met: 0,
                food_per_unit: 1, requires: null,       field_mult: 1.0, siege_atk_mult: 1.0, siege_def_mult: 1.0 },
    CAVALRY:  { name: 'Cavalry',  emoji: '🐎', cost_balance: 150, cost_met: 0,
                food_per_unit: 2, requires: 'BARRACKS', field_mult: 1.5, siege_atk_mult: 0.8, siege_def_mult: 0.8 },
    RANGED:   { name: 'Ranged',   emoji: '🏹', cost_balance: 80,  cost_met: 0,
                food_per_unit: 1, requires: 'BARRACKS', field_mult: 1.0, siege_atk_mult: 1.0, siege_def_mult: 1.2 },
    SIEGE:    { name: 'Siege',    emoji: '🪨', cost_balance: 500, cost_met: 5,
                food_per_unit: 3, requires: 'CASTLE',  field_mult: 0.0, siege_atk_mult: 2.0, siege_def_mult: 0.5 }
  };

  // Mercenary description (confirmed Q9)
  const MERC_DESC = 'Soldiers-for-hire drawn from various lands and backgrounds, bound by coin rather than loyalty. They fight effectively but disband at the end of each Imperial turn.';

═══ TASK 4 — constants.js: Rename Gagoon → Caossa ═══
  In FACTIONS array and anywhere else in the file: replace all instances of
  'gagoon', 'Gagoon', 'GAGOON' with 'Caossa' / 'CAOSSA' as appropriate.

═══ TASK 5 — helpers.js: Add to initDB() migrations array ═══
  Add these strings at the END of the migrations array, before the console.log:

  'ALTER TABLE users ADD COLUMN player_rank TEXT DEFAULT "SCION"',
  'ALTER TABLE users ADD COLUMN great_house TEXT DEFAULT NULL',
  'ALTER TABLE users ADD COLUMN metallurgy INTEGER DEFAULT 0',
  'ALTER TABLE users ADD COLUMN mercs_temp INTEGER DEFAULT 0',
  'ALTER TABLE users ADD COLUMN trade_route_slots INTEGER DEFAULT 3',
  'ALTER TABLE users ADD COLUMN custom_title TEXT DEFAULT NULL',
  'ALTER TABLE users ADD COLUMN notification_channel TEXT DEFAULT NULL',
  'ALTER TABLE users ADD COLUMN tax_count INTEGER DEFAULT 0',
  'ALTER TABLE users ADD COLUMN mil_infantry INTEGER DEFAULT 0',
  'ALTER TABLE users ADD COLUMN mil_cavalry INTEGER DEFAULT 0',
  'ALTER TABLE users ADD COLUMN mil_ranged INTEGER DEFAULT 0',
  'ALTER TABLE users ADD COLUMN mil_siege INTEGER DEFAULT 0'

  Also add this migration for the relations bribe cooldown (needed by Ticket 6.1):
  Run as raw SQL (not ALTER TABLE, since it adds a column to a non-users table):
    try { await db.run('ALTER TABLE relations ADD COLUMN last_bribe INTEGER DEFAULT 0'); } catch(_) {}

═══ TASK 6 — helpers.js: Add and export new helper functions ═══

  function getPlayerRank(user) {
    if (user.nation || user.nation_name) return 'SOVEREIGN';
    if (user.player_rank === 'DOMINAR') return 'DOMINAR';
    return 'SCION';
  }

  function isVitaleFree(ancestryKey) {
    const { ANCESTRIES, VITALE_FREE_HOUSES } = require('../data/constants');
    const entry = ANCESTRIES[(ancestryKey || '').toUpperCase()];
    if (!entry) return true;   // unknown = subsidized by default
    return VITALE_FREE_HOUSES.includes(entry.house);
  }

  async function getNotificationChannel(client, user) {
    const id = user.notification_channel || user.last_tax_channel || process.env.ADMIN_CHANNEL_ID;
    if (!id) return null;
    try { return await client.channels.fetch(id); }
    catch (_) { return null; }
  }

  // Returns daily food maintenance cost for a user's army
  function calcMaintenance(user) {
    return ((user.mil_infantry || 0) * 1)
         + ((user.mil_cavalry  || 0) * 2)
         + ((user.mil_ranged   || 0) * 1)
         + ((user.mil_siege    || 0) * 3)
         + ((user.mercs_temp   || 0) * 1);
  }

  Export: getPlayerRank, isVitaleFree, getNotificationChannel, calcMaintenance

  Export from constants.js: VITALE_FREE_HOUSES, GREAT_HOUSES, PLAYER_RANKS, ARMY_TYPES, MERC_DESC

SELF-VERIFY:
- [ ] TORA added to ANCESTRIES with all fields
- [ ] AKHA has house: 'REMOVED' — NOT displayed anywhere
- [ ] All 13 ancestries have a house field
- [ ] Gagoon → Caossa renamed everywhere in the file
- [ ] ARMY_TYPES has all 4 entries with all multiplier fields
- [ ] 13 migrations in initDB (12 ALTER TABLE + 1 relations ALTER)
- [ ] calcMaintenance includes mercs_temp
- [ ] isVitaleFree('SCIATIC') === true, isVitaleFree('STYX') === false
- [ ] isVitaleFree('AKHA') === true (house REMOVED → not in Styx houses, defaults subsidized)
```

---

### TICKET 1.2 — New Buildings: Mine, Furnace, Smeltery, Exotic Workshop
**Model:** 🟢 Haiku 4.5 | Ready to implement

**PROMPT:**
```
You are adding new buildings to ATLAS constants.js only. No logic changes.

FILE: src/data/constants.js (BUILDINGS object only)
DO NOT TOUCH: any handler, helper, or event file.

═══ ADD to the BUILDINGS object ═══

  MINE: {
    name: 'Mine', category: 'ECONOMY', tier: 1, plots: 4, cost: 500, emoji: '⛏️',
    desc: '+30 Ores/day. Mountain/Hills terrain doubles output.',
    income_wealth: 0, food_prod: 0, food_cost: 0, ore_prod: 30,
    ore_consumption: 0, metallurgy_prod: 0, exotic_prod: 0,
    wealth_mult_bonus: 0, pop_cap_bonus: 0, stab_bonus: 0
  },
  DEEP_MINE: {
    name: 'Deep Mine', category: 'ECONOMY', tier: 2, plots: 6, cost: 1000, emoji: '🪨',
    desc: '+70 Ores/day. Mountain/Hills doubles output. Costs 10 Food/day.',
    income_wealth: 0, food_prod: 0, food_cost: 10, ore_prod: 70,
    ore_consumption: 0, metallurgy_prod: 0, exotic_prod: 0,
    wealth_mult_bonus: 0, pop_cap_bonus: 0, stab_bonus: 0,
    upgrade_from: 'MINE'
  },
  FURNACE: {
    name: 'Furnace', category: 'INDUSTRY', tier: 1, plots: 4, cost: 600, emoji: '🔥',
    desc: 'Converts 50 Ores → 10 Metallurgy/day. Costs 20 Food/day. Required for Cavalry & Siege units.',
    income_wealth: 0, food_prod: 0, food_cost: 20, ore_prod: 0,
    ore_consumption: 50, metallurgy_prod: 10, exotic_prod: 0,
    wealth_mult_bonus: 0, pop_cap_bonus: 0, stab_bonus: 0
  },
  SMELTERY: {
    name: 'Smeltery', category: 'INDUSTRY', tier: 2, plots: 6, cost: 1200, emoji: '⚙️',
    desc: 'Converts 80 Ores → 20 Metallurgy/day. Caossa ancestry produces 30 instead. Costs 30 Food/day.',
    income_wealth: 0, food_prod: 0, food_cost: 30, ore_prod: 0,
    ore_consumption: 80, metallurgy_prod: 20, exotic_prod: 0,
    wealth_mult_bonus: 0, pop_cap_bonus: 0, stab_bonus: 0,
    upgrade_from: 'FURNACE'
  },
  EXOTIC_WORKSHOP: {
    name: 'Exotic Workshop', category: 'INDUSTRY', tier: 1, plots: 3, cost: 800, emoji: '🍷',
    desc: '+2 Exotics/day. +5% wealth production. +1 Stability. Costs 10 Food/day.',
    income_wealth: 20, food_prod: 0, food_cost: 10, ore_prod: 0,
    ore_consumption: 0, metallurgy_prod: 0, exotic_prod: 2,
    wealth_mult_bonus: 0.05, pop_cap_bonus: 50, stab_bonus: 1
  }

NOTE: All existing buildings that lack ore_consumption, metallurgy_prod, exotic_prod, or
wealth_mult_bonus fields default to 0 at runtime via (bd.field || 0). No need to add these
fields to existing buildings — the production loop handles it.

SELF-VERIFY:
- [ ] All 5 buildings present with every field
- [ ] No existing buildings modified
- [ ] EXOTIC_WORKSHOP has wealth_mult_bonus: 0.05
- [ ] SMELTERY upgrade_from: 'FURNACE', DEEP_MINE upgrade_from: 'MINE'
- [ ] ore_consumption is on FURNACE and SMELTERY only, zero on others
```

---

## PHASE 2 — ECONOMY REWRITE

### TICKET 2.1 — handleTax: Full Production Loop with Army Types & Rank-Aware Vitale
**Model:** 🔴 Sonnet 4.6 extended thinking | Ready to implement

**Key rules:**
- Vitale is **never deducted and never penalizes** for Scion, Dominar, or Vitale-free ancestry. Display only.
- Military maintenance is **displayed only** in handleTax — the scheduler is the only deduction point.
- Caossa ancestry → +30% metallurgy, +20% ore.
- Exotic Workshop → +5% wealth multiplier (stacks with stability/servus/INT multipliers).

**PROMPT:**
```
You are rewriting handleTax, handlePopulation, and handleBalance in economy.js.

READ:
  src/commands/atlas/economy.js    ← rewrite these 3 functions only
  src/utils/helpers.js             ← calcStabMultiplier, getCharBonuses, calcNobleState,
                                      getPlayerRank, isVitaleFree, formatWarningBanner,
                                      getNotificationChannel, calcMaintenance
  src/data/constants.js            ← BUILDINGS, TERRAIN_MULTIPLIERS, GREAT_HOUSES,
                                      ANCESTRIES, VITALE_FREE_HOUSES, ARMY_TYPES

DO NOT TOUCH: handleDonate, handleGift, handleTrade, handleEmpire, handleButton, handleModal,
              scheduler.js, any other file.

RULE: calcMaintenance(user) in this file is for DISPLAY only. Zero food deducted here.

═══ REWRITE handleTax ═══

STEP 1 — Cooldown check (unchanged from current logic).

STEP 2 — Fetch: user row, all towns, all completed buildings per town.
  Single SELECT * per entity. No per-building SELECT loops beyond the town loop.

STEP 3 — Building production loop:
  Init: totalWealth = totalFoodProd = totalFoodCost = totalOresProd = 0
        totalOreConsume = totalMetProd = totalExoticProd = totalStabBonus = totalWealthMultBonus = 0

  For each town:
    mult = TERRAIN_MULTIPLIERS[town.terrain_type] || { food:1.0, wealth:1.0, ore:1.0 }
    For each completed building (ready_at IS NULL OR ready_at <= now):
      bd = BUILDINGS[b.type.toUpperCase()]; if (!bd) continue
      totalWealth          += (bd.income_wealth      || 0) * mult.wealth
      totalFoodProd        += (bd.food_prod          || 0) * mult.food
      totalFoodCost        += (bd.food_cost          || 0)
      totalOresProd        += (bd.ore_prod           || 0) * mult.ore
      totalOreConsume      += (bd.ore_consumption    || 0)
      totalMetProd         += (bd.metallurgy_prod    || 0)
      totalExoticProd      += (bd.exotic_prod        || 0)
      totalStabBonus       += (bd.stab_bonus         || 0)
      totalWealthMultBonus += (bd.wealth_mult_bonus  || 0)

STEP 4 — Ancestry bonuses:
  house = ANCESTRIES[(user.ancestry||'').toUpperCase()]?.house
  if (house === 'CAOSSA'):
    totalMetProd  = Math.floor(totalMetProd  * 1.3)
    totalOresProd = Math.floor(totalOresProd * 1.2)

STEP 5 — Apply multipliers:
  charBonuses = getCharBonuses(user)
  stabMult    = calcStabMultiplier(user.rate_stab)
  servusMult  = 1 + ((user.servus || 0) * 0.02)
  wealthMult  = 1 + totalWealthMultBonus    // Exotic Workshop bonus

  finalWealth  = Math.floor(totalWealth * servusMult * stabMult * charBonuses.wealthBonus * wealthMult)
  finalFoodNet = Math.floor((totalFoodProd * charBonuses.foodBonus) - totalFoodCost)
  finalOres    = totalOresProd - totalOreConsume   // can be negative
  finalMet     = Math.floor(totalMetProd * stabMult)
  finalExotics = totalExoticProd
  stabDrain    = Math.floor((user.servus || 0) / 5)

STEP 6 — Faction production bonuses (runtime check):
  // The Mothers relation ≥10: noble vitale cost halved for Sovereigns (checked in Step 7)
  const mothersRel = await db.get(
    'SELECT score FROM relations WHERE user_id=? AND faction_name=?', userId, 'The Mothers'
  );
  const mothersBonus = mothersRel?.score >= 10;

STEP 7 — Rank-aware Vitale handling:
  rank  = getPlayerRank(user)
  vFree = isVitaleFree(user.ancestry)
  { nobles, vitaleNeeded, inGracePeriod } = calcNobleState(user)

  // The Mothers bonus
  if (mothersBonus && rank === 'SOVEREIGN') vitaleNeeded = Math.ceil(vitaleNeeded / 2);

  vitaleStabPenalty = 0
  vitaleDeducted    = 0

  if (vFree || rank !== 'SOVEREIGN'):
    // INFORMATIONAL ONLY — no deduction, no penalty, ever
    vitaleText = nobles > 0
      ? `${nobles} nobles (${vitaleNeeded} 💧/tick — subsidized by Imperial Academy)`
      : `No nobles yet (population below 200)`

  else if (inGracePeriod):
    vitaleText = `${vitaleNeeded} 💧 — grace period (${3-(user.tax_count||0)} ticks left)`

  else if ((user.vitale||0) >= vitaleNeeded && nobles > 0):
    vitaleDeducted    = vitaleNeeded
    vitaleText        = `${vitaleNeeded} 💧 paid ✅`

  else if (nobles > 0):
    vitaleStabPenalty = -2
    vitaleText        = `${vitaleNeeded} 💧 ⚠️ DEFICIT (−2 Stability)`

STEP 8 — Net stability + single DB UPDATE:
  netStab = totalStabBonus - stabDrain + vitaleStabPenalty

  await db.run(`
    UPDATE users SET
      balance      = balance + 100,
      wealth       = COALESCE(wealth,0) + ?,
      food_surplus = COALESCE(food_surplus,0) + ?,
      ores         = MAX(0, COALESCE(ores,0) + ?),
      metallurgy   = COALESCE(metallurgy,0) + ?,
      exotics      = COALESCE(exotics,0) + ?,
      vitale       = COALESCE(vitale,0) - ?,
      rate_stab    = MAX(-10, MIN(10, rate_stab + ?)),
      last_tax     = ?,
      tax_count    = COALESCE(tax_count,0) + 1,
      last_tax_channel = ?,
      tax_notified = 0
    WHERE id = ?`,
    finalWealth, finalFoodNet, finalOres, finalMet, finalExotics,
    vitaleDeducted, netStab, now, channelId, userId
  );

  // Noble prestige (Sovereign only)
  if (rank === 'SOVEREIGN' && !vFree && !inGracePeriod && nobles > 0) {
    const prestChange = vitaleDeducted > 0 ? +2 : -3;
    await db.run(
      'UPDATE users SET rate_prest = MAX(-10, MIN(10, rate_prest + ?)) WHERE id = ?',
      prestChange, userId
    );
  }

STEP 9 — Atomic Guild low-relation check (at end, after UPDATE):
  const ag = await db.get(
    'SELECT score FROM relations WHERE user_id=? AND faction_name=?', userId, 'Atomic Guild'
  );
  if (ag?.score <= -20) {
    const r = Math.random();
    let gmAlert = null;
    if      (r < 0.005) gmAlert = `☠️ ASSASSINATION PLOT detected — Atomic Guild targeting ${user.username}. Review and decide.`;
    else if (r < 0.025) gmAlert = `🔗 SERVUS UPRISING RISK — Atomic Guild influence on ${user.username}. Review.`;
    else if (r < 0.075) gmAlert = `⚠️ REBEL ACTIVITY — Atomic Guild. Targeting ${user.username}.`;
    if (gmAlert) {
      const { resolveAtlasHQ } = require('../../utils/helpers');
      const { EmbedBuilder } = require('discord.js');
      await resolveAtlasHQ(interaction.client,
        new EmbedBuilder().setTitle('🔮 ATOMIC GUILD ALERT').setDescription(gmAlert).setColor(0x333333)
      );
    }
  }
  // NOTE: These are GM notifications ONLY. No auto-applied effects ever.

STEP 10 — Build and return embeds:
  updatedUser = await db.get('SELECT rate_stab, rate_prest FROM users WHERE id=?', userId)
  warnBanner  = formatWarningBanner(updatedUser.rate_stab, updatedUser.rate_prest)
  warnColor   = warnBanner?.startsWith('🔴') ? 0xFF4444 : warnBanner ? 0xFFCC00 : null

  ECON EMBED (color: warnColor || 0x00FF88, title: "📊 ECONOMIC REPORT"):
    +100 🪙 | +{finalWealth} ⚖️
    🥩 Food: {sign}{finalFoodNet}
    ⚒️ Ores: {sign}{finalOres}{finalOres<0 ? ' ⚠️ Furnace consuming more than mines produce!' : ''}
    🔩 Metallurgy: +{finalMet}
    🍷 Exotics: +{finalExotics}  (only show if > 0)
    Multipliers: Stability(×{stabMult.toFixed(2)}) · Servus(×{servusMult.toFixed(2)})
                 INT(×{charBonuses.wealthBonus.toFixed(2)}) · WIS(×{charBonuses.foodBonus.toFixed(2)})
    Army upkeep: {calcMaintenance(user)} 🥩/day (charged by daily scheduler)  ← display only
    {warnBanner if any}

  POP EMBED (color: warnColor || 0x00BFFF, title: "👥 POPULATION REPORT"):
    Rank: {rank} | House: {houseEmoji} {houseName || 'Independent'}
    Commoners: {pop_commoners} | Soldiers: {pop_soldiers}
    ⚔️ Infantry: {mil_infantry} | 🐎 Cavalry: {mil_cavalry} | 🏹 Ranged: {mil_ranged} | 🪨 Siege: {mil_siege}
    Nobles: {vitaleText}
    Servus drain: {stabDrain > 0 ? `-${stabDrain} Stability` : 'None'}
    Stability: {rate_stab}/10 | Prestige: {rate_prest}/10
    {warnBanner if any}

═══ REWRITE handlePopulation ═══
  Show: rank, house, commoners, all 4 army types + mercs, nobles + vitale display,
  famine status (food<=0 → 🔴 FAMINE), servus rebellion warning (stab-drain<=-3 → ⚠️),
  army upkeep: {calcMaintenance(user)} 🥩/day.

═══ REWRITE handleBalance ═══
  Add: 🔩 Metallurgy: {metallurgy}
  Add: Army upkeep: {calcMaintenance(user)} 🥩/day
  Add: Servus drain and rebellion warning if applicable.

SELF-VERIFY:
- [ ] Vitale never deducted for SCION, DOMINAR, or vitale-free ancestry
- [ ] Maintenance shown as informational only — no food deducted
- [ ] Single UPDATE query containing all field changes
- [ ] No XP, AC, Level references anywhere
- [ ] Caossa bonus applied before stab multiplier
- [ ] Exotic Workshop wealth_mult_bonus stacks correctly
- [ ] All 4 army types shown in pop embed
- [ ] Atomic Guild check only sends GM notification — no auto-effects
- [ ] economy.js stays under 350 lines
```

---

### TICKET 2.2 — Vitale Market Embargo (threshold confirmed: -20)
**Model:** 🟢 Haiku 4.5 | Ready to implement

**PROMPT:**
```
You are adding the Vitale market embargo to economy.js.

EDIT: src/commands/atlas/economy.js (handleEmpire and handleButton vitale_buy only)
DO NOT TOUCH: any other function or file.

CONFIRMED THRESHOLD: -20 (Tyrannite relation score)

TASK 1 — In handleEmpire, after building the embed:
  const rel = await db.get(
    'SELECT score FROM relations WHERE user_id=? AND faction_name=?',
    interaction.user.id, 'Tyrannite'
  );
  const isEmbargoed = rel ? rel.score <= -20 : false;

  If isEmbargoed:
    Button: .setDisabled(true), .setLabel('🚫 Embargoed by Styx Empire'), .setStyle(ButtonStyle.Danger)
    Add to embed footer: "Your nation has been embargoed. Seek Vitale through player trade."
  Else: normal Buy Vitale button.

TASK 2 — In handleButton vitale_buy, re-check before showing modal:
  Same query. If embargoed: safeReply ephemeral '🚫 You are currently embargoed...'

SELF-VERIFY:
- [ ] isEmbargoed defaults false when no relation row exists
- [ ] Threshold is -20 (confirmed — no env var needed)
- [ ] Player can still receive Vitale via /atlas gift even embargoed
- [ ] .setDisabled(true) on button
```

---

## PHASE 3 — GM STORY EMBED SYSTEM

### TICKET 3.1 — Story Embed GUI
**Model:** 🔴 Sonnet 4.6 extended thinking | Ready to implement

**Note:** The Atomic Guild high-relation bonus (+max(INT mod, WIS mod)) applies to ALL rolls including story rolls (Q10 confirmed). This is applied in handleStoryRoll.

**PROMPT:**
```
You are building the GM Story Embed system for ATLAS bot (Discord.js v14).

CREATE: src/commands/atlas/story.js (split to story_helpers.js if > 300 lines)
ADD TO: src/commands/admin.js (subcommandGroup 'story', subcommand 'post')
        src/events/interactionCreate.js (route storypost_*, storybuild_*, storyroll_*, storychoice_*)
DO NOT TOUCH: economy.js, character.js, town.js, action.js, warfare.js, scheduler.js

═══ DB TABLES (add migrations to helpers.js initDB) ═══

  'CREATE TABLE IF NOT EXISTS story_templates (id INTEGER PRIMARY KEY AUTOINCREMENT, gm_id TEXT, name TEXT, title TEXT, body TEXT, image_url TEXT, roll_stat TEXT, dc INTEGER DEFAULT 0, choices TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)',
  'CREATE TABLE IF NOT EXISTS story_events (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, gm_id TEXT, template_name TEXT, title TEXT, roll_stat TEXT, dc INTEGER, roll_result INTEGER, total INTEGER, mod_used INTEGER, outcome TEXT, player_choice TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)'

═══ COMMAND ═══
  /admin story post: target(String autocomplete, required), template(String autocomplete, optional)
  Autocomplete for template: SELECT name FROM story_templates WHERE gm_id = callerId

═══ FLOW ═══

  Step A — Show ModalBuilder (customId 'storymodal_{targetId}'):
    - title     (short, required, max 80, pre-fill from template if provided)
    - body      (paragraph, required, max 1500, pre-fill, placeholder "Your breathing feels heavy...")
    - image_url (short, optional, pre-fill)
    - roll_stat (short, optional, "str/mot/men/int/wis/cha/none", pre-fill)
    - dc        (short, optional, integer as string, pre-fill, default "0")

  Step B — On storymodal submit: build preview embed (ephemeral to GM).
    Buttons: [Add Choices] [Post to Player] [Save Template] [Cancel]
    customIds: storybuild_choices_{tId}, storybuild_post_{tId},
               storybuild_save_{tId}, storybuild_cancel

  Step C — [Add Choices] (storybuild_choices_{tId}):
    Second modal: 4 choice label fields + 2 emoji fields (all optional).
    On submit: rebuild preview with choice buttons visible. Show [Post] [Save].

  Step D — [Save Template] (storybuild_save_{tId}):
    Short modal asking for template name.
    INSERT into story_templates. safeReply "✅ Template '{name}' saved."

  Step E — [Post to Player] (storybuild_post_{tId}):
    1. Fetch targetUser. chan = await getNotificationChannel(client, targetUser).
       If no channel: safeReply ephemeral "⚠️ Cannot find target's notification channel."
    2. Build public embed:
       Color 0x6A0DAD. Description: "@{targetMention}\n\n{body}"
       Image if provided. Footer: roll_stat !== 'none' ? "Roll: {STAT.toUpperCase()} | DC {dc}" : "No roll required"
    3. Components:
       Row 1: up to 4 choice ButtonBuilders.
         customId = 'storychoice_{i}_{tId}_{stat}_{dc}'
         HARD LIMIT: customId must be < 100 chars. Use short stat codes (str/mot/etc).
         Do NOT embed choice label text in customId.
       Row 2: if roll_stat !== 'none': Roll button customId = 'storyroll_{stat}_{dc}_{tId}'
    4. Send to chan, ping target.
    5. Store choice labels: INSERT story_events with player_choice = JSON.stringify(choiceLabels).
    6. safeReply ephemeral to GM: "✅ Story posted. Awaiting {targetUsername}'s response."

═══ handleStoryRoll(interaction, args) [storyroll_{stat}_{dc}_{tId}] ═══

  1. Check interaction.user.id === args[2]. If not: safeReply ephemeral "Only the target player can roll."
  2. Fetch user. val = user['attr_'+args[0]] || 10. mod = getMod(val).
  3. Atomic Guild bonus (confirmed Q10 — applies to all rolls):
     const ag = await db.get('SELECT score FROM relations WHERE user_id=? AND faction_name=?',
       interaction.user.id, 'Atomic Guild');
     const agBonus = ag?.score >= 15
       ? Math.max(0, getMod(user.attr_int||10), getMod(user.attr_wis||10))
       : 0;
  4. roll = Math.floor(Math.random()*20)+1
     total = roll + mod + agBonus
  5. outcome = total >= parseInt(args[1]) ? 'success' : 'failure'
  6. Result embed (color 0x00FF88 success / 0xFF0000 failure):
     "1d20 ({roll}) + {stat.toUpperCase()} ({fmtMod(mod)}){agBonus>0?` + Atomic Guild (+${agBonus})`:''} = **{total}** vs DC **{args[1]}**"
     "**{outcome === 'success' ? 'SUCCESS ✅' : 'FAILURE ❌'}**"
  7. Edit original message: components: [] (disable all buttons).
  8. Post result embed as reply to the story message (not ephemeral).
  9. resolveAtlasHQ notification (no embed builder needed — plain content):
     `📋 STORY ROLL: **${outcome.toUpperCase()}** | <@${interaction.user.id}> | ${args[0].toUpperCase()} ${roll}+${mod}=${total} vs DC ${args[1]}\nApply consequences: /admin event fire [type] [player]`
  10. UPDATE story_events SET roll_result=?, total=?, mod_used=?, outcome=? WHERE user_id=? AND outcome IS NULL ORDER BY id DESC LIMIT 1

═══ handleStoryChoice(interaction, args) [storychoice_{i}_{tId}_{stat}_{dc}] ═══

  1. Check user.id === args[1].
  2. Fetch story_events row for this user to retrieve choice labels from player_choice JSON.
     choiceLabels = JSON.parse(row.player_choice || '[]')
     chosenLabel  = choiceLabels[parseInt(args[0])] || `Option ${args[0]}`
  3. UPDATE story_events SET player_choice = chosenLabel.
  4. Edit original: components: [].
  5. Reply public: "<@{userId}> chose: **{chosenLabel}**"
  6. If args[2] !== 'none': trigger handleStoryRoll(interaction, [args[2], args[3], args[1]])
  7. resolveAtlasHQ: `Player chose **${chosenLabel}**. Apply consequences manually.`

SELF-VERIFY:
- [ ] Only targetId can click Roll/Choice
- [ ] ALL customIds < 100 chars — no label text inside customId
- [ ] Zero auto-deductions anywhere in story.js
- [ ] Atomic Guild bonus applied in handleStoryRoll (all rolls — Q10 confirmed)
- [ ] GM receives resolveAtlasHQ notification on every outcome
- [ ] Template pre-fill uses modal .setValue()
- [ ] story.js under 300 lines (split to story_helpers.js if needed)
- [ ] All db.run parameterized
```

---

### TICKET 3.2 — GM Event Templates (narrative text confirmed)
**Model:** 🟡 Sonnet 4.6 | Ready to implement

**Confirmed narrative text (Q12 — brief, no deep lore):**

| Event | Title | Description |
|-------|-------|-------------|
| famine | 🌾 FAMINE | "Crops fail and food stores dwindle. Severity: {sev}/3." |
| plague | ☠️ PLAGUE | "Sickness spreads through the population. Severity: {sev}/3." |
| raid | ⚔️ RAID | "Bandits have struck your territory and plundered your wealth. Severity: {sev}/3." |
| harvest | 🌻 BUMPER HARVEST | "The fields yield abundantly this season. Food and stability improve." |
| noble_unrest | 👑 NOBLE UNREST | "The nobility grows restless and discontent. Prestige suffers." |
| imperial_favor | 🏛️ IMPERIAL FAVOR | "The Empire looks upon you with grace. Vitale and prestige are granted." |
| servus_uprising | 🔗 UPRISING | "Your bound laborers have risen against their conditions. Military response required." |
| tribute | ⚖️ WAR TRIBUTE | "By Imperial decree, war tribute is extracted from your treasury." |

**PROMPT:**
```
You are building GM event templates for ATLAS bot (Discord.js v14).

CREATE: src/commands/atlas/events.js
ADD TO: src/commands/admin.js (subcommandGroup 'event')
READ: src/utils/helpers.js (resolveAtlasHQ, safeReply, getNotificationChannel, isGM)
DO NOT TOUCH: economy.js, story.js, action.js, scheduler.js, warfare.js

═══ DB TABLE (migration in helpers.js initDB) ═══
  'CREATE TABLE IF NOT EXISTS gm_events (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, gm_id TEXT, event_type TEXT, severity INTEGER DEFAULT 1, effect_snapshot TEXT, resolved INTEGER DEFAULT 0, created_at INTEGER)'

═══ ADMIN SUBCOMMANDS ═══
  /admin event fire: target(autocomplete), type(choice), severity(Int 1-3 default 1), amount(Int optional)
  /admin event undo: target(autocomplete), event_type(choice)
  /admin event list: target(autocomplete)
  Choices: famine | plague | raid | harvest | noble_unrest | imperial_favor | servus_uprising | tribute

═══ handleEventFire(interaction, type, targetId, severity, amount) ═══

  a. isGM check. Fetch full user row.
  b. Snapshot: JSON.stringify of ONLY the fields being changed, BEFORE values.
  c. INSERT gm_events (snapshot, resolved=0, created_at=Date.now()).
  d. Apply UPDATE (see effects below).
  e. Build embed using confirmed narrative text above. Post to getNotificationChannel(client, user).
  f. resolveAtlasHQ summary: "✅ Event fired: {type} (sev {severity}) on {user.username}."
  g. safeReply ephemeral to GM: "Event fired. Use /admin event undo {username} {type} within 1h to reverse."

  EFFECTS (parameterized SQL):
    famine:          food_surplus = MAX(-9999, food_surplus-(500*sev)), rate_stab = MAX(-10, rate_stab-sev)
    plague:          pop_commoners = MAX(10, CAST(pop_commoners*(1-0.15*sev) AS INTEGER)), rate_stab = MAX(-10, rate_stab-sev)
    raid:            wealth = MAX(0, wealth-(500*sev))
    harvest:         food_surplus = food_surplus+(2000*sev), rate_stab = MIN(10, rate_stab+1)
    noble_unrest:    rate_prest = MAX(-10, rate_prest-(2*sev))
    imperial_favor:  rate_prest = MIN(10, rate_prest+3), vitale = COALESCE(vitale,0)+(10*sev)
    servus_uprising: route to require('../atlas/warfare').handleRebellionEvent(db, user)
    tribute:         wealth = MAX(0, wealth-amount)

  EMBED COLORS:
    famine 0xCC4400, plague 0x884400, raid 0xFF4400, harvest 0x44BB00,
    noble_unrest 0xDD8800, imperial_favor 0xFFD700, servus_uprising 0xFF0000, tribute 0x444444

═══ handleEventUndo(interaction, targetId, eventType) ═══
  Fetch: most recent gm_events WHERE user_id=target AND event_type=type AND resolved=0
         AND created_at >= Date.now()-3600000.
  If none: safeReply "No recent undoable {type} event for this player (1h window expired)."
  Parse snapshot. Restore each field. UPDATE gm_events SET resolved=1.
  safeReply "↩️ Event reversed for {username}."

═══ handleEventList ═══
  Last 10 gm_events for user. Embed: type, severity, formatted date, resolved status.

SELF-VERIFY:
- [ ] Snapshot is BEFORE values only
- [ ] Undo restores exact before values (not a delta)
- [ ] servus_uprising routes to warfare.js, not duplicated here
- [ ] tribute uses amount param (not severity)
- [ ] Narrative text matches confirmed table above
- [ ] events.js under 300 lines
- [ ] All db.run parameterized
```

---

## PHASE 4 — TRADE ROUTES

### TICKET 4.1 — Automated Trade Routes
**Model:** 🔴 Sonnet 4.6 extended thinking | Ready to implement

**Confirmed NPC route text (Q11 — brief, no deep lore):**
- Styx: *"Imperial merchants arrive. Wealth exchanged for Vitale at current market rates."*
- Sciatic: *"Sciatic traders deliver goods from distant ports."*
- Caossa: *"A Caossi caravan arrives bearing ore and worked metal."*

**PROMPT:**
```
You are implementing the Trade Route system for ATLAS bot (Discord.js v14).

CREATE: src/commands/atlas/trade.js
ADD TO: atlas.js (/atlas traderoute subcommands), scheduler.js (weekly resolution),
        helpers.js (DB table migrations)
DO NOT TOUCH: economy.js handleTrade (one-time trade stays), story.js, events.js, warfare.js

═══ DB TABLES (helpers.js initDB migrations) ═══
  'CREATE TABLE IF NOT EXISTS trade_routes (id INTEGER PRIMARY KEY AUTOINCREMENT, initiator_id TEXT, partner_id TEXT, partner_type TEXT, give_resource TEXT, give_amount INTEGER, receive_resource TEXT, receive_amount INTEGER, duration_turns INTEGER, turns_remaining INTEGER, status TEXT DEFAULT "active", created_at DATETIME DEFAULT CURRENT_TIMESTAMP)',
  'CREATE TABLE IF NOT EXISTS treaties (id INTEGER PRIMARY KEY AUTOINCREMENT, initiator_id TEXT, partner_id TEXT, treaty_type TEXT, status TEXT DEFAULT "pending", turns_active INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)'

═══ ATLAS SUBCOMMANDS ═══
  /atlas traderoute list
  /atlas traderoute propose: partner_type(choice: player/styx/sciatic/caossa),
    partner(autocomplete, required only if player), give_resource(choice), give_amount(Int),
    receive_resource(choice), receive_amount(Int), duration(Int 1-10)
  /atlas traderoute cancel: route_id(Int)

═══ RELATION GATES (enforced in handleTradeRoutePropose) ═══
  styx:    no gate (embargo handled in economy.js)
  sciatic: relations['Sciatic League'] >= 10
  caossa:  relations['Caossa'] >= 5
  player:  no gate, but requires partner acceptance

═══ PLAYER ROUTES: require partner Accept ═══
  INSERT status='pending'. Post notification to partner's channel:
  customId: 'traderoute_a_{routeId}' / 'traderoute_r_{routeId}'
  Accept: UPDATE status='active'. Notify initiator.
  Reject: UPDATE status='broken'. Notify initiator.

═══ NPC ROUTES: INSERT status='active' directly ═══

═══ WAR TRIBUTE ROUTES: /admin tribute command ═══
  Options: loser(autocomplete), winner(autocomplete), resource(choice), amount(Int), turns(Int)
  INSERT: initiator_id=loser, partner_id=winner, partner_type='tribute',
          give_resource=resource, give_amount=amount, receive_resource=resource,
          receive_amount=amount, duration_turns=turns, turns_remaining=turns, status='tribute'
  handleTradeRouteCancel must check: if route.status === 'tribute' → block with "War tributes cannot be cancelled."

═══ WEEKLY ROUTE RESOLUTION — export processTradeRoutes(db, client) ═══
  Called from scheduler.js weekly cron after turn increment.

  const routes = await db.all('SELECT * FROM trade_routes WHERE status IN ("active","tribute")');
  for (const route of routes) {
    try {
      const user = await db.get('SELECT * FROM users WHERE id=?', route.initiator_id);
      if (!user) continue;

      // Check can pay
      if ((user[route.give_resource] || 0) < route.give_amount) {
        await db.run('UPDATE trade_routes SET status="paused" WHERE id=?', route.id);
        const chan = await getNotificationChannel(client, user);
        if (chan) await chan.send({ content: `⚠️ <@${route.initiator_id}> Your trade route paused — insufficient ${route.give_resource}.` });
        continue;
      }

      // Styx: dynamic Vitale pricing at resolution
      let receiveAmount = route.receive_amount;
      if (route.partner_type === 'styx') {
        const vBase  = parseInt((await db.get('SELECT value FROM global_settings WHERE key="vitale_base"'))?.value || '15');
        const vSold  = parseInt((await db.get('SELECT value FROM global_settings WHERE key="vitale_sold_week"'))?.value || '0');
        const pCount = (await db.get('SELECT COUNT(*) as c FROM users WHERE status="active"'))?.c || 1;
        const pool   = vBase + (10 * pCount);
        const price  = Math.floor(50 * (1 + (vSold / Math.max(1, pool)) * 4));
        receiveAmount = Math.floor(route.give_amount / price);
        if (receiveAmount < 1) {
          const chan = await getNotificationChannel(client, user);
          if (chan) await chan.send({ content: `⚠️ <@${route.initiator_id}> Vitale price too high this week — Styx route skipped.` });
          continue;
        }
        await db.run('UPDATE global_settings SET value=CAST(value AS INTEGER)+? WHERE key="vitale_sold_week"', receiveAmount);
      }

      // Execute exchange
      await db.run(`UPDATE users SET ${route.give_resource}=${route.give_resource}-? WHERE id=?`, route.give_amount, route.initiator_id);
      await db.run(`UPDATE users SET ${route.receive_resource}=COALESCE(${route.receive_resource},0)+? WHERE id=?`, receiveAmount, route.initiator_id);

      // Player-to-player: reverse leg for partner
      if (route.partner_type === 'player' && route.partner_id) {
        await db.run(`UPDATE users SET ${route.receive_resource}=${route.receive_resource}-? WHERE id=?`, receiveAmount, route.partner_id);
        await db.run(`UPDATE users SET ${route.give_resource}=COALESCE(${route.give_resource},0)+? WHERE id=?`, route.give_amount, route.partner_id);
      }

      // Post brief NPC route notification embed
      const npcText = {
        styx:    'Imperial merchants arrive. Wealth exchanged for Vitale at current market rates.',
        sciatic: 'Sciatic traders deliver goods from distant ports.',
        caossa:  'A Caossi caravan arrives bearing ore and worked metal.'
      };
      if (npcText[route.partner_type]) {
        const chan = await getNotificationChannel(client, user);
        if (chan) await chan.send({ content: `🔄 <@${route.initiator_id}> Trade route settled. ${npcText[route.partner_type]}` });
      }

      // Decrement turns
      await db.run('UPDATE trade_routes SET turns_remaining=turns_remaining-1 WHERE id=?', route.id);
      if (route.turns_remaining - 1 <= 0) {
        await db.run('UPDATE trade_routes SET status="completed" WHERE id=?', route.id);
        const chan = await getNotificationChannel(client, user);
        if (chan) await chan.send({ content: `✅ <@${route.initiator_id}> Your trade route has completed after ${route.duration_turns} turns.` });
      }
    } catch (err) {
      console.error(`[TRADE] Route ${route.id} failed:`, err.message);
    }
  }

SELF-VERIFY:
- [ ] Player routes require accept before active
- [ ] Styx uses dynamic price at resolution, not setup time
- [ ] NPC routes check relation score before accepting
- [ ] Tribute routes not cancellable by player
- [ ] processTradeRoutes exported for scheduler
- [ ] Per-route try/catch so one failure doesn't break the whole loop
- [ ] trade.js under 300 lines
- [ ] All db.run parameterized
```

---

## PHASE 5 — WARFARE SYSTEM

### TICKET 5.1 — warfare.js: Army Types, Morale, Counter System, Field Battle, Siege
**Model:** 🔴 Sonnet 4.6 extended thinking | Ready to implement

**Confirmed values (all from Q answers):**
- Polysia cavalry bonus: **+10** attack — only if `mil_cavalry > 0`
- Styx-house siege defense: **+8**
- Prestige loss: **permanent** — no auto-recovery, only via GM events or player choices
- Atomic Guild bonus: applies to **all rolls** including battle rolls

**PROMPT:**
```
You are implementing the Warfare system for ATLAS bot (Discord.js v14).

CREATE: src/commands/atlas/warfare.js (split to warfare_calc.js if > 300 lines)
ADD TO: atlas.js (/atlas action battle, /atlas action warfare),
        admin.js (/admin warfare siege),
        interactionCreate.js (route warapprove_*, warreject_*, warconfirm_*, warbattle_*)
READ: helpers.js (getMod, getCharBonuses, resolveAtlasHQ, safeReply, getPlayerRank, getNotificationChannel)
      constants.js (BUILDINGS, TERRAINS, ANCESTRIES, ARMY_TYPES)
DO NOT TOUCH: action.js (keep scout, recruit, nation found intact),
              economy.js, story.js, events.js, trade.js

═══ CONSTANTS (top of warfare.js only — do not add to constants.js) ═══
  const TERRAIN_DEF       = { MOUNTAIN:15, FOREST:8, HILLS:5, RIVERLANDS:3, PLAINS:0, COASTAL:-2, SWAMP:6 };
  const POLYSIA_KEYS      = ['POLYSIA-ESTUARIN','POLYSIA-RIPARIAN'];
  const STYX_HOUSES       = ['TYRANNITE','RHAGAIA','CELLESELA','GAIUS','CAOSSA'];
  const POLYSIA_CAV_BONUS = 10;
  const STYX_FORT_BONUS   = 8;

═══ MORALE (private helper — not exported) ═══
  function calcMorale(user) {
    const base = 100
      + (user.rate_stab  || 0) * 3
      + (user.rate_prest || 0) * 2
      - Math.max(0, -(user.food_surplus || 0)) * 5
      - Math.floor((user.servus || 0) / 5) * 2;
    return Math.max(30, Math.min(150, base));
  }

═══ ARMY POWER (private — handles all 4 unit types + mercs) ═══
  function calcArmyPower(user, context) {
    const inf = (user.mil_infantry || 0) + (user.mercs_temp || 0);
    const cav = user.mil_cavalry || 0;
    const rng = user.mil_ranged  || 0;
    const sig = user.mil_siege   || 0;

    let raw = 0;
    if (context === 'field') {
      raw = inf*1.0 + cav*1.5 + rng*1.0 + sig*0.0;
    } else if (context === 'siege_atk') {
      raw = inf*1.0 + cav*0.8 + rng*1.0 + sig*2.0;
    } else if (context === 'siege_def') {
      raw = inf*1.0 + cav*0.8 + rng*1.2 + sig*0.5;
    }
    return Math.floor(raw * (calcMorale(user) / 100));
  }

═══ COUNTER BONUS (field battle only) ═══
  function compCounterBonus(atk, def) {
    if ((atk.mil_cavalry||0) > 0 && (def.mil_ranged||0) > (def.mil_infantry||0)) return 5;
    if ((atk.mil_ranged||0)  > 0 && (def.mil_infantry||0) > (def.mil_cavalry||0)) return 3;
    return 0;
  }

═══ BUILDING SCORE HELPERS (async) ═══
  async calcOffenseScore(db, userId):
    Sum across all user's towns: BARRACKS→1, CASTLE→2, PALACE→3

  async calcDefenseScore(db, townId):
    PALISADE→1, BASIC_WALL→2, ADVANCED_WALL→3, CASTLE→5

═══ ATOMIC GUILD ROLL BONUS (applies to battle rolls — Q10 confirmed all rolls) ═══
  async function getAgBonus(db, userId, user) {
    const ag = await db.get('SELECT score FROM relations WHERE user_id=? AND faction_name=?', userId, 'Atomic Guild');
    if (ag?.score >= 15) return Math.max(0, getMod(user.attr_int||10), getMod(user.attr_wis||10));
    return 0;
  }

═══ FOOD COST FORMULAS ═══
  function fieldFoodCost(user)  { return ((user.mil_infantry||0)+(user.mil_cavalry||0)+(user.mil_ranged||0)+(user.mercs_temp||0)) * 2; }
  function siegeFoodCostAtk(u)  { return ((u.mil_infantry||0)+(u.mil_cavalry||0)+(u.mil_ranged||0)+(u.mil_siege||0)+(u.mercs_temp||0)) * 5; }
  function siegeFoodCostDef(u)  { return ((u.mil_infantry||0)+(u.mil_cavalry||0)+(u.mil_ranged||0)+(u.mil_siege||0)) * 2; }

═══ TASK 1 — handleBattleInitiate (/atlas action battle) ═══
  a. rank = getPlayerRank(user). SCION → blocked "Scions cannot declare battle."
  b. Fetch attacker + defender. House check:
     atkHouse = ANCESTRIES[atk.ancestry?.toUpperCase()]?.house
     defHouse = ANCESTRIES[def.ancestry?.toUpperCase()]?.house
     if (atkHouse && defHouse && atkHouse === defHouse && atkHouse !== 'INDEPENDENT' && atkHouse !== 'REMOVED'):
       return "You cannot attack a member of the same Great House."
  c. foodCost = fieldFoodCost(atk).
     If atk.food_surplus < foodCost: return "⚠️ Insufficient supplies. Need {foodCost} 🥩 to march."
     DEDUCT NOW: UPDATE food_surplus = food_surplus - ? WHERE id = atkId
  d. Post to resolveAtlasHQ:
     Embed showing: attacker name, target name, force composition (each unit type), morale preview.
     Buttons: 'warapprove_battle_{atkId}_{defId}' / 'warreject_battle_{atkId}_{defId}'
  e. safeReply to attacker: "⚔️ Battle request submitted. {foodCost} 🥩 supply spent. Awaiting GM approval."

═══ TASK 2 — handleBattleApprove (GM clicks) ═══
  a. isGM check. Re-fetch both users.
  b. Deduct defender food: MAX(0, food_surplus - fieldFoodCost(def)).
  c. Roll 1d20 for both NOW (not at initiation).
  d. Get AG bonus for both: agBonusAtk = await getAgBonus(db, atkId, atk); agBonusDef = await getAgBonus(db, defId, def)
  e. Calc:
     atkOff       = await calcOffenseScore(db, atkId)
     menMod       = getMod(atk.attr_men || 10)
     polysiaBonus = POLYSIA_KEYS.includes(atk.ancestry?.toUpperCase()) && (atk.mil_cavalry||0) > 0 ? POLYSIA_CAV_BONUS : 0
     counterBonus = compCounterBonus(atk, def)
     atkPower = calcArmyPower(atk,'field') + atkOff*5 + menMod*2 + polysiaBonus + counterBonus + atkRoll + agBonusAtk
     defPower = calcArmyPower(def,'field')*1.2 + (await calcOffenseScore(db,defId))*5 + defRoll + agBonusDef

  f. winner = atkPower > defPower ? 'atk' : 'def'
     loser  = winner === 'atk' ? def : atk

  g. Casualties (proportional, each unit type):
     const lossFactor = 0.70 + Math.random() * 0.15;   // 70–85% survive
     loser: mil_infantry = MAX(0, floor(mil_infantry * lossFactor))
            mil_cavalry  = MAX(0, floor(mil_cavalry  * lossFactor))
            mil_ranged   = MAX(0, floor(mil_ranged   * lossFactor))
            (siege not used in field — no field casualties)
            hp_current   = MAX(1, hp_current - (10 + floor(Math.random()*16)))
            rate_prest   = MAX(-10, rate_prest - 2)    ← PERMANENT (Q14 confirmed)
            rate_stab    = MAX(-10, rate_stab - 1)
     winner: rate_prest = MIN(10, rate_prest + 1)
     UPDATE both users.

  h. 20% chance winner gets substat pick:
     if (Math.random() < 0.20):
       Post embed to winner's channel:
       "✨ A moment of brilliance in battle. Choose a substat to improve (+1):"
       6 buttons across 2 rows. customId: 'warbattle_ss_{statKey}_{winnerId}'
       stat keys: str, mot, men, int, wis, cha

  i. Post outcome embeds to both players' channels.
     Log to gm_events (type='field_battle').
     Disable approve/reject buttons in GM channel.

═══ TASK 3 — handleBattleSubstat [warbattle_ss_{statKey}_{winnerId}] ═══
  Check user.id === winnerId.
  UPDATE users SET attr_{statKey} = MIN(20, attr_{statKey}+1) WHERE id=?
  Disable buttons. Reply: "✨ Your {STAT_MAPPING[statKey].name} improved!"

═══ TASK 4 — handleSiegeInitiate (/atlas action warfare, Sovereign only) ═══
  Options: target(autocomplete user), target_town(autocomplete defender's towns)
  getPlayerRank === 'SOVEREIGN' check.
  Pre-deduct attacker food: siegeFoodCostAtk(atk). Block if insufficient.
  Attempt defender deduction: siegeFoodCostDef(def). If can't pay, flag "⚠️ DEFENDER UNDERSUPPLIED" — halve their effective power.
  Post siege preview to resolveAtlasHQ:
    Both power component breakdowns. Terrain bonus. Food warnings. d20 NOT yet rolled.
    Buttons: 'warconfirm_s_{atkId}_{defId}_{townId}' / 'warabort_s_{atkId}'
    Keep customId short — use first 8 chars of IDs if needed to stay < 100 chars.

═══ TASK 5 — handleSiegeConfirm [warconfirm_s_*] ═══
  isGM check. Re-fetch everything.
  Roll d20s fresh NOW.
  Get AG bonuses for both.
  styxBonus  = STYX_HOUSES.includes(ANCESTRIES[def.ancestry?.toUpperCase()]?.house) ? STYX_FORT_BONUS : 0
  terrainBonus = TERRAIN_DEF[targetTown.terrain_type] || 0
  defScore   = await calcDefenseScore(db, townId)
  atkPower = calcArmyPower(atk,'siege_atk') + atkOff*5 + menMod*2 + polysiaOnlyIfCav + atkRoll + agBonusAtk
  defPower = calcArmyPower(def,'siege_def')*1.2 + defScore*8 + terrainBonus + styxBonus + defRoll + agBonusDef

  Attacker wins:
    atk casualties: each unit type * random(0.70,0.90) survive
    def casualties: each unit type * random(0.40,0.70) survive
    def rate_stab -= 3, atk rate_prest += 2 (PERMANENT)
    Post to GM: "Select a building to destroy in {town}:"
      Buttons per building in target town. customId: 'warsiege_destroy_{bldgId}_{defId}'
  Defender wins:
    def casualties: * random(0.85,0.95), atk: * random(0.60,0.80)
    atk rate_stab -= 2, def rate_prest += 3 (PERMANENT)

  Post outcome embeds to both players. Log gm_events.

═══ TASK 6 — handleRebellionEvent(db, user) [exported — called by events.js] ═══
  Servus rebellion logic (stab<=-5 AND servus>0):
    rebel_str = (user.servus || 0) * 3
    armyPow   = calcArmyPower(user, 'field')
    if armyPow > rebel_str:
      UPDATE rate_stab=MAX(-10,rate_stab-1), servus=MAX(0,servus-5) WHERE id=user.id
    else:
      UPDATE rate_stab=MAX(-10,rate_stab-5), wealth=MAX(0,wealth-2000), servus=0 WHERE id=user.id
      Also delete a random building: SELECT id FROM buildings WHERE town_id IN (SELECT id FROM towns WHERE user_id=user.id) ORDER BY RANDOM() LIMIT 1 → DELETE

  Noble revolt logic (prest<=-3 AND pop_commoners>=200):
    nobles    = Math.floor((user.pop_commoners||0)/50)
    defectors = Math.floor(nobles * Math.abs(user.rate_prest||0) / 10)
    armyPow   = calcArmyPower(user, 'field')
    if armyPow > defectors * 10:
      UPDATE rate_prest=MAX(-10,rate_prest-1) WHERE id=user.id
    else:
      UPDATE rate_prest=MAX(-10,rate_prest-5), status='deposed' WHERE id=user.id
      resolveAtlasHQ notification: "⚠️ NOBLE REVOLT — {username} has been DEPOSED. GM action required."

  NOTE: Remove rebellion/revolt button handlers from action.js after this is implemented.
        action.js buttons 'rebellion_suppress' and 'revolt_suppress' should import and call
        this function instead of the placeholder logic.

SELF-VERIFY:
- [ ] Food deducted BEFORE GM approval
- [ ] hp_current MAX(1,...) — never reaches 0
- [ ] Polysia bonus only if mil_cavalry > 0
- [ ] Styx house siege defense bonus applies in siege only
- [ ] Prestige loss PERMANENT (no auto-recovery — confirmed Q14)
- [ ] Substat +1 capped at MIN(20,...)
- [ ] Scion blocked from all combat
- [ ] Dominar: field battle only, cannot siege
- [ ] Sovereign: both field and siege
- [ ] AG bonus applied to battle rolls (all rolls — confirmed Q10)
- [ ] Counter bonus: Cavalry vs Ranged +5, Ranged vs Infantry +3
- [ ] d20 rolled at approval/confirm time, not at initiation
- [ ] handleRebellionEvent exported for events.js
- [ ] warfare.js under 350 lines (split to warfare_calc.js if needed)
- [ ] All customIds < 100 chars
- [ ] All db.run parameterized
```

---

## PHASE 6 — DIPLOMACY GUI

### TICKET 6.1 — /atlas diplomacy (replaces /atlas relation)
**Model:** 🟡 Sonnet 4.6
**⚠️ LOREBOOK PENDING: Rhagaia, Cellesela, Gaius, The Fathers, The Mothers lore text**

**PROMPT:**
```
You are building the /atlas diplomacy GUI for ATLAS bot (Discord.js v14).

CREATE: src/commands/atlas/diplomacy.js
ADD TO: atlas.js (/atlas diplomacy), interactionCreate.js (diplo_* routing)
READ: constants.js (FACTIONS, GREAT_HOUSES, ANCESTRIES), helpers.js (safeReply, isVitaleFree, isGM)
DO NOT TOUCH: economy.js, warfare.js, trade.js, story.js

═══ CONFIRMED FACTION MECHANICS ═══

  Tyrannite  >=15:  Vitale market access, Empire Ruler candidacy
  Tyrannite  <=-20: Embargoed (economy.js handles — diplomacy shows status only)
  Caossa     >=10:  +10% ore/metallurgy (applied in economy.js via ancestry check)
  Caossa     <=-20: Caossa trade routes blocked (enforced in trade.js)
  Sciatic    >=10:  Exotic/Servus trade route access (enforced in trade.js)
  The Mothers>=10:  Noble vitale upkeep halved for Sovereigns (economy.js)
  The Fathers>=10:  mil_strength cap +50% (warfare.js recruit cap check)
  Atomic Guild>=15: +max(INT,WIS mod) to ALL rolls (story.js + warfare.js)
  Atomic Guild<=-20: 5%/2%/0.5% chance GM notification per tax tick (economy.js)
  Rhagaia:    // TODO LOREBOOK — show "Mechanic: ⚠️ Coming soon" in GUI
  Cellesela:  // TODO LOREBOOK
  Gaius:      // TODO LOREBOOK

═══ MAIN GUI (/atlas diplomacy — always ephemeral) ═══

  Fetch all relations for user. Build embed:
  Title: "🤝 DIPLOMATIC LEDGER — {username}"

  For each faction in FACTIONS array:
    rel   = user's score for this faction (0 if no row)
    segs  = Math.round(Math.min(10, Math.max(0, (rel+30)/6)))
    bar   = '█'.repeat(segs) + '░'.repeat(10-segs)
    tag   = rel>=15 ? "Allied ✅" : rel>=0 ? "Neutral" : rel>=-10 ? "Strained ⚠️" : rel>-20 ? "Hostile 🔴" : "Hostile 🔴"
    If faction === 'Tyrannite' AND rel <= -20: tag = "EMBARGOED 🚫"
    line  = `{faction}: {bar} ({rel > 0 ? '+':''}${rel}) — ${tag}`

  Components:
    Row 1: StringSelectMenu 'diplo_view_{userId}' listing all factions
    Row 2: [View Treaties] [View Trade Routes] [Propose Treaty]
    customIds: diplo_treaties_{uid}, diplo_routes_{uid}, diplo_treaty_{uid}

═══ FACTION DETAIL (diplo_view select) ═══
  Show: current score, unlock threshold + current status, penalty threshold + status.
  For Rhagaia/Cellesela/Gaius: show "⚠️ Mechanic details pending lorebook confirmation."
  Bribe buttons:
    [500🪙 → +1 relation]   disabled if balance<500 OR cooldown active (last_bribe within 24h)
    [1 Exotic → +3 relation] disabled if exotics<1  OR cooldown active
  On bribe:
    500🪙: balance-=500, UPDATE relations SET score=score+1, last_bribe=Date.now()
    Exotic: exotics-=1, UPDATE relations SET score=score+3, last_bribe=Date.now()
    Cooldown check: last_bribe field on relations table (migration added in Ticket 1.1)

═══ TREATIES VIEW (diplo_treaties) ═══
  Fetch treaties WHERE initiator_id OR partner_id = userId.
  List: partner @mention, type, status, turns_active.
  Note: "Treaties are binding. Only an admin can dissolve them."

═══ TRADE ROUTES VIEW (diplo_routes) ═══
  Fetch trade_routes WHERE (initiator_id OR partner_id = userId) AND status NOT IN ('completed').
  List: partner, give resource/amount, receive resource/amount, turns remaining, status.

═══ TREATY PROPOSE (diplo_treaty) ═══
  Show StringSelectMenu: trade_pact / non_aggression / alliance.
  On select: show player autocomplete.
  On confirm: INSERT treaties status='pending'. Post Accept/Reject to partner's channel.
    customId: 'treaty_accept_{tId}' / 'treaty_reject_{tId}'
  Accept: UPDATE status='active'. Notify initiator.
  Reject: UPDATE status='broken'. Notify initiator.
  Breaking by gameplay: only via /admin treaty dissolve (import handleTreatyDissolve from diplomacy.js).

═══ handleTreatyDissolve(interaction) [exported, called from admin.js] ═══
  Options: initiator(autocomplete), partner(autocomplete), type(choice).
  Fetch treaty. UPDATE status='broken'. Notify both parties. Log to gm_events.

SELF-VERIFY:
- [ ] GUI is always ephemeral
- [ ] Score bar renders correctly for range -30 to +30
- [ ] Bribe cooldown tracked per faction per user
- [ ] Rhagaia/Cellesela/Gaius show TODO placeholder text
- [ ] Treaties binding — only admin dissolve
- [ ] handleTreatyDissolve exported for admin.js
- [ ] diplomacy.js under 300 lines
- [ ] All db.run parameterized
```

---

## PHASE 7 — ADMIN QOL

### TICKET 7.1 — GM Dashboard + notification_channel
**Model:** 🟢 Haiku 4.5 | Ready to implement

**PROMPT:**
```
You are adding GM tools to admin.js.

EDIT: src/commands/admin.js, src/utils/helpers.js
DO NOT TOUCH: any atlas/ module file.

TASK 1 — /admin dashboard (always ephemeral):
  Fetch all active users sorted by wealth DESC.
  Build embed:
    Title: "📊 GM DASHBOARD — Turn {current_turn}"
    For each user (one line per):
      {username} | {rank emoji} | {nation||town||'—'} | {wealth}⚖️ |
      {food_surplus<=0 ? '⚠️FAMINE' : food_surplus+'🥩'} |
      {mil_infantry}⚔️{mil_cavalry}🐎{mil_ranged}🏹{mil_siege}🪨 |
      Stab:{rate_stab}{rate_stab<=-3?'🔴':''} | Prest:{rate_prest}{rate_prest<=-2?'🔴':''}
    Footer: "{count} active | {n} taxed this turn (last_tax > now-7days) | {n} not taxed"
    Players with status='deposed' shown with ⚠️ DEPOSED prefix.
  No pagination needed for ≤20 players.

TASK 2 — Add channel_id option to /admin user edit:
  channel_id (String, optional): set notification_channel for player.
  Validate: try client.channels.fetch(channelId). If fails: reply "Channel not found."
  On success: UPDATE users SET notification_channel=? WHERE id=?
  Reply: "✅ Notification channel set for {username}."

TASK 3 — Verify getNotificationChannel is exported from helpers.js (added in Ticket 1.1).
  If missing: add it here.

SELF-VERIFY:
- [ ] Dashboard always ephemeral
- [ ] channel_id validated before saving
- [ ] getNotificationChannel exported from helpers.js
- [ ] Deposed players visible in dashboard
```

---

## PHASE 8 — BALANCE SPENDING & MERCENARIES

### TICKET 8.1 — Recruit by Army Type, Mercenaries, Town Rename
**Model:** 🟡 Sonnet 4.6 | Ready to implement

**Confirmed mercenary text (Q9):**
> *"Soldiers-for-hire drawn from various lands and backgrounds, bound by coin rather than loyalty. They fight effectively but disband at the end of each Imperial turn."*

**PROMPT:**
```
You are updating recruitment and balance-spending in ATLAS bot.

EDIT: src/commands/atlas/action.js (handleRecruit only)
      src/commands/atlas/town.js (add rename option)
      src/scheduler.js (add merc expiry to weekly cron)
DO NOT TOUCH: economy.js, warfare.js, diplomacy.js, story.js

═══ TASK 1 — action.js: rewrite handleRecruit for army types ═══

  Update /atlas action recruit subcommand options:
    type:      choice (infantry/cavalry/ranged/siege/mercenary, required)
    amount:    Integer (required)
    mercenary: remove as separate Boolean — 'mercenary' is now just a type choice

  handleRecruit logic:
    const ARMY_TYPES = require('../../data/constants').ARMY_TYPES;
    const type = interaction.options.getString('type').toUpperCase();
    const amount = interaction.options.getInteger('amount');

    if (type === 'MERCENARY'):
      cost_balance = amount * 500
      if user.balance < cost_balance: return error
      UPDATE users SET balance=balance-?, mercs_temp=COALESCE(mercs_temp,0)+? WHERE id=?
      return reply with MERC_DESC from constants, note "Disbanded at end of current turn."

    const def = ARMY_TYPES[type];
    if (!def) return "Unknown unit type."

    // Building requirement check
    if (def.requires):
      const check = await db.get(
        'SELECT 1 FROM buildings b JOIN towns t ON b.town_id=t.id WHERE t.user_id=? AND UPPER(b.type)=? AND (b.ready_at IS NULL OR b.ready_at<=?)',
        userId, def.requires, Date.now()
      );
      if (!check) return `⚠️ You need a ${def.requires} to recruit ${def.name}.`

    // Metallurgy cost check (Cavalry uses 0, Siege uses 5 per unit)
    const metCost = def.cost_met * amount;
    if (metCost > 0 && (user.metallurgy||0) < metCost):
      return `⚠️ Insufficient Metallurgy. Need ${metCost} 🔩 for ${amount} ${def.name}.`

    // Balance cost
    const balCost = def.cost_balance * amount;
    if ((user.balance||0) < balCost): return error

    // Population check (max 10% of commoners, existing limit stays)
    const maxRecruits = Math.floor((user.pop_commoners||0) * 0.10);
    if (amount > maxRecruits): return `⚠️ Max recruitable: ${maxRecruits} (10% of commoners).`
    // The Fathers relation >= 10: mil cap +50%
    const fathers = await db.get('SELECT score FROM relations WHERE user_id=? AND faction_name=?', userId, 'The Fathers');
    const capMult = fathers?.score >= 10 ? 1.5 : 1.0;
    // (apply capMult to overall mil limit if needed — basic check for now)

    // Determine which column to update
    const col = { INFANTRY:'mil_infantry', CAVALRY:'mil_cavalry', RANGED:'mil_ranged', SIEGE:'mil_siege' }[type];

    // Compute new maintenance cost
    const newMaint = calcMaintenance({
      ...user,
      [col]: (user[col]||0) + amount
    });

    UPDATE users SET
      balance = balance - ?,
      metallurgy = COALESCE(metallurgy,0) - ?,
      ${col} = COALESCE(${col},0) + ?,
      pop_commoners = pop_commoners - ?,
      mil_strength = COALESCE(mil_strength,0) + ?,
      mil_maintenance_cost = ?
    WHERE id = ?
    params: [balCost, metCost, amount, amount, amount, newMaint, userId]

    const strMod = Math.max(0, getMod(user.attr_str||10));
    const discount = Math.min(0.30, strMod * 0.01);
    const dailyCost = Math.floor(def.food_per_unit * amount * (1-discount));
    reply: `⚔️ Recruited ${amount} ${def.name} for ${balCost}🪙${metCost>0?' + '+metCost+'🔩':''}.
Daily upkeep: ${dailyCost} 🥩${discount>0?' (STR discount applied)':''}.`

═══ TASK 2 — town.js: add Rename button ═══
  In town management GUI, add [Rename Town] button. customId: 'town_rename_{townId}'
  On click: ModalBuilder with one field: new name (max 32 chars).
  On submit:
    if user.balance < 1000: return "⚠️ Renaming costs 1,000 🪙."
    Check name not already used by this player.
    UPDATE users SET balance=balance-1000 WHERE id=?
    UPDATE towns SET name=? WHERE id=?
    reply: "Town renamed to **{name}**."

═══ TASK 3 — scheduler.js weekly cron: add merc expiry ═══
  At end of existing Monday cron (after trade route processing):
    await db.run('UPDATE users SET mercs_temp=0 WHERE mercs_temp > 0');
    console.log('[SCHEDULER] Mercenaries disbanded for new turn.');

SELF-VERIFY:
- [ ] All 5 unit types handled (infantry/cavalry/ranged/siege/mercenary)
- [ ] Building requirement checked for cavalry/ranged (BARRACKS), siege (CASTLE)
- [ ] Metallurgy cost deducted for siege units
- [ ] Mercs expire weekly in scheduler
- [ ] calcMaintenance used to update mil_maintenance_cost after recruit
- [ ] Town rename costs 1000🪙
- [ ] Town rename validates name uniqueness per player
- [ ] MERC_DESC from constants shown in mercenary reply
```

---

## REMAINING LOREBOOK-PENDING ITEMS

The following cannot be implemented until `lorebook.md` is complete. All are non-blocking — the rest of the system works without them.

| Item | Where It Goes | Notes |
|------|--------------|-------|
| Rhagaia faction mechanic | diplomacy.js | Show "Coming soon" stub in GUI |
| Cellesela faction mechanic | diplomacy.js | Same |
| Gaius faction mechanic | diplomacy.js | Same |
| The Fathers/Mothers lore text | diplomacy.js faction detail | Mechanic implemented (50% cap / halved vitale), just no lore description |
| Tora description string | character.js origins | Button shows "Tora 🏺" with no desc until confirmed |
| Alexians description | character.js origins | Same |
| Sciatic description | character.js origins | Same |
| Elvish description | character.js origins | Same |
| Song description | character.js origins | Same |
| Linerian description | character.js origins | Same |
| Mercenary unit lore variants | action.js | Base desc confirmed. Variants can be added per ancestry later |

---

## IMPLEMENTATION ORDER (Part 1 + Part 2 Combined)

```
IMMEDIATE (data only, safe to do first):
  Ticket 1.1  Constants + schema (Tora, army columns, rank, migrations)
  Ticket 1.2  New buildings (Mine, Furnace, Smeltery, Exotic Workshop)
  Bugfix      leaderboard deferUpdate — add deferUpdate() before lb button handler (5 lines)

WEEK 1 (core loop):
  Ticket 2.1  Economy rewrite (handleTax with army types + vitale display)
  Ticket 2.2  Vitale embargo (-20 confirmed, ready)
  Ticket 7.1  GM dashboard + notification_channel
  Part 2      Profile rewrite (remove XP/AC/Level, add rank/house) — see Part 2 Phase 9
  Part 2      Origins update (Tora, remove Akha, assign house) — see Part 2 Phase 9
  Part 2      Rank auto-upgrade (Scion→Dominar→Sovereign) — see Part 2 Phase 9

WEEK 2 (GM tooling):
  Ticket 3.1  Story embed GUI (Suns needs this to run RP)
  Ticket 3.2  Event templates (narrative text confirmed, ready)
  Part 2      Scheduler full rewrite (pop cap, maintenance, weekly broadcast) — Phase 11
  Part 2      Error hardening / safeReply — Phase 12
  Part 2      Empire dashboard rewrite — Phase 13

WEEK 3 (mid-game systems):
  Ticket 4.1  Trade routes (NPC text confirmed, ready)
  Ticket 8.1  Army type recruitment (confirmed, ready)
  Part 2      Leaderboard overhaul (new scoring + army types) — Phase 10

WEEK 4 (diplomacy + warfare):
  Ticket 6.1  Diplomacy GUI (Lorebook stubs for Rhagaia/Cellesela/Gaius)
  Ticket 5.1  Warfare system (all values confirmed, ready to implement)

ONGOING (after lorebook.md complete):
  Fill all LOREBOOK PENDING items above
  Rhagaia/Cellesela/Gaius faction mechanics
  Ancestry description strings
```

---

*Claude_Roadmap_Part2.md v3.1*
*All confirmed answers applied. 14 LOREBOOK PENDING items remain.*
*Do not write flavor text for LOREBOOK PENDING items without Suns confirmation.*
*Part 1 is the base design reference. This document has the prompts.*
