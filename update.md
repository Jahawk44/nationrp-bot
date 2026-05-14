# ATLAS | Imperial Interface - Update Log

This file tracks the evolution of the NationRP Discord Bot (ATLAS). Use this as a reference for existing features, database schemas, and code locations to ensure consistent development and easier troubleshooting.

## 📍 System Architecture & Core
| Feature | Description | Location Tags |
| :--- | :--- | :--- |
| **Bot Init** | Client setup, intents (Guilds, Messages, Members), and IPv4 force agent. | `[src/index.js:L14-L18]` |
| **Command Sync** | Dynamic registration of slash commands to a specific Guild. | `[src/index.js:L156:register]` |
| **Database setup** | SQLite initialization with tables for users, towns, buildings, and events. | `[src/database.js:L5:setupDatabase]` |
| **Error Handling** | Global handlers for `unhandledRejection` and `uncaughtException`. | `[src/index.js:L22-L23]` |

---

## 🎭 Character & Origins System (RPG, v1.0.8)
| Feature | Description | Location Tags |
| :--- | :--- | :--- |
| **Origins Flow** | Multi-step interactive setup (Roll Age -> Ancestry -> Background -> Profession -> Free Boosts -> Description Modal). | `[src/commands/atlas.js:handleOriginsIntro]` |
| **Logic Handler** | Processes button interactions for character creation stages including `ageroll`, `fbadd`, `fbreset`, `fbfinalize`. | `[src/commands/atlas.js:handleOriginsLogic]` |
| **Free Boost Distributor** | 4 free +1 points (max +2 per stat) applied on top of Ancestry/Background/Profession bonuses. Live embed with RESET / FINALIZE / BACK. | `[src/commands/atlas.js:buildFreeBoostView]` |
| **Description Modal** | Discord modal (`originsmodal_*`) captures up to 500 chars of biography on FINALIZE. | `[src/commands/atlas.js:handleButton, handleModal]` |
| **Stat Engine** | Pathfinder 2e adapted: base 10 across all stats, additive flat bonuses, soft cap at 18. | `[src/utils/helpers.js:buildBaseAttributes, applyBoost]` |
| **Sheet Derivation** | HP and AC computed from stats: `HP = 8 + STR mod`, `AC = 10 + MOT mod`. | `[src/utils/helpers.js:deriveSheetFromStats]` |
| **Submission Lock** | Pending-status guard prevents duplicate audits; success embed disables prior controls. | `[src/commands/atlas.js:commitFinalCharacter]` |
| **Imperial Audit** | Audit embed posted to atlas-hq via `resolveAtlasHQ` helper. Includes derived AC/HP/Age summary and biography. | `[src/commands/atlas.js:commitFinalCharacter]` |
| **Profile (sheet-style)** | Image-aligned dashboard: AC / Age / HP header, identity row (Ancestry/Background/Profession), six stat blocks with three sub-stat modifiers each, Treasury footer. | `[src/commands/atlas.js:handleProfile]` |

---

## 💰 Economy & Trade Protocols
| Feature | Description | Location Tags |
| :--- | :--- | :--- |
| **Daily Tax** | `/atlas tax` - Grants a static stipend (100 🪙) and accumulates Wealth (⚖️) based on real-time days passed since last tax. The bot will automatically notify you when 24h have passed. | `[src/commands/atlas.js:handleTax]` |
| **Balance** | `/atlas balance` - Displays personal Balance (🪙), national Wealth (⚖️), and all resources. | `[src/commands/atlas.js:handleBalance]` |
| **Donate**| `/atlas donate` - Exchanges Personal Balance into Polity Wealth at a 1,000:1 ratio. | `[src/commands/atlas.js:handleDonate]` |
| **Gift**| `/atlas gift` - Sends an amount of any resource to another player. | `[src/commands/atlas.js:handleGift]` |
| **Trade**| `/atlas trade` - Opens an interactive Trade Dashboard GUI to build a proposal for another player. | `[src/commands/atlas.js:handleTrade]` |
| **Found Nation**| `/atlas nation found` - Creates a nation for 100,000 ⚖️. | `[src/commands/atlas.js:handleNationFound]` |

---

## 🏘️ Settlement & Infrastructure
| Feature | Description | Location Tags |
| :--- | :--- | :--- |
| **Town Management GUI**| `/atlas town` - Single interactive dashboard for all settlements. Features dropdown selection. | `[src/commands/atlas.js:handleTownGUI]` |
| **Settle** | Settle New Town via the `/atlas town` dashboard modal. | `[src/commands/atlas.js:handleModal]` |
| **Construction** | Build via the `/atlas town` GUI dropdowns with 1h timers. | `[src/commands/atlas.js:handleSelect]` |
| **Upgrades** | Upgrade via the `/atlas town` GUI. | `[src/commands/atlas.js:handleSelect]` |
| **Demolish** | Demolish structures via the `/atlas town` GUI for a 50% refund. | `[src/commands/atlas.js:handleSelect]` |

---

