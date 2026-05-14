# 📜 Atlas Bot Changelog

## [1.3.0] - 2026-05-12
### Added
- **Player Rank System**: Three ranks — `SCION` (no town), `DOMINAR` (town owner), `SOVEREIGN` (nation founder). Drives Vitale logic and gameplay gates.
- **Great House System**: All 12 ancestries now carry a `house` field (Tyrannite, Rhagaia, Sellesela, Gaius, Caossa, Independent, Sciatic League, Colonia Free Tribe). Profile now shows House affiliation.
- **Tora Ancestry**: Added to character creation with lore placeholder.
- **New Buildings**: Mine ⛏️, Deep Mine 🪨, Furnace 🔥, Smeltery ⚙️, Exotic Workshop 🍷 added to BUILDINGS constants.
- **Metallurgy Resource**: `🔩 Metallurgy` now produced by Furnace/Smeltery, shown in Treasury. Caossa-ancestry players receive +30% Metallurgy bonus and +20% Ore bonus.
- **Exotics Production**: Exotic Workshop now produces Exotics passively on tax tick.
- **Ore Consumption**: Furnace/Smeltery consume Ores during tax (ore net can go negative if supply < consumption — shown in report).
- **Username Persistence**: Username saved to DB on every slash command; autocomplete now shows Character Name (username) for all player lookups.
- **Merc Temp Wipe**: `mercs_temp` reset to 0 on weekly turn cron (Ticket 8.1 prep).

### Changed
- **Turn Notification Channel**: Weekly turn announcement now posts to `#main-hall` (`1502560573710270555`) instead of `#atlas-hq`.
- **Faction Corrections**: `Gagoon` renamed to `Caossa`, `Sellesela` corrected from earlier misspelling across all files.
- **Roll GUI**: `/atlas roll` is now ephemeral. Results are posted publicly to the channel. Only the player who opened the Oracle can interact with it.
- **Profile Redesign**: `/atlas profile` no longer shows LVL, XP, AC, HP. Now shows Rank, Great House (with color), Character Name, Ancestry/Upbringing/Profession line, and Description.
- **Audit Embed**: Character creation audit in atlas-hq now shows Ancestry, Great House, Upbringing, Profession — no AC/HP.
- **Vitale Logic**: Sovereigns pay Vitale; Scions and Dominars see it as informational (subsidized by Imperial Academy).

### Fixed
- **Leaderboard Button Crash**: Added `deferUpdate()` before leaderboard category button handler. No more interaction timeout.
- **Username Autocomplete**: User autocomplete now shows `CharacterName (discordUsername)` instead of raw ID.
- **Roll GUI Player Lock**: Non-owning players can no longer click another player's Roll Oracle buttons.

### Removed
- **Akha Ancestry**: Removed from character creation (lore unconfirmed per roadmap Q4).
- **LVL / XP / AC / HP from UI**: Removed from profile display and character creation flow. Columns retained in DB (no data loss). Per roadmap: "Do not add XP, levels, or AC — this is a choice-driven nation game."


### Added
- **Town GUI Back Buttons**: Settle and Build/Upgrade/Demolish empty states now feature "Back" buttons to prevent players getting stuck in dead-end menus.
- **Subsidized Vitale Display**: `/atlas tax` and `/atlas population` now clearly show "Subsidized" Vitale demand for players without a nation, explicitly indicating they face no penalty while their overlord provides it.
- **Scout Autocomplete Upgrade**: `/atlas action scout` now requires targeting a `user` first, allowing the `town` autocomplete to intelligently suggest only that specific player's settlements.

