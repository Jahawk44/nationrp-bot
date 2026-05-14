const cron = require('node-cron');
const { calcStabMultiplier } = require('./utils/helpers');
const { processTradeRoutes } = require('./commands/atlas/trade');

function initScheduler(client) {
    const db = client.db;

    // ── Weekly Turn: Every Monday at 00:00 ──────────────────────────────────
    cron.schedule('0 0 * * 1', async () => {
        try {
            console.log('[SCHEDULER] Weekly Turn Protocol...');
            const row    = await db.get('SELECT value FROM global_settings WHERE key = "current_turn"');
            const newTurn = (parseInt(row?.value) || 0) + 1;

            await db.run('UPDATE global_settings SET value = ? WHERE key = "current_turn"', newTurn.toString());
            await db.run('UPDATE global_settings SET value = "0" WHERE key = "vitale_sold_week"');

            // Process weekly trade routes
            await processTradeRoutes(db, client);

            // Wipe temp mercenaries each turn (Ticket 8.1)
            const mercWipe = await db.run('UPDATE users SET mercs_temp = 0 WHERE mercs_temp > 0');
            if (mercWipe.changes > 0) console.log(`[SCHEDULER] Mercenaries disbanded (${mercWipe.changes} players).`);

            console.log(`[SCHEDULER] Turn ${newTurn}. Vitale market reset.`);

            // Turn notification → #main-hall, not atlas-hq
            const mainHallId = process.env.MAIN_HALL_ID || '1502560573710270555';
            try {
                const chan = await client.channels.fetch(mainHallId);
                if (chan) await chan.send({ embeds: [{
                    title: '🏺 AGE TRANSITION',
                    description: `The Imperial clock has struck. We have entered **Turn ${newTurn}**.\n\nAll Sovereigns may now collect taxes and review their populace.`,
                    color: 0xFFD700,
                    timestamp: new Date()
                }]});
            } catch (e) {
                console.error('[SCHEDULER] Could not send to main hall:', e.message);
            }
        } catch (error) {
            console.error('[SCHEDULER] Weekly Turn Failed:', error);
        }
    });

    // ── Hourly Tax Notification ──────────────────────────────────────────────
    cron.schedule('0 * * * *', async () => {
        try {
            const now       = Date.now();
            const threshold = now - (24 * 60 * 60 * 1000);
            const users = await db.all(
                'SELECT id, last_tax_channel FROM users WHERE tax_notified = 0 AND last_tax <= ? AND last_tax > 0 AND last_tax_channel IS NOT NULL',
                threshold
            );
            for (const u of users) {
                try {
                    const channel = await client.channels.fetch(u.last_tax_channel);
                    if (channel) {
                        await channel.send({ content: `<@${u.id}> 🏛️ Your Imperial Tax is ready to be collected! Use \`/atlas tax\`.` });
                        await db.run('UPDATE users SET tax_notified = 1 WHERE id = ?', u.id);
                    }
                } catch (_) {}
            }
        } catch (error) {
            console.error('[SCHEDULER] Tax Notification Failed:', error);
        }
    });

    // ── Daily Population Growth + Military Maintenance: 00:00 ───────────────
    cron.schedule('0 0 * * *', async () => {
        try {
            console.log('[SCHEDULER] Daily Population + Military Maintenance...');
            const users = await db.all('SELECT * FROM users WHERE status = "active"');

            for (const u of users) {
                // ── Population growth ────────────────────────────────────────
                const currentPop = u.pop_commoners || 0;
                const food       = u.food_surplus  || 0;

                // Calculate pop cap from buildings
                const towns = await db.all('SELECT id FROM towns WHERE user_id = ?', u.id);
                let popCap = 500; // base cap
                for (const t of towns) {
                    const bldgs = await db.all(
                        'SELECT type FROM buildings WHERE town_id = ? AND (ready_at IS NULL OR ready_at <= ?)',
                        t.id, Date.now()
                    );
                    const { BUILDINGS } = require('./data/constants');
                    for (const b of bldgs) {
                        const bd = BUILDINGS[b.type.toUpperCase()];
                        if (bd) popCap += (bd.pop_cap_bonus || 0);
                    }
                }

                let delta = 0;
                if (food > 0 && currentPop < popCap) {
                    delta = Math.max(1, Math.floor(currentPop * 0.01));
                    delta = Math.min(delta, popCap - currentPop); // don't exceed cap
                } else if (food <= 0) {
                    delta = -Math.max(1, Math.floor(currentPop * 0.01)); // famine
                }

                // ── Military maintenance ─────────────────────────────────────
                // FIXED: Soldiers consume food daily. If food can't cover upkeep,
                // soldiers desert (pop_soldiers decreases).
                const soldiers        = u.pop_soldiers       || 0;
                const maintenanceCost = u.mil_maintenance_cost || 0;
                let foodAfterMil      = food + delta; // apply growth first

                let soldierDesertion = 0;
                if (maintenanceCost > 0) {
                    if (foodAfterMil >= maintenanceCost) {
                        // Can pay full upkeep
                        foodAfterMil -= maintenanceCost;
                    } else {
                        // Can only partially pay — soldiers desert proportionally
                        const deficit      = maintenanceCost - Math.max(0, foodAfterMil);
                        soldierDesertion   = Math.ceil(deficit); // 1 soldier deserts per food unit short
                        soldierDesertion   = Math.min(soldierDesertion, soldiers); // cap at army size
                        foodAfterMil       = 0;
                        // Stability penalty for desertion
                        await db.run(
                            'UPDATE users SET rate_stab = MAX(-10, rate_stab - 1) WHERE id = ?',
                            u.id
                        );
                        console.log(`[SCHEDULER] ${u.id}: ${soldierDesertion} soldiers deserted due to food shortage.`);
                    }
                }

                // Apply all updates in one query
                await db.run(`
                    UPDATE users SET
                        pop_commoners      = MAX(0, pop_commoners + ?),
                        food_surplus       = MAX(0, ?),
                        pop_soldiers       = MAX(0, pop_soldiers - ?),
                        mil_strength       = MAX(0, mil_strength - ?),
                        mil_maintenance_cost = MAX(0, mil_maintenance_cost - ?),
                        tax_notified       = 0
                    WHERE id = ?`,
                    delta,
                    foodAfterMil,
                    soldierDesertion,
                    soldierDesertion,
                    soldierDesertion,
                    u.id
                );
            }
            console.log('[SCHEDULER] Daily Population + Military Maintenance complete.');
        } catch (error) {
            console.error('[SCHEDULER] Daily Processing Failed:', error);
        }
    });

    console.log('[SCHEDULER] Cycles initialized: Weekly turn (Mon 00:00), Hourly tax notifier, Daily population/military (00:00).');
}

module.exports = { initScheduler };
