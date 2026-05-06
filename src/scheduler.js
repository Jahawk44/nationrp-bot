const cron = require('node-cron');

function initScheduler(client) {
    const db = client.db;

    // Weekly Turn Update: Every Monday at 00:00
    cron.schedule('0 0 * * 1', async () => {
        try {
            console.log('[SCHEDULER] Executing Weekly Turn Protocol...');
            const currentTurnRow = await db.get('SELECT value FROM global_settings WHERE key = "current_turn"');
            const newTurn = (parseInt(currentTurnRow?.value) || 0) + 1;
            
            await db.run('UPDATE global_settings SET value = ? WHERE key = "current_turn"', newTurn.toString());
            console.log(`[SCHEDULER] Turn incremented to: ${newTurn}`);
            
            // Optional: Notify a channel if needed
            const adminChanId = process.env.ADMIN_CHANNEL_ID;
            if (adminChanId) {
                const chan = await client.channels.fetch(adminChanId);
                if (chan) {
                    await chan.send({ embeds: [{
                        title: '🏺 AGE TRANSITION',
                        description: `The Imperial clock has struck. We have entered **Turn ${newTurn}**.`,
                        color: 0xFFD700,
                        timestamp: new Date()
                    }]});
                }
            }
        } catch (error) {
            console.error('[SCHEDULER] Turn Update Failed:', error);
        }
    });

    console.log('[SCHEDULER] Automated Turn Cycles Initialized (Weekly: Mon 00:00).');
}

module.exports = { initScheduler };
