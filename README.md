# ATLAS — NationRP Discord Bot

A fantasy nation-roleplay Discord bot for the Ares Heiliga League. Built on `discord.js` v14 with a SQLite-backed character/economy/diplomacy engine and a Pathfinder-2e-flavored character sheet system.

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` in the repo root (see [Environment Variables](#environment-variables)).
3. Launch the bot:
   ```bash
   npm start
   ```
   The first boot creates `database.sqlite` and registers slash commands against the configured guild.

## Environment Variables

Create a `.env` file with at minimum:

| Variable | Required | Purpose |
| :--- | :---: | :--- |
| `DISCORD_TOKEN` | yes | Bot token from the Discord Developer Portal. |
| `GUILD_ID` | recommended | Guild for instant slash-command registration. Without it, commands sync globally and may take up to an hour. |
| `ADMIN_CHANNEL_ID` | optional | Channel for Imperial Audit notifications and the weekly Age Transition embed. Falls back to a channel literally named `atlas-hq`. |
| `OWNER_ID` | optional | Discord user ID that bypasses all permission gates (defaults to the historical owner ID). |

## Project Layout

```
src/
  index.js                  Entry point. Forces IPv4 via undici Agent + dns.lookup.
  database.js               SQLite schema + idempotent ALTER TABLE migrations.
  scheduler.js              node-cron weekly turn cycle (Mon 00:00).
  data/
    constants.js            Static game data: terrains, buildings, ancestries, backgrounds, professions, factions, stat mapping.
  utils/
    helpers.js              getMod, fmtMod, isGM, resolveAtlasHQ, applyBoost, buildBaseAttributes, deriveSheetFromStats.
  commands/
    atlas.js                Player slash command surface (origins, profile, town, gm).
    admin.js                Imperial Audit / GM whitelist / system protocols.
  events/
    ready.js                Boot, avatar sync, command registration.
    interactionCreate.js    Slash-command, button, autocomplete, and modal-submit dispatcher.
```

## Documentation

- [`changelog.md`](changelog.md) — versioned release log.
- [`update.md`](update.md) — feature map, file-by-file responsibilities, troubleshooting notes.
- [`roadmap.md`](roadmap.md) — planned features.

## Character System (1.0.8)

Characters are built on a Pathfinder-2e-flavored boost stack:

1. All six attributes start at **10**.
2. **Ancestry** applies its `bonuses` (e.g. Daxos = +2 CHA, +1 INT).
3. **Background** (Upbringing) applies its `bonuses` (e.g. Yard = +2 STR, +1 MEN).
4. **Profession** applies its `bon` (e.g. Commander = +2 MEN).
5. **Free Boost Distributor** lets the player allocate **4** free `+1` points (max **+2** per stat).
6. Discord modal captures up to 500 chars of biography.
7. The Imperial Audit posts the full sheet (AC / HP / LVL / stats / sub-stats / bio) to `atlas-hq`.

`HP = 8 + STR mod` at level 1 (`+5 + STR mod` per level after). `AC = 10 + MOT mod`. The standard `floor((stat - 10) / 2)` modifier formula applies. Modifiers are guaranteed to be `≥ 0` for any reasonable build.

## License

ISC.