## [1.2.0] - 2026-05-10
### Added
- **Advanced Economic Simulation**: Buildings now produce and consume Food/Ores each tax tick. Terrain multipliers applied (Plains +20% Food, Coastal +20% Wealth, Mountain +50% Ores, etc.).
- **Stability Economy Link**: ALL production (wealth, food, ores) now scaled by `stabilityMultiplier = (rate_stab + 10) / 20`. Low stability cripples your economy.
- **Servus Mechanics**: Owning Servus gives unlimited +2%/unit production bonus but drains -1 `rate_stab` per 5 Servus owned. At -5 stability, Servus Rebellion can fire.
- **Servus Rebellion**: Catastrophic event placeholder — all Servus lost, wealth and pop damaged. "Deploy Military" button placeholder for future Warfare system.
- **Noble Revolt**: Catastrophic event placeholder — dissatisfied nobles cause player's own soldiers to defect. "Call for Loyalty" placeholder button.
- **Population System**: Commoner population grows at 1%/day (capped by `pop_cap`). Famine triggers -1%/day degrowth. Nobles auto-generated at 1 per 50 commoners.
- **Noble Vitale Demand**: Nobles consume Vitale each tax tick. Satisfied nobles give +2 Prestige. Unsatisfied nobles give -2 Stability, -3 Prestige.
- **Vitale Market**: `/atlas empire` now shows a live Styx Empire Vitale Market with dynamic pricing based on weekly demand. Pool = `vitale_base + (10 × players)`.
- **`/atlas population`**: New command showing full population breakdown, noble status, food demand, servus effects, and rebellion risk alerts.
- **`/atlas recruit`**: New command to conscript soldiers from commoner population (requires Barracks, max 10% of pop, 50🪙 per soldier).
- **Founding Stores**: New towns receive +500 🥩 Food on settlement. First town also displays a farm-building tip.
- **Barracks/Castle/Palace Stability Bonus**: Building military structures now permanently applies +2/+4/+6 `rate_stab` respectively.
- **Split Tax Display**: `/atlas tax` now returns two embeds: **Economic Report** and **Population Report**, with embedded warning alerts.
- **Negative Score Cascades**: All `rate_*` columns floored at -10 with cascading consequences documented in roadmap.
### Changed
- **BUILDINGS constants**: All buildings now have `food_prod`, `food_cost`, `ore_prod`, `pop_cap_bonus`, and `stab_bonus` fields.
- **Scheduler**: Monday weekly cron now also resets `vitale_sold_week` to 0.

## [1.1.6] - 2026-05-09
### Added
- **GUI Trade System**: Completely overhauled the `/atlas trade` system into a UI-driven dashboard, replacing raw slash command arguments with interactive dropdown menus and modals.
- **Tax Notifications**: The bot now automatically DMs users when their 24-hour tax cooldown is up, pinging them in the channel where they last collected taxes.

## [1.1.5] - 2026-05-09
### Added
- **Servus Resource**: Introduced the `Servus` resource (`🔗`) into the economy database.
- **Trade System**: `/atlas trade` allows proposing trades to other players with an interactive Accept/Decline UI.
- **Gift System**: `/atlas gift` allows directly sending resources (Balance, Food, Ores, Vitale, Exotics, Servus) to other players.
- **Donate Command**: Renamed `/atlas convert` to `/atlas donate`.
- **Custom Emojis**: Updated emojis for Vitale (`💧`), Exotics (`🍷`), and Ores (`⚒️`).

## [1.1.4] - 2026-05-09
### Added
- **Economy Overhaul**: Fully transitioned to a dual-currency system (Personal Balance 🪙 and Polity Wealth ⚖️).
- **Wealth Conversion**: `/atlas convert` command added to exchange Balance for Wealth at a 1,000:1 ratio.
- **Nation Founding**: New `/atlas nation found` command requires 100,000 Wealth to establish a nation.
- **Dynamic Tax System**: `/atlas tax` now grants a static 100 🪙 per use, while Wealth accumulates over real-world time (24h cycles) based on settlement infrastructure.

### Changed
- **Building Costs**: All town structures are now priced in Wealth (⚖️) instead of Balance.
- **Command Progression**: Uninitiated players are locked to `/atlas begin`. Players must settle a town before accessing other town commands, and must found a nation before accessing empire commands.
- **Profile UI**: `/atlas profile` Treasury section updated with new currency symbols. Bio length limit increased to prevent cutoff.
- **Balance UI**: `/atlas balance` now displays all resources (Food, Ores, Vitale, Exotics).

