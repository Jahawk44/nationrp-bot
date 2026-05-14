# 🏛️ ATLAS — Claude Design Roadmap v3.0
**Ares Heiliga League | NationRP Discord Bot**
*For Antigravity IDE / Claude Sonnet 4.6 — Full design overhaul*

---

> **How to use this document**
> Each section is a self-contained implementation ticket with a verbatim **PROMPT** block for Antigravity IDE.
> Prompts include: files to read, files to write, files to NOT touch, exact function names, and a
> self-verify checklist. Sections marked `⚠️ CONFIRM WITH SUNS` must be approved before implementation.
>
> **Model recommendations:**
> - 🟢 Haiku 4.5 — Simple UI, small edits, text/constant changes
> - 🟡 Sonnet 4.6 — New features, multi-file changes
> - 🔴 Sonnet 4.6 extended thinking — Warfare, diplomacy engine, complex multi-system interactions

---

## 📋 SESSION LOG

> **Last updated: 2026-05-11 Session 3.** Full archive in `archive.md`.

| Ticket | Status |
|--------|--------|
| 1.1 — Constants/Schema | ✅ DONE — see archive.md |
| 1.2 — New Buildings | ✅ DONE — see archive.md |
| 2.1 — Economy Rewrite | ✅ DONE — see archive.md |
| Bug Fixes v1.3.0 | ✅ DONE — leaderboard, roll GUI, profile, autocomplete |
| Bug Fixes v1.3.1 | ✅ DONE — roll GUI ownership (substat args fix), leaderboard category passthrough |
| 7.1 — GM Dashboard | ❌ NEXT |
| 3.1 — Story Embed | ❌ NEXT |
| 2.2 — Embargo | ⏸️ Q1 resolved: threshold = **-20** (confirmed) |
| All others | ❌ TODO |

**Open Q resolved this session:**
- Q1 ✅ Embargo threshold = -20 (confirmed by Suns)
- Q3 ✅ Polysia cavalry bonus = +10 (confirmed)
- Q4 ✅ Akha = removed from creation entirely (done)
- Q7 ✅ Mercs = hired blades from the Sciatic frontier (lore confirmed)
- Q8 ✅ Atomic Guild +1 = story embed rolls only, not all rolls
- Q9 ✅ NPC trade flavour text confirmed below in Ticket 4.1

**Still waiting on Suns (lorebook.md):**
- Q5: Tora description string
- Q6: Song and Linerian descriptions
- Q10: GM event narrative text (famine/plague/raid etc.)
- Q2: Rhagaia / Sellesela / Gaius specific mechanics

---

## 🗺️ WORLD & CITIZENSHIP REFERENCE (Lore-Confirmed)

### Great Houses of the Styx Empire
| House | Culture / Ancestry | Vitale Required? |
|-------|--------------------|-----------------|
| **Tyrannite** | Styx ancestry | Yes |
| **Rhagaia** | Incanzil ancestry | Yes |
| **Sellesela** | Polysia-Estuarin, Polysia-Riparian | Yes |
| **Gaius** | Tolkhai ancestry | Yes |
| **Caossa** | Daxos ancestry, Tora ancestry | Yes |

### Independent Cultures (No House — Vitale Subsidized Forever)
| Ancestry | Affiliation |
|----------|-------------|
| Alexians | Linarian (independent) |
| Sciatic | Sciatic League |
| Elvish | Colonia Free Tribe |
| Song | Independent ⚠️ *Lore unconfirmed — keep in code, hide description until Suns confirms* |
| Linerian | Independent ⚠️ *Lore unconfirmed* |
| Akha | ✅ **REMOVED** from character creation (2026-05-11). Not in constants.js. Do not re-add until Suns confirms lore. |

### New Ancestry: Tora
- **House:** Caossa
- **Culture:** Native peoples of the Caossi Dominion. Egyptian/Mali-Songhai inspired — builder-warriors, sacred river kingdoms.
- **Stat bonuses:** WIS +2, STR +1
- **Description string:** ⚠️ DO NOT WRITE — ask Suns

### Player Rank System
| Rank | Condition | Display Title |
|------|-----------|---------------|
| **Scion** | No town settled | "Scion of [House / Affiliation]" |
| **Dominar** | ≥1 town, no nation | "Dominar of [Town Name]" |
| **Sovereign** | Nation founded | Player-defined custom title |

- **Scion** = enrolled in Imperial Academy. Vitale fully subsidized. Cannot declare war.
- **Dominar** = submits to Styx Empire. Vitale still subsidized (shown informatively). Can do field battle. Cannot capture towns.
- **Sovereign** = independent. Pays full Vitale cost. Can siege and capture towns.

---

## 🏗️ ARCHITECTURE RULES (Read Before Coding)

### File Budget
- **350 lines max per file.** If approaching limit, split into `[name]_helpers.js`.
- New command logic → `src/commands/atlas/[name].js` (routed through `atlas.js`)
- New admin tools → `src/commands/admin.js` (logic delegated to `atlas/[name].js`)
- Never write business logic in `interactionCreate.js` — routing only.
- DB migrations → always add to `helpers.js initDB()` array, never to `database.js`.

### Discord Hard Limits
| Limit | Value |
|-------|-------|
| Button customId | 100 chars max — use short codes (a/d/t not attacker/defender/town) |
| Embed description | 4096 chars |
| Select menu options | 25 max |
| ActionRows per message | 5 max |
| Buttons per row | 5 max |
| Modal text input value | 4000 chars |

### Patterns to Use Everywhere
```js
// Safe reply (always use — never raw interaction.reply in handlers):
await safeReply(interaction, { content/embeds/components }, ephemeral?)

// Notification channel (fallback chain):
notification_channel → last_tax_channel → ADMIN_CHANNEL_ID

// Single DB UPDATE per handler (batch all changes, one query):
await db.run('UPDATE users SET a=a+?, b=b+?, c=? WHERE id=?', ...)
```

---

## CONFIRMED RESOURCE LIST