## ⚖️ Diplomacy & Intelligence
| Feature | Description | Location Tags |
| :--- | :--- | :--- |
| **Scouting** | `/atlas action scout` - Skill check to gather intel on targets. Requires User and Town. | `[src/commands/atlas.js:handleScout]` |
| **Recruiting** | `/atlas action recruit` - Conscript soldiers from commoners using Barracks. | `[src/commands/atlas.js:handleRecruit]` |
| **Dice Rolls** | `/atlas roll` - Player dice rolls based on stats or manual types (d4-d100). | `[src/commands/atlas.js:handleUserRoll]` |
| **Diplomacy** | `/atlas relation` - Visual standing bar for various factions. | `[src/commands/atlas.js:handleRelation]` |
| **Empire Status** | `/atlas empire` - Shows the current ruler and turn number. | `[src/commands/atlas.js:handleEmpire]` |
| **Strategic Roadmap** | Future complex features and model recommendations. | `[roadmap.md]` |

---

## 🛠️ Admin & GM Protocols
| Feature | Description | Location Tags |
| :--- | :--- | :--- |
| **Oracle Rolls** | `/atlas gm roll` - GM-triggered skill checks for players. Now with dice types. | `[src/commands/atlas.js:handleGMRoll]` |
| **Whitelist Directory**| `/admin system whitelist action:list` - View all whitelisted GMs. | `[src/commands/admin.js:execute]` |
| **Imperial Audit** | Dedicated `/admin` command, restricted by `Administrator` permission. | `[src/commands/admin.js:execute]` |

---

## 📦 Database Schema (Reference)
| Table | Fields |
| :--- | :--- |
| **users** | `id, balance, wealth, food_surplus, ores, vitale, pop_*, attr_* (default 10), age, hp_max, hp_current, ac, description, status, ancestry, upbringing, profession, etc.` |
| **towns** | `id, user_id, name, terrain_type, plots_total, fertility` |
| **buildings** | `id, town_id, type, level, ready_at` |
| **relations**| `user_id, faction_name, score` |
| **gm_whitelist** | `user_id` |
| **global_settings** | `key, value` (e.g. `current_turn`, `empire_ruler`) |

---

## 📝 Troubleshooting Notes
- **IPv4 Force**: The bot uses a custom `undici` agent with `dns.lookup` (family: 4) to force IPv4. This resolves `ECONNREFUSED` issues on systems where `dns.resolve4` is restricted while still preventing connection timeouts. `[src/index.js:L8]`
- **Construction Timers**: Uses `ready_at` (milliseconds) in the DB to track building completion. `[src/commands/atlas.js:L95]`
- **Autocomplete**: Town and Building selection in slash commands use database-backed autocompletion. `[src/events/interactionCreate.js:L9]`

## 🗂️ System Architecture & File Locations
To ensure easy troubleshooting and scalability, the bot's architecture has been modularized into the following structure:

### `src/data/` (Static Constants)
- `[src/data/constants.js]` - Contains all hardcoded game data (Terrains, Buildings, Ancestries, Backgrounds (Upbringings), Professions, Emojis, and Stat Mapping). Edit this file to rebalance game stats. Sub-stats follow the canonical character sheet image (Menace: Intimidation/Racism/Sexism).

### `src/utils/` (Shared Helpers)
- `[src/utils/helpers.js]` - `getMod`, `fmtMod`, `isOwner`, `isGM`, `resolveAtlasHQ`, `applyBoost` (PF2e-style soft cap at 18), `buildBaseAttributes`, `deriveSheetFromStats`. Single source of truth for character math and authorization checks.

### `src/commands/` (Slash Commands)
- `[src/commands/admin.js]` - Imperial Audit protocols. Handles user editing, purging, settlement edit/remove (now with town autocomplete), and the **GM Whitelist** system.
- `[src/commands/atlas.js]` - Core player interface. Handles **Profile UI**, Tax, Towns, **GM Oracle (Rolls)**, and the full Origins flow including the Free Boost stage and Description Modal.

### `src/events/` (Event Handlers)
- `[src/events/ready.js]` - System initialization, **Avatar Management**, and Guild Protocol (Command) sync.
- `[src/events/interactionCreate.js]` - Central routing for all interactions: Button logic, Autocomplete, and **Modal Submit** dispatch.

### Core Engine
- `[src/index.js]` - Entry point and Environment injector.
- `[src/database.js]` - SQLite schema manager, migrations (including the 1.0.8 RPG sheet columns), and table initialization.

---

## 🛠️ Feature Map & Script Locations
| Feature | Location | Logic Handler |
| :--- | :--- | :--- |
| **GM Whitelist** | `[src/commands/admin.js]` | `handleWhitelist` |
| **Profile UI** | `[src/commands/atlas.js]` | `handleProfile` (Dashboard Layout) |
| **User Purge** | `[src/events/interactionCreate.js]` | Recursive deletion (DB Cleanup) |
| **Value Autocomplete** | `[src/events/interactionCreate.js]` | Context-aware suggestions |
| **Faction Relations** | `[src/data/constants.js]` | Faction list |
| **Turn System** | `[src/scheduler.js]` | Weekly Automation (Mon 00:00) |
| **Styx Throne** | `[src/commands/atlas.js]` | `handleEmpire` |
| **Town Management** | `[src/commands/atlas.js]` | `handleTownList`, `handleTownBuild` |
| **Imperial Audit** | `[src/commands/atlas.js]` | `handleOriginsIntro`, `handleOriginsLogic`, `commitFinalCharacter` |
| **Free Boost Modal** | `[src/commands/atlas.js]` | `buildFreeBoostView`, `handleModal` |
| **Character Math** | `[src/utils/helpers.js]` | `buildBaseAttributes`, `deriveSheetFromStats`, `applyBoost` |