### Fixed
- **Leaderboard Crash**: Fixed a UI rendering issue where categories exceeded Discord's 5-button limit per ActionRow.
- **Tax Accumulation**: Fixed a bug where first-time taxpayers received ~20,000 days of retroactive wealth due to Unix epoch calculation.


## [1.1.3] - 2026-05-07
### Added
- **Age System**: Lineages now have an Age attribute, determined at the start of `/atlas begin` by rolling `1d10 + 10`.
- **GM Biography Control**: Added `Biography` (description) field to `/admin user edit`, allowing GMs to write custom lore for players.
- **Age Editing**: GMs can now manually adjust player age via `/admin user edit`.

### Removed
- **Leveling System**: Removed all references to LVL and XP from profiles and character creation as they are no longer used in the current game model.
- **Level Display**: Removed LVL and XP counters from the `/atlas profile` interface.

## [1.1.1] - 2026-05-06
### Changed
- **Advanced Scouting Mechanic**: `/atlas town scout` completely overhauled per roadmap §📡.
    - **Old formula** (broken): `DC = 10 + target's max plots` — made scouting mathematically impossible against large towns.
    - **New formula**: `(1d20 + Attacker Offense Score) >= (10 + Target Defense Score)`
    - **Offense Score**: Reuses the same scoring engine from the leaderboard (Barracks +1, Castle +2, Palace +3 per nation).
    - **Defense Score**: Reuses the defense score (Palisade +1, Wall +2, Adv. Wall +3, Castle +5 per town).
    - **Roll transparency**: Players now see the full breakdown — roll, offense bonus, total vs DC — on both success and failure.
    - **Success output**: Shows all target town profiles with named buildings, tiers, and construction status.
    - **Failure output**: Spies captured message now includes the roll result and a reminder to build military.
    - Self-scouting is now blocked with a clear error message.

## [1.1.0] - 2026-05-06
### Added
- **Complex Leaderboard & Scoring System**: `/atlas leaderboard [category]` — fully functional nation score rankings.
    - **Scoring Engine** (`calculateNationScore`): Calculates per-nation scores across 5 dimensions based solely on completed buildings.
    - **Economy** (Farm +1, Livestock +2, Market +3) — stackable across all towns.
    - **Defense** (Palisade +1, Basic Wall +2, Advanced Wall +3, Castle +5/town) — per-town castle cap enforced.
    - **Stability** (Tavern +1/town, Castle +5/town, Palace +15 nation-wide) — all caps enforced.
    - **Prestige** (Mothers Guild +3/town, Imperial Academy +8 nation-wide) — caps enforced.
    - **Offense** (Barracks +1, Castle +2, Palace +3) — stackable across towns.
    - **Total Score**: Sum of all 5 dimensions for overall ranking.
    - **Interactive UI**: 6 category buttons (Total, Economy, Defense, Stability, Prestige, Offense) and pagination with Prev/Next.
    - Only completed buildings count (construction-in-progress are excluded).
- Trade & Knowledge dimensions reserved as WIP per roadmap.

## [1.0.9] - 2026-05-06
### Added
- **Private Scout Profiles**: `/atlas town scout` now generates detailed settlement reports (Terrain, Plots, Building inventory) for the scout instead of a simple name list. The interaction is now ephemeral. `[src/commands/atlas.js:handleScout]`
- **User Dice Rolls**: `/atlas roll` added for players. Allows rolling based on character attributes or manual dice types (d4-d100). `[src/commands/atlas.js:handleUserRoll]`
- **Whitelist Directory**: `/admin system whitelist action:list` now displays all whitelisted Game Masters and their IDs. `[src/commands/admin.js:execute]`
- **Construction Info**: `/atlas town list` now displays the specific building name being constructed next to its timer (e.g., "Farm 🚧"). `[src/commands/atlas.js:handleTownList]`
- **Roadmap Overhaul**: `roadmap.md` rewritten to categorize tasks by complexity and assign recommended AI models (Claude 3.5 Sonnet for complex logic).