| Resource | DB Column | Source | Primary Use |
|----------|-----------|--------|-------------|
| Balance 🪙 | `balance` | Daily tax +100 | Recruit, bribe, mercenaries, town rename |
| Wealth ⚖️ | `wealth` | Buildings, trade routes | Nation founding, construction, Vitale market |
| Food 🥩 | `food_surplus` | Farms, Livestock | Pop growth, military upkeep, siege supply (pre-deducted) |
| Ores ⚒️ | `ores` | Mine, Deep Mine | Smelted into Metallurgy via Furnace |
| Metallurgy 🔩 | `metallurgy` *(new)* | Furnace, Smeltery | Conscription requirement, siege engines, wall upgrades |
| Vitale 💧 | `vitale` | Styx Empire market, trade routes | Noble upkeep (Sovereign only — shown-only for others) |
| Exotics 🍷 | `exotics` | Exotic Workshop, Sciatic trade routes | Faction bribes (+3 relation), population happiness, player trade |
| Servus 🔗 | `servus` | Sciatic trade routes | +2% production/unit — stability risk |

**Removed:** Raw ores no longer produce anything standalone. Ores → Furnace → Metallurgy.

---

## PHASE 1 — CONSTANTS & SCHEMA ✅ COMPLETE
> Tickets 1.1 and 1.2 fully implemented. See `archive.md` for original prompts and verification checklists.

---

## PHASE 2 — ECONOMY

### TICKET 2.1 ✅ COMPLETE
> handleTax, handlePopulation, handleBalance rewritten. See `archive.md`.

---

### TICKET 2.2 — Vitale Market Embargo
**Model:** 🟢 Haiku 4.5
**✅ Q1 RESOLVED: Embargo threshold = -20 (confirmed by Suns). READY TO IMPLEMENT.**



**PROMPT:**
```
You are adding an Embargo gate to the Vitale market in ATLAS economy.js.

EDIT: src/commands/atlas/economy.js (handleEmpire and handleButton vitale_buy only)
DO NOT TOUCH: any other function or file.

TASK 1 — In handleEmpire, after building the embed:
  const rel = await db.get(
    'SELECT score FROM relations WHERE user_id = ? AND faction_name = ?',
    interaction.user.id, 'Tyrannite'
  );
  const embargoThreshold = parseInt(process.env.EMBARGO_THRESHOLD || '-20');
  const isEmbargoed = rel ? rel.score <= embargoThreshold : false;

  If isEmbargoed:
    Buy button: disabled=true, label='🚫 Embargoed by Styx Empire', style=Danger
    Add embed footer: "Your nation has been embargoed. Trade with other players for Vitale."
  Else: normal buy button.

TASK 2 — In handleButton vitale_buy, re-check embargo before showing modal:
  Same check as above. If embargoed: safeReply ephemeral "🚫 You are embargoed..."

SELF-VERIFY:
- [ ] isEmbargoed defaults false when no relation row exists
- [ ] Player can still receive Vitale via /atlas gift even when embargoed
- [ ] .setDisabled(true) used on button
- [ ] No change to modal or purchase logic if not embargoed
```

---

## PHASE 3 — GM STORY EMBED SYSTEM

### TICKET 3.1 — Story Embed GUI (Template-Based, No Auto-Deductions)
**Model:** 🔴 Sonnet 4.6 extended thinking | No confirmation needed

**Key design decisions:**
- No success/failure text strings in customIds — GM posts the consequence embed manually after seeing the roll result.
- Resource costs are shown as GM notifications in #atlas-hq — never auto-deducted.
- Players get interactive choice buttons (not just a roll button).
- Templates are saveable and pre-fill fields on next use.

**PROMPT:**
```
You are building the GM Story Embed system for ATLAS bot (Discord.js v14).

CREATE: src/commands/atlas/story.js (split to story_helpers.js if > 300 lines)

ADD TO:
- src/commands/admin.js        (new subcommandGroup 'story', subcommand 'post')
- src/events/interactionCreate.js (route: storypost_*, storybuild_*, storyroll_*, storychoice_*)

DO NOT TOUCH: economy.js, character.js, town.js, action.js, warfare.js, scheduler.js

═══ NEW DB TABLES (add migrations to helpers.js initDB) ═══

  CREATE TABLE IF NOT EXISTS story_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gm_id TEXT, name TEXT, title TEXT, body TEXT, image_url TEXT,
    roll_stat TEXT, dc INTEGER DEFAULT 0, choices TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS story_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT, gm_id TEXT, template_name TEXT, title TEXT,
    roll_stat TEXT, dc INTEGER, roll_result INTEGER, total INTEGER,
    mod_used INTEGER, outcome TEXT, player_choice TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

═══ FLOW ═══

  /admin story post (options: target [autocomplete user, required], template [autocomplete story_templates, optional]):

  Step A — Show ModalBuilder (action: storymodal, args: [targetId]):
    Fields:
      - title       (short, required, max 80, pre-fill from template if chosen)
      - body        (paragraph, required, max 1500, pre-fill, placeholder: "@player Your breathing feels heavy...")
      - image_url   (short, optional, pre-fill)
      - roll_stat   (short, optional — "str/mot/men/int/wis/cha/none", pre-fill)
      - dc          (short, optional — integer string, pre-fill, default "0")

  Step B — On modal submit: build PREVIEW embed (ephemeral to GM):
    Show the embed as it will appear, with placeholder choice buttons if none set yet.
    Buttons: [Add Choices] [Post to Player] [Save Template] [Cancel]
    customIds use short encoding: storybuild_choices_{targetId}, storybuild_post_{targetId},
                                   storybuild_save_{targetId}, storybuild_cancel

  Step C — [Add Choices] button (storybuild_choices_{targetId}):
    Show second ModalBuilder (up to 4 choice labels, up to 2 emojis).
    On submit: rebuild preview embed showing choices. Show [Post to Player] [Save Template].

  Step D — [Save Template] (storybuild_save_{targetId}):
    Show short modal asking for template name.
    INSERT into story_templates. Reply ephemeral: "✅ Template saved as '{name}'."

  Step E — [Post to Player] (storybuild_post_{targetId}):
    1. Fetch target user. Get channel via getNotificationChannel(client, targetUser).
    2. Build PUBLIC story embed:
       Color: 0x6A0DAD. Title from input. Description: mention @targetId + body.
       Image if provided. Footer: roll_stat !== 'none' ? "Roll: {STAT} | DC {dc}" : "No roll required"
    3. Build components:
       Row 1 (choices if any): up to 4 ButtonBuilders, customId = 'storychoice_{i}_{targetId}_{stat}_{dc}'
         IMPORTANT: encode stat and dc here but NOT label text — labels come from story_events lookup
       Row 2 (if roll_stat !== 'none'): Roll button customId = 'storyroll_{stat}_{dc}_{targetId}'
    4. Send embed to target channel, ping target.
    5. INSERT story_events row (outcome=null). Store choice labels as JSON in a temp lookup
       (either in story_events.player_choice as a JSON map, or fetch from template).
    6. Reply ephemeral to GM: "Story posted. Awaiting player response."

  IMPORTANT: customIds must stay under 100 chars. Use 'none' for stat if no roll. dc as integer string.
  Do NOT put choice label text in customId — too long. Fetch label from DB when button is pressed.

  ═══ Button Handlers (story.js) ═══

  handleStoryRoll(interaction, args):  [storyroll_{stat}_{dc}_{targetId}]
    1. Check interaction.user.id === args[2] (targetId). If not: safeReply ephemeral "Only the target player can roll."
    2. Fetch user. stat value from attr_{stat}. mod = getMod(val).
    3. roll = Math.floor(Math.random()*20)+1. total = roll + mod.
    4. outcome = total >= parseInt(args[1]) ? 'success' : 'failure'
    5. Build result embed (green success 0x00FF88 / red failure 0xFF0000):
       "1d20 ({roll}) + {fmtMod(mod)} ({stat.toUpperCase()}) = **{total}** vs DC **{dc}**"
       Outcome: "**SUCCESS** ✅" or "**FAILURE** ❌"
    6. Edit original message: components: [] (disable all buttons).
    7. Post result embed as reply to story message (not ephemeral).
    8. Post to resolveAtlasHQ:
       Title: "📋 STORY ROLL: {outcome.toUpperCase()}"
       Fields: Player, Stat, Roll, Mod, Total, DC, Outcome
       Note: "Apply consequences manually using /admin event fire [type] [player] or /admin story post"
    9. UPDATE story_events SET roll_result=?, total=?, mod_used=?, outcome=? WHERE user_id=? ORDER BY id DESC LIMIT 1

  handleStoryChoice(interaction, args):  [storychoice_{i}_{targetId}_{stat}_{dc}]
    1. Check user is targetId.
    2. Fetch latest story_events row for user to get choice label (store choices JSON in story_events on post).
    3. Mark player_choice = choiceLabel. Edit message: disable all buttons.
    4. Reply public: "{mention} chose: **{choiceLabel}**"
    5. If stat !== 'none': call handleStoryRoll internal logic (re-use, don't duplicate).
    6. Post to resolveAtlasHQ: "Player chose option {i}: {label}. Roll included if applicable. Apply consequences."

  Autocomplete for 'template': query story_templates WHERE gm_id = caller's id.

SELF-VERIFY:
- [ ] Only targetId can click Roll/Choice buttons
- [ ] ALL customIds < 100 chars — no label text in customId
- [ ] Zero auto-deductions anywhere in story.js
- [ ] GM always notified in resolveAtlasHQ
- [ ] Template pre-fill uses modal .setValue() for all fields
- [ ] story.js under 300 lines (split to story_helpers.js if needed)
- [ ] DB operations parameterized
```

