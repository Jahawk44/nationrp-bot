const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

async function setupDatabase() {
    const db = await open({
        filename: path.join(__dirname, '../database.sqlite'),
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT,
            balance INTEGER DEFAULT 1000,
            wealth INTEGER DEFAULT 0,
            exotics INTEGER DEFAULT 0,
            food_surplus INTEGER DEFAULT 0,
            ores INTEGER DEFAULT 0,
            vitale INTEGER DEFAULT 0,
            pop_servus INTEGER DEFAULT 0,
            pop_common INTEGER DEFAULT 100,
            pop_growth REAL DEFAULT 0.01,
            pop_nobles INTEGER DEFAULT 0,
            attr_str INTEGER DEFAULT 8,
            attr_mot INTEGER DEFAULT 8,
            attr_men INTEGER DEFAULT 8,
            attr_int INTEGER DEFAULT 8,
            attr_wis INTEGER DEFAULT 10,
            attr_cha INTEGER DEFAULT 10,
            rate_econ INTEGER DEFAULT 1,
            rate_def INTEGER DEFAULT 0,
            rate_stab INTEGER DEFAULT 10,
            rate_prest INTEGER DEFAULT 0,
            mil_strength INTEGER DEFAULT 0,
            mil_maintenance_cost INTEGER DEFAULT 0,
            last_daily INTEGER DEFAULT 0,
            ruler_name TEXT,
            avatar_url TEXT,
            nation_name TEXT,
            ancestry TEXT,
            upbringing TEXT,
            profession TEXT,
            ruler_description TEXT,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS towns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            name TEXT,
            terrain_type TEXT,
            plots_total INTEGER,
            fertility INTEGER DEFAULT 50,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS buildings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            town_id INTEGER,
            type TEXT,
            level INTEGER DEFAULT 1,
            ready_at INTEGER,
            FOREIGN KEY(town_id) REFERENCES towns(id)
        );

        CREATE TABLE IF NOT EXISTS relations (
            user_id TEXT,
            faction_name TEXT,
            score INTEGER DEFAULT 0,
            PRIMARY KEY(user_id, faction_name),
            FOREIGN KEY(user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS global_settings (
            key TEXT PRIMARY KEY,
            value TEXT
        );

        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            description TEXT,
            image_url TEXT,
            gm_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS decisions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id INTEGER,
            label TEXT,
            outcome_success TEXT,
            outcome_failure TEXT,
            success_rate INTEGER,
            FOREIGN KEY(event_id) REFERENCES events(id)
        );

        CREATE TABLE IF NOT EXISTS gm_whitelist (
            user_id TEXT PRIMARY KEY
        );

        -- Initialize global settings if empty
        INSERT OR IGNORE INTO global_settings (key, value) VALUES ('current_turn', '1');
        INSERT OR IGNORE INTO global_settings (key, value) VALUES ('empire_ruler', 'Tyrannite');
    `);

    // Migration: Add columns if they don't exist (SQLite doesn't support IF NOT EXISTS in ALTER TABLE)
    try { await db.exec('ALTER TABLE users ADD COLUMN exotics INTEGER DEFAULT 0'); } catch(e) {}
    try { await db.exec('ALTER TABLE towns ADD COLUMN fertility INTEGER DEFAULT 50'); } catch(e) {}
    try { await db.exec('ALTER TABLE buildings ADD COLUMN ready_at INTEGER'); } catch(e) {}

    return db;
}

module.exports = { setupDatabase };