### Fixed
- **Building Upgrade Integrity**: Upgrades now require the base building to be finished construction first. `[src/commands/atlas.js:handleTownUpgrade]`
- **Building Replacement Logic**: Upgrades now target and replace exactly ONE instance of the base building instead of deleting all buildings of that type in the town. `[src/commands/atlas.js:handleButton]`
- **Construction Previews**: `/atlas town build` and `/atlas town upgrade` now display the building Category and specific Benefits (description) in the confirmation embed. `[src/commands/atlas.js:handleTownBuild, handleTownUpgrade]`

## [1.0.8] - 2026-05-06
### Added
- **RPG Character Sheet**: Complete overhaul of character creation on a Pathfinder 2e boost foundation. All six attributes start at 10, Ancestry / Background / Profession bonuses now actually apply, plus a new **Free Boost Distributor** stage (4 free +1 points, max +2 per stat) and a Discord modal for biography. `[src/commands/atlas.js:buildFreeBoostView, commitFinalCharacter]`
- **Sheet Fields**: New `level`, `xp`, `hp_max`, `hp_current`, `ac`, `description` columns on `users`. HP = 8 + STR mod at level 1, AC = 10 + MOT mod. `[src/database.js]`
- **Profile Dashboard (sheet style)**: Rebuilt `/atlas profile` embed to match the canonical character sheet image — AC/LVL/HP/XP header, identity row, six stat blocks with three sub-stat modifiers each, treasury footer. `[src/commands/atlas.js:handleProfile]`
- **Helpers Module**: Centralized `getMod`, `fmtMod`, `isGM`, `isOwner`, `resolveAtlasHQ`, `applyBoost`, `buildBaseAttributes`, `deriveSheetFromStats` to kill duplication across `atlas.js` / `admin.js`. `[src/utils/helpers.js]`
- **Modal Pipeline**: `interactionCreate.js` now dispatches `ModalSubmit` events; `atlas.js` exports `handleModal` consumed by the new `originsmodal_*` flow. `[src/events/interactionCreate.js, src/commands/atlas.js]`
- **Admin Settlement Autocomplete**: `/admin town edit` and `/admin town remove` now autocomplete by `name #id — owner` instead of requiring a raw integer. `[src/commands/admin.js, src/events/interactionCreate.js]`

### Fixed
- **Negative Modifier Bug**: Origins finalization now actually applies Ancestry/Background/Profession bonuses to `attr_*`. Previously the chosen origin only saved as strings, leaving every character at 8/8/8/8/10/10 (-1 across the board). `[src/commands/atlas.js:commitFinalCharacter]`
- **Submission Lock (re-implemented)**: Pending-status guard refuses duplicate audit submissions and stops re-pinging atlas-hq. `[src/commands/atlas.js:commitFinalCharacter]`
- **Origin Buttons Lock**: Buttons collapse to a confirmation embed on FINALIZE so a player can no longer double-click into duplicate audits. `[src/commands/atlas.js:commitFinalCharacter]`
- **Scout Null-Guard**: `/atlas town scout` now responds gracefully when the caller or target has no lineage. `[src/commands/atlas.js:handleScout]`
- **Sciatic Trade Reference**: Removed dangling `handleSciaticTrade` row from `update.md` (the command was never implemented).
- **Profession Bonuses Visibility**: Profession confirm embed now lists bonuses for parity with Ancestry/Background. `[src/commands/atlas.js:handleOriginsLogic]`

### Changed
- **Menace Sub-Stats**: `STAT_MAPPING.men.sub` is now `['Intimidation', 'Racism', 'Sexism']` to match the canonical character sheet image. `[src/data/constants.js]`
- **Owner ID**: Centralized in `helpers.js`, now reads `process.env.OWNER_ID` with the historical ID as fallback. `[src/utils/helpers.js, src/commands/admin.js, src/commands/atlas.js]`
- **Default Stats**: Fresh `users` rows now default `attr_*` to 10 instead of the old 8/10 split.
- **README**: Replaced the one-line file with run instructions, env-var table, project layout, and a character-system overview.