---

### TICKET 3.2 — GM Event Templates
**Model:** 🟡 Sonnet 4.6
**⚠️ CONFIRM WITH SUNS: Narrative text for each event embed before implementing**

**PROMPT:**
```
You are building GM event templates for ATLAS bot (Discord.js v14).

CREATE: src/commands/atlas/events.js

ADD TO: src/commands/admin.js (new subcommandGroup 'event')
READ: src/utils/helpers.js (resolveAtlasHQ, safeReply, getNotificationChannel, isGM)
DO NOT TOUCH: economy.js, story.js, action.js, scheduler.js, warfare.js

═══ NEW DB TABLE (add migration to helpers.js) ═══
  CREATE TABLE IF NOT EXISTS gm_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT, gm_id TEXT, event_type TEXT, severity INTEGER DEFAULT 1,
    effect_snapshot TEXT,  ← JSON of BEFORE values only
    resolved INTEGER DEFAULT 0,
    created_at INTEGER     ← Date.now()
  );

═══ TASK 1 — admin.js: subcommandGroup 'event', subcommands ═══
  fire:  target(autocomplete user, required), type(choice list, required), severity(Integer 1-3, default 1), amount(Integer, optional — tribute only)
  undo:  target(autocomplete user, required), event_type(choice, required)
  list:  target(autocomplete user, required)

  Event type choices: famine | plague | raid | harvest | noble_unrest | imperial_favor | servus_uprising | tribute

═══ TASK 2 — events.js handleEventFire(interaction, type, targetId, severity, amount) ═══

  a. isGM check.
  b. Fetch full user row.
  c. Compute effect per type (see table below). Never go below 0 on wealth/food/pop.
  d. snapshot = JSON.stringify of ONLY the fields being changed, BEFORE values.
  e. INSERT gm_events: { user_id, gm_id, event_type, severity, effect_snapshot: snapshot, resolved:0, created_at: Date.now() }
  f. Apply DB UPDATE (parameterized).
  g. Fetch target notification channel via getNotificationChannel(client, user).
  h. Build narrative embed:
     IMPORTANT: All embed title/description marked with:
       // TODO SUNS: Replace placeholder text with actual narrative
       Placeholder title: "[EVENT TYPE] strikes {username}"
       Placeholder desc: "A [EVENT TYPE] event has occurred. Severity: {severity}/3"
     Post embed to target channel, ping target.
  i. Post to resolveAtlasHQ: "✅ Event fired: {type} (sev {severity}) on {username}. Effects applied: {description}"
  j. safeReply ephemeral to GM: "Event fired. Use /admin event undo {username} {type} within 1h to reverse."

  EFFECT TABLE (exact SQL deltas):
    famine:          food_surplus = MAX(-9999, food_surplus - (500*severity)), rate_stab = MAX(-10, rate_stab - severity)
    plague:          pop_commoners = MAX(10, CAST(pop_commoners * (1 - 0.15*severity) AS INTEGER)), rate_stab = MAX(-10, rate_stab - severity)
    raid:            wealth = MAX(0, wealth - (500*severity))
    harvest:         food_surplus = food_surplus + (2000*severity), rate_stab = MIN(10, rate_stab + 1)
    noble_unrest:    rate_prest = MAX(-10, rate_prest - (2*severity))
    imperial_favor:  rate_prest = MIN(10, rate_prest + 3), vitale = COALESCE(vitale,0) + (10*severity)
    servus_uprising: delegates to existing rebellion button handler (import from warfare.js)
    tribute:         wealth = MAX(0, wealth - ?) using amount parameter

═══ TASK 3 — events.js handleEventUndo(interaction, targetId, eventType) ═══
  a. isGM check.
  b. Fetch most recent gm_events WHERE user_id=target AND event_type=type AND resolved=0
     AND created_at >= Date.now()-3600000.
  c. If none: safeReply "No undoable {type} event for this player within 1 hour."
  d. Parse snapshot JSON. Build UPDATE restoring each field to before-value.
  e. UPDATE gm_events SET resolved=1 WHERE id=?
  f. safeReply: "↩️ Event reversed for {username}."

═══ TASK 4 — events.js handleEventList(interaction, targetId) ═══
  Fetch last 10 gm_events. Build embed: type, severity, date, resolved status.

SELF-VERIFY:
- [ ] snapshot is BEFORE values, not deltas
- [ ] undo restores exact before values
- [ ] servus_uprising routes to warfare.js rebellion logic, not duplicated here
- [ ] tribute uses amount param (not severity)
- [ ] All narrative text marked TODO
- [ ] events.js under 300 lines
- [ ] All db.run parameterized (no string interpolation)
```

