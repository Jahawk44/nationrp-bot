# 📜 Atlas Bot Changelog

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