## [1.0.7] - 2026-05-05
### Added
- **Styx Throne Dashboard**: Implemented `/atlas empire` to display Imperial status, current ruler, and turn cycle. `[src/commands/atlas.js]`
- **Smart Infrastructure**: Refactored `BUILDINGS` into tiered categories (Economy, Defense, Stability, Military) with upgrade paths. `[src/data/constants.js]`
- **Tiered Autocomplete**: The upgrade system now intelligently filters structures based on a town's existing inventory. `[src/events/interactionCreate.js]`
- **Generic Dice Rolls**: Added `type` option to `/atlas gm roll` for d4-d100 rolls. `[src/commands/atlas.js]`

### Fixed
- **Interaction Race Conditions**: Standardized response methods to resolve "InteractionAlreadyReplied" and "Unknown Interaction" errors. `[src/commands/atlas.js]`
- **Real-Time Construction**: Scaled building times to 1-hour (IRL time) with live countdown timestamps. `[src/commands/atlas.js]`
- **Notification Centralization**: Routed all lineage submissions and admin approvals to the `atlas-hq` channel. `[src/commands/atlas.js]`

## [1.0.6] - 2026-05-05
### Added
- **Automated Turn Scheduler**: Integrated `node-cron` to automatically advance the Imperial Turn every Monday at 00:00. Includes automated admin notifications. `[src/scheduler.js]`
- **Strategic Roadmap**: Created `roadmap.md` to track planned features like leaderboards and character stat revamps.

### Fixed
- **Submission Reliability**: Character creation buttons now disable immediately upon submission to prevent duplicate staff notifications.
### Added
- **Profile Dashboard UI**: Redesigned the `/atlas profile` embed into a clean, grouped dashboard layout with symmetric fields and code-block formatting. `[src/commands/atlas.js]`
- **Context-Aware Autocomplete**: Implemented dynamic suggestions for the "Value" field in admin commands based on the selected "Field" (e.g., suggesting Ancestries only when editing Ancestry). `[src/events/interactionCreate.js]`
- **Resource Autocomplete**: Added autocomplete for trade resources to prevent typos and invalid trade proposals. `[src/events/interactionCreate.js]`
- **Faction Integration**: Added a complete list of 12 world factions (Atomic Guild, Sciatic League, etc.) to the diplomatic system. `[src/data/constants.js]`

### Fixed
- **Duplicate Audit Requests**: Implemented a "submission lock" in the Origins protocol. The system now checks for existing pending status to prevent multiple approval requests from a single player. `[src/commands/atlas.js]`
- **Faction Autocomplete**: Enabled autocomplete for the `/admin relation set` command, allowing GMs to select from valid factions instantly. `[src/events/interactionCreate.js]`
- **Purge Protocol**: Resolved a critical "System Error" when confirming user purges. Corrected `EmbedBuilder` implementation and added recursive deletion for buildings and relations. `[src/events/interactionCreate.js]`
- **Command Intuition**: Replaced blank text fields with predefined selection menus for administrative edits. `[src/commands/admin.js]`

## [1.0.4] - 2026-05-05
### Added
- **GM Whitelist System**: New database table and admin commands to manage Game Master access independently of Discord roles. `[src/commands/admin.js]`
- **Animated Avatar**: Switched to high-quality animated GIF for bot branding. `[src/events/ready.js]`
- **NationRP Metadata**: Added `exotics`, `fertility`, and `ready_at` tracking to support deeper game mechanics. `[src/database.js]`

### Fixed
- **Interaction Timeouts**: Unified `deferReply()` logic across all commands to prevent "The application did not respond" errors. `[src/commands/atlas.js]`
- **Duplicate Commands**: Fixed ghost command registration by clearing global protocols and prioritizing guild synchronization. `[src/events/ready.js]`
- **Profile UI**: Merged character attributes (Strength, Motoric, etc.) with legacy info (Nation, Towns) into a single, comprehensive embed. `[src/commands/atlas.js]`

### Security
- **Owner Override**: Hardcoded server owner override for ID `317883862258548737`, ensuring access to Imperial protocols regardless of role assignments.

## [1.0.3] - 2026-05-05 (Initial Modularization)
### Added
- **Modular Architecture**: Split monolithic `index.js` into dedicated command and event directories.
- **Automatic Sync**: Commands now automatically synchronize with Discord on startup.
- **Imperial Origins**: Refactored character creation flow with improved persistence.