---

## PHASE 4 — TRADE ROUTES

### TICKET 4.1 — Automated Trade Routes (Mid-Game, Weekly Resolution)
**Model:** 🔴 Sonnet 4.6 extended thinking
**⚠️ CONFIRM WITH SUNS: NPC route flavor text for Styx/Sciatic/Caossa**

**PROMPT:**
```
You are implementing the Trade Route system for ATLAS bot (Discord.js v14).

CREATE: src/commands/atlas/trade.js

ADD TO:
- src/commands/atlas/atlas.js  (subcommands: /atlas traderoute list/propose/cancel)
- src/scheduler.js             (add route resolution to existing weekly cron)
- src/utils/helpers.js         (add trade_routes + treaties table migrations)

DO NOT TOUCH: economy.js handleTrade (one-time trade stays), story.js, events.js, warfare.js

═══ NEW DB TABLES (migrations in helpers.js) ═══

  CREATE TABLE IF NOT EXISTS trade_routes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    initiator_id TEXT, partner_id TEXT, partner_type TEXT,
    give_resource TEXT, give_amount INTEGER,
    receive_resource TEXT, receive_amount INTEGER,
    duration_turns INTEGER, turns_remaining INTEGER,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS treaties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    initiator_id TEXT, partner_id TEXT, treaty_type TEXT,
    status TEXT DEFAULT 'pending',
    turns_active INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

═══ TRADE ROUTE PARTNERS ═══

  styx:    give Wealth, receive Vitale — dynamic price, embargo blocks
  sciatic: give Exotics or Balance, receive Servus — requires relations['Sciatic League'] >= 10
  caossa:  give Balance or Exotics, receive Ores or Metallurgy — requires relations['Caossa'] >= 5
  player:  any resource ↔ any resource — both must agree (pending until accept)
  tribute: forced by admin — cannot be cancelled by player

═══ TASK 1 — atlas.js subcommands ═══
  /atlas traderoute list    → handleTradeRouteList
  /atlas traderoute propose → handleTradeRoutePropose
    options: partner_type(choice: player/styx/sciatic/caossa), partner(autocomplete, if player type),
             give_resource(choice), give_amount(Integer), receive_resource(choice), receive_amount(Integer),
             duration(Integer 1-10)
  /atlas traderoute cancel  → handleTradeRouteCancel
    options: route_id(Integer, required — from list)

═══ TASK 2 — trade.js handleTradeRoutePropose ═══
  a. Validate relation requirements (Sciatic >=10, Caossa >=5). Skip for styx/player.
  b. For player: INSERT status='pending'. Send embed to partner's notification channel with
     [Accept] [Reject] buttons. customId: 'traderoute_a_{routeId}' / 'traderoute_r_{routeId}'
  c. For NPC: INSERT status='active' directly.
  d. Confirm to initiator with route summary embed.

═══ TASK 3 — trade.js handleTradeAccept/Reject ═══
  Accept: UPDATE status='active'. Notify initiator.
  Reject: UPDATE status='broken'. Notify initiator.

═══ TASK 4 — scheduler.js: add to weekly cron AFTER turn increment ═══

  const routes = await db.all('SELECT * FROM trade_routes WHERE status IN ("active","tribute")');
  for (const route of routes) {
    const user = await db.get('SELECT * FROM users WHERE id = ?', route.initiator_id);
    if (!user) continue;

    // Can initiator pay?
    if ((user[route.give_resource] || 0) < route.give_amount) {
      await db.run('UPDATE trade_routes SET status="paused" WHERE id=?', route.id);
      const chan = await getNotificationChannel(client, user);
      if (chan) chan.send({ content: `⚠️ <@${route.initiator_id}> Your trade route (ID ${route.id}) paused — insufficient ${route.give_resource}.` });
      continue;
    }

    // For styx: recalculate Vitale price dynamically at resolution
    let receiveAmount = route.receive_amount;
    if (route.partner_type === 'styx') {
      const vitaleSold = parseInt((await db.get('SELECT value FROM global_settings WHERE key="vitale_sold_week"'))?.value || '0');
      const playerCount = (await db.get('SELECT COUNT(*) as c FROM users WHERE status="active"'))?.c || 1;
      const vitalePool = (parseInt((await db.get('SELECT value FROM global_settings WHERE key="vitale_base"'))?.value) || 15) + (10 * playerCount);
      const demandRatio = vitaleSold / Math.max(1, vitalePool);
      const price = Math.floor(50 * (1 + demandRatio * 4));
      // receiveAmount = how much Vitale the give_amount of wealth buys at current price
      receiveAmount = Math.floor(route.give_amount / price);
      if (receiveAmount < 1) { /* can't afford even 1 vitale this week */ continue; }
      await db.run('UPDATE global_settings SET value=CAST(value AS INTEGER)+? WHERE key="vitale_sold_week"', receiveAmount);
    }

    // Apply exchange
    await db.run(`UPDATE users SET ${route.give_resource}=${route.give_resource}-? WHERE id=?`, route.give_amount, route.initiator_id);
    await db.run(`UPDATE users SET ${route.receive_resource}=COALESCE(${route.receive_resource},0)+? WHERE id=?`, receiveAmount, route.initiator_id);

    // Player-to-player reverse leg
    if (route.partner_type === 'player' && route.partner_id) {
      await db.run(`UPDATE users SET ${route.receive_resource}=${route.receive_resource}-? WHERE id=?`, receiveAmount, route.partner_id);
      await db.run(`UPDATE users SET ${route.give_resource}=COALESCE(${route.give_resource},0)+? WHERE id=?`, route.give_amount, route.partner_id);
    }

    // Decrement turns
    await db.run('UPDATE trade_routes SET turns_remaining=turns_remaining-1 WHERE id=?', route.id);
    const newRemaining = route.turns_remaining - 1;
    if (newRemaining <= 0) {
      await db.run('UPDATE trade_routes SET status="completed" WHERE id=?', route.id);
      const chan2 = await getNotificationChannel(client, user);
      if (chan2) chan2.send({ content: `✅ <@${route.initiator_id}> Your trade route (ID ${route.id}) has completed.` });
    }
  }

═══ TASK 5 — Admin tribute command ═══
  /admin tribute: options loser(autocomplete), winner(autocomplete), resource(choice), amount(Integer), turns(Integer)
  INSERT trade_routes: initiator_id=loser, partner_id=winner, partner_type='tribute',
                       give_resource=resource, give_amount=amount, receive_resource=resource,
                       receive_amount=amount, duration_turns=turns, turns_remaining=turns,
                       status='tribute'
  Route cannot be cancelled by player (handleTradeRouteCancel checks status !== 'tribute').

SELF-VERIFY:
- [ ] Player routes require accept before becoming active
- [ ] Styx routes use dynamic price at resolution, not setup price
- [ ] NPC routes validate relation scores
- [ ] Tribute routes not cancellable by player
- [ ] Weekly scheduler handles routes in existing Monday cron (no new cron)
- [ ] trade.js under 300 lines
- [ ] All db.run parameterized
```

