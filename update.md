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

## 🎭 Character & Origins System
| Feature | Description | Location Tags |
| :--- | :--- | :--- |
| **Origins Flow** | Multi-step interactive setup (Ancestry -> Upbringing -> Profession). | `[src/commands/atlas.js:handleOriginsIntro]` |
| **Logic Handler** | Processes button interactions for character creation stages. | `[src/commands/atlas.js:handleOriginsLogic]` |
| **Imperial Audit** | Sends new character applications to a designated admin channel for approval. | `[src/commands/atlas.js:final]` |
| **Profile** | Detailed embed showing player credentials, nation, wealth, and towns. | `[src/commands/atlas.js:handleProfile]` |

---

## 💰 Economy & Trade Protocols
| Feature | Description | Location Tags |
| :--- | :--- | :--- |
| **Daily Tax** | `/atlas tax` - Grants a daily stipend ($50) with a 24-hour cooldown. | `[src/commands/atlas.js:handleTax]` |
| **Balance** | `/atlas balance` - Displays personal cash ($) and national wealth (W). | `[src/commands/atlas.js:handleBalance]` |
| **Sciatic Trade** | Specialized import protocol for purchasing Exotics (💎) using Wealth. | `[src/commands/atlas.js:handleSciaticTrade]` |

---

## 🏘️ Settlement & Infrastructure
| Feature | Description | Location Tags |
| :--- | :--- | :--- |
| **Settle** | `/atlas town settle` - Generates a new town with randomized terrain and plots. | `[src/commands/atlas.js:handleSettle]` |
| **Town Management**| `/atlas town list` - Paginated view of owned settlements and buildings. | `[src/commands/atlas.js:handleTownList]` |
| **Construction** | `/atlas town build` - Commissions structures with cost, plot usage, and 1h timer. | `[src/commands/atlas.js:handleTownBuild]` |
| **Upgrades** | `/atlas town upgrade` - Enhances existing buildings to higher tiers (Tier 2/3). | `[src/commands/atlas.js:handleTownUpgrade]` |
| **Demolish** | `/atlas town demolish` - Removes structures for a 50% refund. | `[src/commands/atlas.js:handleTownDemolish]` |

---

## ⚖️ Diplomacy & Intelligence
| Feature | Description | Location Tags |
| :--- | :--- | :--- |
| **Scouting** | `/atlas town scout` - Skill check (Wisdom) to gather intel on targets. | `[src/commands/atlas.js:handleScout]` |
| **Diplomacy** | `/atlas relation` - Visual standing bar for various factions. | `[src/commands/atlas.js:handleRelation]` |
| **Empire Status** | `/atlas empire` - Shows the current ruler and turn number. | `[src/commands/atlas.js:handleEmpire]` |

---

## 🛠️ Admin & GM Protocols
| Feature | Description | Location Tags |
| :--- | :--- | :--- |
| **Oracle Rolls** | `/atlas gm roll` - GM-triggered skill checks for players. Now with dice types. | `[src/commands/atlas.js:handleGMRoll]` |
| **Imperial Audit** | Dedicated `/admin` command, restricted by `Administrator` permission. | `[src/commands/admin.js:execute]` |

---

## 📦 Database Schema (Reference)
| Table | Fields |
| :--- | :--- |
| **users** | `id, balance, wealth, food_surplus, ores, vitale, pop_*, attr_*, status, etc.` |
| **towns** | `id, user_id, name, terrain_type, plots_total, fertility` |
| **buildings** | `id, town_id, type, level, ready_at` |
| **relations**| `user_id, faction_name, score` |

---

## 📝 Troubleshooting Notes
- **IPv4 Force**: The bot uses a custom `undici` agent with `dns.lookup` (family: 4) to force IPv4. This resolves `ECONNREFUSED` issues on systems where `dns.resolve4` is restricted while still preventing connection timeouts. `[src/index.js:L8]`
- **Construction Timers**: Uses `ready_at` (milliseconds) in the DB to track building completion. `[src/commands/atlas.js:L95]`
- **Autocomplete**: Town and Building selection in slash commands use database-backed autocompletion. `[src/events/interactionCreate.js:L9]`

## 🗂️ System Architecture & File Locations
To ensure easy troubleshooting and scalability, the bot's architecture has been modularized into the following structure:

### `src/data/` (Static Constants)
- `[src/data/constants.js]` - Contains all hardcoded game data (Terrains, Buildings, Ancestries, Professions, Emojis, and Stat Mapping). Edit this file to rebalance game stats.

### `src/commands/` (Slash Commands)
- `[src/commands/admin.js]` - Imperial Audit protocols. Handles user editing, purging, and the **GM Whitelist** system.
- `[src/commands/atlas.js]` - Core player interface. Handles **Profile UI**, Tax, Towns, and **GM Oracle (Rolls)**.

### `src/events/` (Event Handlers)
- `[src/events/ready.js]` - System initialization, **Avatar Management**, and Guild Protocol (Command) sync.
- `[src/events/interactionCreate.js]` - Central routing for all interactions, including Button logic and Autocomplete.

### Core Engine
- `[src/index.js]` - Entry point and Environment injector.
- `[src/database.js]` - SQLite schema manager, migrations, and table initialization.

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
| **Imperial Audit** | `[src/commands/atlas.js]` | `handleOriginsIntro`, `handleOriginsLogic` |