---

## PHASE 5 — WARFARE SYSTEM

### TICKET 5.1 — Warfare GUI + warfare.js (Morale, Field Battle, Siege)
**Model:** 🔴 Sonnet 4.6 extended thinking
**⚠️ CONFIRM WITH SUNS: Polysia cavalry bonus value (placeholder +10). Morale flavor text.**

**PROMPT:**
```
You are implementing the full Warfare system for ATLAS bot (Discord.js v14).

CREATE: src/commands/atlas/warfare.js (split to warfare_calc.js if > 300 lines)

ADD TO:
- src/commands/atlas/atlas.js        (/atlas action warfare, /atlas action battle)
- src/events/interactionCreate.js    (route: warapprove_*, warreject_*, warconfirm_*, warbattle_*)
- src/commands/admin.js              (/admin warfare siege — routes to warfare.js)

READ: helpers.js (getMod, getCharBonuses, resolveAtlasHQ, safeReply, getPlayerRank, getNotificationChannel)
      constants.js (BUILDINGS, TERRAINS, ANCESTRIES)

DO NOT TOUCH: action.js (keep scout/recruit intact), economy.js, story.js, events.js

═══ CONSTANTS (top of warfare.js only) ═══
  const TERRAIN_DEF = { MOUNTAIN:15, FOREST:8, HILLS:5, RIVERLANDS:3, PLAINS:0, COASTAL:-2, SWAMP:6 };
  const POLYSIA_KEYS = ['POLYSIA-ESTUARIN','POLYSIA-RIPARIAN'];
  const STYX_HOUSES  = ['TYRANNITE','RHAGAIA','CELLESELA','GAIUS','CAOSSA'];

═══ MORALE & POWER HELPERS (warfare.js — not exported) ═══

  function calcMorale(user):
    base = 100
      + (user.rate_stab  || 0) * 3
      + (user.rate_prest || 0) * 2
      - Math.max(0, -(user.food_surplus || 0)) * 5
      - Math.floor((user.servus || 0) / 5) * 2
    return Math.max(30, Math.min(150, base))

  function effectiveStrength(user):
    return Math.floor(((user.mil_strength || 0) + (user.mercs_temp || 0)) * (calcMorale(user) / 100))

  async function calcOffenseScore(db, userId):
    towns = await db.all('SELECT id FROM towns WHERE user_id = ?', userId)
    off = 0
    for each town:
      bldgs = SELECT type FROM buildings WHERE town_id=? AND (ready_at IS NULL OR ready_at<=now)
      BARRACKS → off+=1, CASTLE → off+=2, PALACE → off+=3
    return off

  async function calcDefenseScore(db, townId):
    bldgs = SELECT type FROM buildings WHERE town_id=? AND (ready_at IS NULL OR ready_at<=now)
    PALISADE→1, BASIC_WALL→2, ADVANCED_WALL→3, CASTLE→5
    return total

═══ TASK 1 — handleBattleInitiate (player calls /atlas action battle) ═══

  Options: target(autocomplete user, required), reason(String optional)

  a. rank = getPlayerRank(user). Must be DOMINAR or SOVEREIGN. Scion: reply "Scions cannot declare battle."
  b. Fetch attacker + defender. Check ANCESTRIES[atk.ancestry?.toUpperCase()]?.house
     !== ANCESTRIES[def.ancestry?.toUpperCase()]?.house (different house OR one independent).
     Same house: reply "You cannot attack a member of the same Great House."
  c. attackerFoodCost = (attacker.mil_strength + (attacker.mercs_temp||0)) * 2
     If attacker.food_surplus < attackerFoodCost: reply "⚠️ Insufficient supplies. Need {cost} 🥩."
     DEDUCT NOW: UPDATE users SET food_surplus = food_surplus - ? WHERE id = atkId
  d. Post battle request to resolveAtlasHQ:
     Embed: attacker name, target name, reason, attacker force overview (mil_strength, mercs, morale preview)
     Buttons: [Approve Battle] [Reject Battle]
     customId: 'warapprove_battle_{atkId}_{defId}' / 'warreject_battle_{atkId}_{defId}'
  e. Reply to attacker: "⚔️ Battle request submitted. Awaiting GM approval. {cost} 🥩 supply spent."

═══ TASK 2 — handleBattleApprove (GM clicks approve) ═══

  a. isGM check.
  b. Re-fetch both users.
  c. Deduct defender food: defFoodCost = (def.mil_strength||0) * 2. MAX(0, food_surplus - cost).
  d. Roll d20 for both (fresh, at approval time).
  e. atkOff = await calcOffenseScore(db, atkId)
     defOff = await calcOffenseScore(db, defId)
     menMod = getMod(atk.attr_men || 10)
     polysiaBonus = POLYSIA_KEYS.includes(atk.ancestry?.toUpperCase()) ? 10 : 0  ← ⚠️ CONFIRM VALUE
     styxBonus = STYX_HOUSES.includes(ANCESTRIES[def.ancestry?.toUpperCase()]?.house) ? 8 : 0

     atkPower = effectiveStrength(atk) + (atkOff*5) + (menMod*2) + polysiaBonus + atkRoll
     defPower = effectiveStrength(def)*1.2 + (defOff*5) + styxBonus + defRoll

  f. winner = atkPower > defPower ? 'attacker' : 'defender'
     loser  = winner === 'attacker' ? 'defender' : 'attacker'
     loserUser = winner === 'attacker' ? def : atk
     winnerUser = winner === 'attacker' ? atk : def

  g. Apply results:
     loser:  hp_current = MAX(1, hp_current - (10 + Math.floor(Math.random()*16)))  ← -10 to -25, never 0
             rate_stab -= 1
             rate_prest -= 2
             mil_strength = MAX(0, floor(mil_strength * (0.70 + Math.random()*0.15)))
     winner: rate_prest = MIN(10, rate_prest + 1)
     Both: UPDATE users SET ... WHERE id=?

  h. Post result embeds to each player's notification channel (getNotificationChannel).

  i. 20% chance winner gets substat pick:
     if (Math.random() < 0.20):
       Post embed to winner's channel: "✨ Your performance was exceptional. Choose a substat to improve:"
       6 buttons (one per stat): customId 'warbattle_ss_{statKey}_{winnerId}'
       Use 2 rows of 3 buttons.

  j. Log to gm_events (type='field_battle', effect_snapshot includes both users' mil_strength before).
  k. Disable approve/reject buttons in GM channel.

═══ TASK 3 — handleBattleSubstat ═══
  a. Check interaction.user.id === winnerId.
  b. UPDATE users SET attr_{statKey} = MIN(20, attr_{statKey} + 1) WHERE id = ?
  c. Disable buttons. Reply: "✨ Your {statName} improved! ({oldVal} → {oldVal+1})"

═══ TASK 4 — handleSiegeInitiate (GM calls /admin warfare siege) ═══
  Options: attacker, defender, target_town (autocomplete)
  Nation rank required for attacker (check in admin execute before calling).

  a. Pre-deduct attacker food: mil_strength * 5. Block if insufficient.
  b. Deduct defender food: mil_strength * 2. If insufficient: halve effective strength (flag, don't block).
  c. Build GM preview embed (resolveAtlasHQ, ephemeral context):
     Show: atkPower components, defPower components, terrain bonus, morale values, food flags, dice NOT rolled yet.
     Buttons: [Confirm Siege] [Abort Siege]
     customId: 'warconfirm_s_{atkId}_{defId}_{townId}'  ← keep short

═══ TASK 5 — handleSiegeConfirm ═══
  a. isGM check. Re-fetch everything fresh.
  b. Roll d20s now.
  c. Calc both powers (same formula, add terrain + defense score from target town).
  d. Determine winner.
  e. Apply DB results (same as field battle but heavier):
     Attacker win: atk mil_strength *= random(0.70,0.90). def mil_strength *= random(0.40,0.70).
                   def rate_stab -= 3. atk rate_prest += 2.
     Defender win: def mil_strength *= random(0.85,0.95). atk mil_strength *= random(0.60,0.80).
                   atk rate_stab -= 2. def rate_prest += 3.
  f. On attacker win: post to resolveAtlasHQ: "Select building to destroy in {town}:"
     Buttons for each completed building in target town. customId: 'warsiege_destroy_{bldgId}_{defId}'
  g. Post result embeds to both players.
  h. Log to gm_events.

═══ TASK 6 — handleRebellion (replaces placeholders in action.js) ═══
  Move here from action.js rebellion/revolt button handlers.

  Servus rebellion (fires when rate_stab <= -5 AND servus > 0):
    rebel_str = servus * 3
    if mil_strength > rebel_str: UPDATE stab-1, servus = MAX(0, servus-5)
    else: UPDATE stab-5, wealth=MAX(0,wealth-2000), servus=0
          [destroy random building logic: SELECT buildings for user, pick random, DELETE it]

  Noble revolt (fires when rate_prest <= -3 AND nobles > 0):
    nobles = floor(pop_commoners/50)
    defectors = floor(nobles * Math.abs(rate_prest) / 10)
    if mil_strength > defectors * 10: UPDATE prest-1
    else: UPDATE prest-5, status='deposed', notify GM in resolveAtlasHQ

SELF-VERIFY:
- [ ] Food deducted BEFORE GM approval
- [ ] hp_current MAX(1,...) — player never dies
- [ ] Substat +1 capped at MIN(20,...)
- [ ] Dominar = field battle only (no siege), Sovereign = both, Scion = neither
- [ ] Different house check for field battle
- [ ] d20 rolled at approval/confirm time, not preview/initiate time
- [ ] warfare.js + warfare_calc.js combined under 350 lines each
- [ ] All customIds < 100 chars
- [ ] Rebellion/revolt handlers removed from action.js and replaced with import from warfare.js
```

---

## PHASE 6 — DIPLOMACY GUI

### TICKET 6.1 — /atlas diplomacy (Replaces /atlas relation + /atlas faction)
**Model:** 🟡 Sonnet 4.6
**⚠️ CONFIRM WITH SUNS: Rhagaia, Cellesela, Gaius faction bonuses/penalties before full implementation**

**PROMPT:**
```
You are building the /atlas diplomacy GUI for ATLAS bot (Discord.js v14).

CREATE: src/commands/atlas/diplomacy.js
ADD TO: atlas.js (subcommand /atlas diplomacy), interactionCreate.js (diplo_* routing)
READ: constants.js (FACTIONS, GREAT_HOUSES, ANCESTRIES), helpers.js (safeReply, isVitaleFree)
DO NOT TOUCH: economy.js, warfare.js, trade.js, story.js

═══ CONFIRMED FACTION MECHANICS ═══

  Tyrannite ≥15:  access to Empire Ruler candidacy, Vitale market unlocked
  Tyrannite ≤-20: embargoed (already handled in economy.js)
  Caossa    ≥10:  ore/metallurgy +10% (apply at tax time — read relation score in handleTax)
  Caossa    ≤-20: Caossa trade routes blocked
  Sciatic   ≥10:  Exotic/Servus trade route access (enforced in trade.js)
  The Mothers ≥10: noble vitale upkeep halved (apply in handleTax for Sovereigns)
  The Fathers ≥10: mil_strength cap raised +50% (enforce in warfare.js recruit check)
  Atomic Guild ≥15: +1 to GM story roll checks (warfare.js/story.js reads this at roll time)
  Atomic Guild ≤-20: 5% rebel/2% servus/0.5% assassination CHECK — notify GM only, never auto-fire
  Rhagaia/Cellesela/Gaius: ⚠️ PLACEHOLDER — mark as "// TODO SUNS: add mechanic" — do not implement yet

═══ TASK 1 — /atlas diplomacy: main GUI (ephemeral) ═══
  Fetch all faction relations for user. Build embed:
    Title: "🤝 DIPLOMATIC LEDGER — {username}"
    For each faction in FACTIONS array: one line:
      [emoji] {faction}: [score bar as ████░░ text -30 to +30] {status tag}
      status: ≥15→"Allied ✅" | ≥0→"Neutral" | ≥-10→"Strained ⚠️" | <-10→"Hostile 🔴" | ≤-20 Tyrannite→"EMBARGOED 🚫"
    Score bar: 10-segment text bar. segments = Math.round((score + 30) / 6). "█".repeat(segments) + "░".repeat(10-segments)
  Components:
    Row 1: StringSelectMenu "diplo_view_{userId}" — list all factions
    Row 2: [View Treaties] [View Trade Routes] [Propose Treaty]
    customIds: diplo_treaties_{userId}, diplo_routes_{userId}, diplo_treaty_{userId}

═══ TASK 2 — Faction detail view (diplo_view select) ═══
  Show detail embed for chosen faction:
    Current score, unlock at threshold, penalty at threshold, current status.
    [Back] button.

═══ TASK 3 — Treaties view ═══
  Fetch treaties WHERE initiator_id OR partner_id = userId.
  List: partner, type, status, turns active.

═══ TASK 4 — Trade routes view ═══
  Fetch trade_routes WHERE (initiator_id OR partner_id = userId) AND status NOT IN ('completed').
  List: partner, give/receive resources, turns remaining, status.

═══ TASK 5 — Treaty propose flow ═══
  On [Propose Treaty]: show StringSelectMenu of treaty types (trade_pact/non_aggression/alliance).
  On select: show player autocomplete. On confirm: INSERT treaties status='pending', notify partner.
  Partner gets Accept/Reject embed with buttons.
  On Accept: UPDATE status='active'.
  On Reject: UPDATE status='broken'. Notify initiator.
  Note: treaties are BINDING — only admin can dissolve (/admin treaty dissolve → UPDATE status='broken').

═══ TASK 6 — Bribe buttons (in faction detail view) ═══
  [Bribe with 500🪙] — disabled if balance < 500 or cooldown active
  [Bribe with 1 Exotic] — disabled if exotics < 1 or cooldown active
  Cooldown: 1 bribe per faction per 24h. Store in relations table:
    Add migration: ALTER TABLE relations ADD COLUMN last_bribe INTEGER DEFAULT 0
  On bribe:
    500🪙 → balance -= 500, UPDATE relations SET score=score+1, last_bribe=now
    1 Exotic → exotics -= 1, UPDATE relations SET score=score+3, last_bribe=now

═══ TASK 7 — Atomic Guild check (add minimal code to economy.js handleTax) ═══
  At end of handleTax, AFTER the main UPDATE:
    const ag = await db.get('SELECT score FROM relations WHERE user_id=? AND faction_name=?', userId, 'Atomic Guild');
    if (ag && ag.score <= -20) {
      const r = Math.random();
      let gmMsg = null;
      if (r < 0.005)      gmMsg = `⚠️ ASSASSINATION PLOT — Atomic Guild targeting ${username}. Review.`;
      else if (r < 0.025) gmMsg = `⚠️ SERVUS UPRISING RISK — Atomic Guild. Targeting ${username}.`;
      else if (r < 0.075) gmMsg = `⚠️ REBEL ACTIVITY — Atomic Guild. Targeting ${username}.`;
      if (gmMsg) await resolveAtlasHQ(client, new EmbedBuilder().setTitle('🔮 ATOMIC GUILD ALERT').setDescription(gmMsg).setColor(0x333333));
    }

SELF-VERIFY:
- [ ] Diplomacy GUI is always ephemeral
- [ ] Score bar renders for range -30 to +30 (not just -10 to +10)
- [ ] Atomic Guild check only notifies GM — no auto-applied effects
- [ ] Bribe cooldown tracked (last_bribe column migration added)
- [ ] Treaty binding: only admin can dissolve
- [ ] Rhagaia/Cellesela/Gaius marked TODO (no mechanics added yet)
- [ ] diplomacy.js under 300 lines
```

---

## PHASE 7 — ADMIN QOL

### TICKET 7.1 — GM Dashboard + notification_channel Setting
**Model:** 🟢 Haiku 4.5 | No confirmation needed

**PROMPT:**
```
You are adding GM quality-of-life tools to ATLAS admin.js.

EDIT: src/commands/admin.js, src/utils/helpers.js
DO NOT TOUCH: any atlas/ module file.

═══ TASK 1 — /admin dashboard (ephemeral) ═══
  Fetch all active users. Sort by wealth DESC.
  Build single embed:
    For each user one line: "{username} | {rank} | {nation||'—'} | {wealth}⚖️ | {food_surplus<=0?'⚠️FAMINE':food_surplus+'🥩'} | {mil_strength}⚔️ | Stab:{rate_stab}{rate_stab<=-3?'🔴':''} | Prest:{rate_prest}{rate_prest<=-2?'🔴':''}"
  Footer: "Turn {current_turn} | {player count} active players | Players not taxed 24h: {list}"
  Show players with status='deposed' in red text.
  Components Row 1: [Post Story] [Fire Event] [Run Siege] [Edit Player] (each is a reminder button — on click reply "Use /admin story post / /admin event fire / etc.")

═══ TASK 2 — /admin user edit: add channel_id option ═══
  channel_id (String, optional): set notification_channel for player.
  Validate: try client.channels.fetch(channelId). If fails: reply "Channel not found."
  On success: UPDATE users SET notification_channel=? WHERE id=? Reply: "Notification channel set."

═══ TASK 3 — getNotificationChannel already added in Ticket 1.1 — verify it's exported ═══
  If not present: add to helpers.js and export.

SELF-VERIFY:
- [ ] Dashboard is ephemeral
- [ ] channel_id validation fetches channel before saving
- [ ] getNotificationChannel exported from helpers.js
- [ ] No logic in admin.js beyond routing to helpers/modules
```

---

## PHASE 8 — BALANCE SPENDING

### TICKET 8.1 — Mercenaries, Bribes, Town Rename
**Model:** 🟢 Haiku 4.5
**⚠️ CONFIRM WITH SUNS: Mercenary lore flavor text**

**PROMPT:**
```
You are adding balance-spending options to ATLAS bot.

EDIT: src/commands/atlas/action.js (mercenaries), src/commands/atlas/town.js (rename)
READ: src/commands/atlas/diplomacy.js (bribing already handled there — do not duplicate)
ADD MIGRATION: 'ALTER TABLE users ADD COLUMN mercs_temp INTEGER DEFAULT 0' (skip if exists from Ticket 1.1)
ADD TO scheduler.js weekly cron: UPDATE users SET mercs_temp=0 (wipe mercenaries each Monday)

═══ TASK 1 — action.js handleRecruit: add mercenary option ═══
  Add Boolean option 'mercenary' to /atlas action recruit.
  If mercenary=true:
    cost = amount * 500 (paid in balance, not wealth)
    No Barracks required.
    UPDATE users SET balance=balance-?, mercs_temp=COALESCE(mercs_temp,0)+? WHERE id=?
    Reply: "⚔️ {amount} mercenaries hired for {cost}🪙. They will disband at end of turn."
  warfare.js effectiveStrength already uses mercs_temp — no change needed there.

═══ TASK 2 — town.js: add Rename option to town GUI ═══
  Add [Rename Town] button to town management GUI. customId: 'town_rename_{townId}'
  On click: show ModalBuilder with one field: new name (max 32 chars).
  On submit:
    cost = 1000
    Check balance >= 1000. Check name not already used by this player (SELECT FROM towns WHERE user_id=? AND name=?).
    UPDATE users SET balance=balance-1000 WHERE id=? AND UPDATE towns SET name=? WHERE id=?
    Reply: "Town renamed to {name}."

═══ TASK 3 — scheduler.js weekly cron: add at end of existing Monday cron ═══
  await db.run('UPDATE users SET mercs_temp=0 WHERE mercs_temp > 0');
  console.log('[SCHEDULER] Mercenaries disbanded.');

SELF-VERIFY:
- [ ] Mercenaries cost balance (🪙), not wealth
- [ ] Mercs expire weekly (scheduler wipe)
- [ ] Town rename costs 1000🪙
- [ ] Town rename validates name uniqueness per player
- [ ] Bribe logic NOT duplicated here (it lives in diplomacy.js)
```

---

## OPEN QUESTIONS FOR SUNS ⚠️

| # | Status | Question | Blocks |
|---|--------|----------|--------|
| Q1 | ✅ RESOLVED | Embargo threshold = **-20** | Ticket 2.2 ready |
| Q2 | ⏸️ WAITING | Rhagaia, Sellesela, Gaius faction mechanics | Ticket 6.1 |
| Q3 | ✅ RESOLVED | Polysia cavalry bonus = **+10** | Ticket 5.1 ready |
| Q4 | ✅ RESOLVED | Akha = **removed from character creation entirely** | Done |
| Q5 | ⏸️ WAITING | Tora description string (lorebook.md) | Ticket 1.1 lore only |
| Q6 | ⏸️ WAITING | Song and Linerian descriptions (lorebook.md) | Ticket 1.1 lore only |
| Q7 | ✅ RESOLVED | Mercs = **hired blades from Sciatic frontier, temp per-turn** | Ticket 8.1 ready |
| Q8 | ✅ RESOLVED | Atomic Guild bonus = **story embed rolls only**, not all rolls | Ticket 6.1 ready |
| Q9 | ✅ RESOLVED | NPC trade flavor = generic lore-neutral text (no Suns text needed, use placeholders) | Ticket 4.1 ready |
| Q10 | ⏸️ WAITING | GM event narrative text (famine/plague/raid embeds) — all marked `// TODO SUNS` | Ticket 3.2 |

---

## IMPLEMENTATION ORDER (Updated 2026-05-11)

```
DONE  → Ticket 1.1, 1.2, 2.1 (constants, buildings, economy loop)
DONE  → Bug fixes: leaderboard, roll GUI, profile, autocomplete, turn channel

NOW   → Ticket 7.1 (GM dashboard — Suns needs visibility)
NOW   → Ticket 2.2 (embargo — Q1 confirmed -20, unblock now)
NOW   → Ticket 3.1 (story embed GUI — GMs need RP tools)
NOW   → Ticket 8.1 (mercenaries + town rename — Q7 confirmed)

SOON  → Ticket 4.1 (trade routes — Q9 confirmed, use placeholder flavor text)
SOON  → Ticket 6.1 (diplomacy GUI — Q8 confirmed; Q2 still waiting but most parts ready)

LATER → Ticket 5.1 (warfare — needs story+events working first)
LATER → Ticket 3.2 (event templates — waiting on Q10 narrative text from Suns)
```

---

## KNOWN BUGS

| Bug | Status |
|-----|--------|
| Leaderboard `lb` button category not passed | ✅ Fixed — args[0] passed to handleLeaderboard |
| Roll GUI ownership check wrong arg index for substat | ✅ Fixed — each branch checks own uid arg |
| Gagoon in FACTIONS array | ✅ Fixed — renamed to Caossa |
| `handleRelation` returning "coming soon" | ⏸️ Replaced by diplomacy GUI in Ticket 6.1 |
| `handleTrade` modal flow incomplete | ⏸️ Replaced by traderoute in Ticket 4.1 |
| `stat_*` vs `attr_*` column drift | ✅ Patched in helpers.js initDB |
| Orphaned buildings | ✅ Patched in helpers.js initDB |

---

*Claude_Roadmap.md v3.1 | Session 3 | 2026-05-11*
*6/10 questions resolved. 4 waiting on lorebook.md (Q2, Q5, Q6, Q10)*
*Do not add XP, levels, or AC — this is a choice-driven nation game, not an RPG grinder*
*Next: Ticket 7.1 (GM Dashboard) → Ticket 2.2 (Embargo) → Ticket 3.1 (Story Embed)*
