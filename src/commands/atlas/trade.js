const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { RESOURCES } = require('../../data/constants');
const { getNotificationChannel, resolveAtlasHQ } = require('../../utils/helpers');

const NPC_TEXTS = {
    styx:    'Imperial merchants arrive. Wealth exchanged for Vitale at current market rates.',
    sciatic: 'Sciatic traders deliver goods from distant ports.',
    caossa:  'A Caossi caravan arrives bearing ore and worked metal.'
};

async function handleTradeRouteList(interaction) {
    const db = interaction.client.db;
    const routes = await db.all(
        'SELECT * FROM trade_routes WHERE (initiator_id=? OR partner_id=?) AND status NOT IN ("completed","broken")',
        interaction.user.id, interaction.user.id
    );
    if (!routes.length) return interaction.editReply({ content: 'You have no active trade routes. Use `/atlas traderoute propose` to create one.' });

    const lines = routes.map(r => {
        const partnerLabel = r.partner_type === 'player'
            ? `<@${r.partner_id}>` : r.partner_type.charAt(0).toUpperCase() + r.partner_type.slice(1);
        return `**#${r.id}** | ${partnerLabel} | Give: ${r.give_amount} ${r.give_resource} → Receive: ${r.receive_amount} ${r.receive_resource} | ${r.turns_remaining}/${r.duration_turns} turns | ${r.status}`;
    });
    const embed = new EmbedBuilder().setTitle('🔄 TRADE ROUTES').setColor(0x00BFFF).setDescription(lines.join('\n'));
    return interaction.editReply({ embeds: [embed] });
}

async function handleTradeRoutePropose(interaction) {
    const db = interaction.client.db;
    const partnerType = interaction.options.getString('partner_type');
    const partnerId   = interaction.options.getString('partner');
    const giveRes     = interaction.options.getString('give_resource').toLowerCase();
    const giveAmt     = interaction.options.getInteger('give_amount');
    const recvRes     = interaction.options.getString('receive_resource').toLowerCase();
    const recvAmt     = interaction.options.getInteger('receive_amount');
    const duration    = interaction.options.getInteger('duration');

    if (giveAmt <= 0 || recvAmt <= 0) return interaction.editReply({ content: '⚠️ Amounts must be positive.' });
    if (giveRes === recvRes) return interaction.editReply({ content: '⚠️ Cannot trade the same resource.' });
    if (!RESOURCES[giveRes.toUpperCase()] || !RESOURCES[recvRes.toUpperCase()])
        return interaction.editReply({ content: '⚠️ Invalid resource type.' });

    const user = await db.get('SELECT * FROM users WHERE id=?', interaction.user.id);

    // Relation gates for NPC routes
    if (partnerType === 'sciatic') {
        const rel = await db.get('SELECT score FROM relations WHERE user_id=? AND faction_name=?', interaction.user.id, 'Sciatic League');
        if (!rel || rel.score < 10) return interaction.editReply({ content: '⚠️ Sciatic League requires relation ≥ 10 for trade routes.' });
    }
    if (partnerType === 'caossa') {
        const rel = await db.get('SELECT score FROM relations WHERE user_id=? AND faction_name=?', interaction.user.id, 'Caossa');
        if (!rel || rel.score < 5) return interaction.editReply({ content: '⚠️ Caossa requires relation ≥ 5 for trade routes.' });
    }

    // Player routes: require partner acceptance
    if (partnerType === 'player') {
        if (!partnerId) return interaction.editReply({ content: '⚠️ A partner player is required for player routes.' });
        if (partnerId === interaction.user.id) return interaction.editReply({ content: '⚠️ Cannot trade with yourself.' });
        const target = await db.get('SELECT id FROM users WHERE id=? AND status="active"', partnerId);
        if (!target) return interaction.editReply({ content: '⚠️ Target player not found or not active.' });

        const result = await db.run(
            'INSERT INTO trade_routes (initiator_id, partner_id, partner_type, give_resource, give_amount, receive_resource, receive_amount, duration_turns, turns_remaining, status) VALUES (?,?,?,?,?,?,?,?,?,"pending")',
            interaction.user.id, partnerId, partnerType, giveRes, giveAmt, recvRes, recvAmt, duration, duration
        );
        const routeId = result.lastID;

        const chan = await getNotificationChannel(interaction.client, { id: partnerId, notification_channel: null, last_tax_channel: null });
        if (chan) {
            const emb = new EmbedBuilder()
                .setTitle('🤝 TRADE ROUTE PROPOSAL')
                .setDescription(`<@${interaction.user.id}> proposes a trade route:\n\nGive: **${giveAmt} ${giveRes}** → Receive: **${recvAmt} ${recvRes}**\nDuration: ${duration} turns`)
                .setColor(0x00BFFF);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`traderoute_a_${routeId}`).setLabel('Accept').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`traderoute_r_${routeId}`).setLabel('Reject').setStyle(ButtonStyle.Danger)
            );
            try { await chan.send({ content: `<@${partnerId}>`, embeds: [emb], components: [row] }); } catch (_) {}
        }
        return interaction.editReply({ content: `📨 Trade route proposal sent to <@${partnerId}>. Awaiting their response.` });
    }

    // NPC routes: insert active directly
    await db.run(
        'INSERT INTO trade_routes (initiator_id, partner_id, partner_type, give_resource, give_amount, receive_resource, receive_amount, duration_turns, turns_remaining, status) VALUES (?,NULL,?,?,?,?,?,?,?,"active")',
        interaction.user.id, partnerType, giveRes, giveAmt, recvRes, recvAmt, duration, duration
    );
    return interaction.editReply({ content: `✅ Trade route established with **${partnerType}**: Give ${giveAmt} ${giveRes} → Receive ${recvAmt} ${recvRes} for ${duration} turns.` });
}

async function handleTradeRouteCancel(interaction, routeId) {
    const db = interaction.client.db;
    const route = await db.get('SELECT * FROM trade_routes WHERE id=? AND initiator_id=?', routeId, interaction.user.id);
    if (!route) return interaction.editReply({ content: '⚠️ Route not found or you are not the initiator.' });
    if (route.status === 'tribute') return interaction.editReply({ content: '⚠️ War tributes cannot be cancelled.' });
    if (route.status === 'completed') return interaction.editReply({ content: '⚠️ This route has already completed.' });

    await db.run('UPDATE trade_routes SET status="broken" WHERE id=?', routeId);
    return interaction.editReply({ content: `❌ Trade route #${routeId} cancelled.` });
}

async function handleRouteAccept(interaction, routeId) {
    const db = interaction.client.db;
    const route = await db.get('SELECT * FROM trade_routes WHERE id=? AND partner_id=? AND status="pending"', routeId, interaction.user.id);
    if (!route) return interaction.reply({ content: '⚠️ This proposal is no longer valid.', ephemeral: true });

    await db.run('UPDATE trade_routes SET status="active" WHERE id=?', routeId);

    const emb = EmbedBuilder.from(interaction.message.embeds[0]).setColor(0x00FF88).setTitle('🤝 TRADE ROUTE ACCEPTED');
    await interaction.update({ embeds: [emb], components: [], content: interaction.message.content });

    const chan = await getNotificationChannel(interaction.client, { id: route.initiator_id, notification_channel: null, last_tax_channel: null });
    if (chan) {
        try { await chan.send({ content: `✅ <@${route.initiator_id}> — Your trade route proposal to <@${interaction.user.id}> was **accepted**.` }); } catch (_) {}
    }
}

async function handleRouteReject(interaction, routeId) {
    const db = interaction.client.db;
    const route = await db.get('SELECT * FROM trade_routes WHERE id=? AND partner_id=? AND status="pending"', routeId, interaction.user.id);
    if (!route) return interaction.reply({ content: '⚠️ This proposal is no longer valid.', ephemeral: true });

    await db.run('UPDATE trade_routes SET status="broken" WHERE id=?', routeId);

    const emb = EmbedBuilder.from(interaction.message.embeds[0]).setColor(0xFF0000).setTitle('❌ TRADE ROUTE REJECTED');
    await interaction.update({ embeds: [emb], components: [], content: interaction.message.content });

    const chan = await getNotificationChannel(interaction.client, { id: route.initiator_id, notification_channel: null, last_tax_channel: null });
    if (chan) {
        try { await chan.send({ content: `❌ <@${route.initiator_id}> — Your trade route proposal to <@${interaction.user.id}> was **rejected**.` }); } catch (_) {}
    }
}

// Weekly route resolution — called from scheduler.js
async function processTradeRoutes(db, client) {
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

            let receiveAmount = route.receive_amount;

            // Styx: dynamic Vitale pricing at resolution
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

            // Post NPC route notification
            if (NPC_TEXTS[route.partner_type]) {
                const chan = await getNotificationChannel(client, user);
                if (chan) await chan.send({ content: `🔄 <@${route.initiator_id}> Trade route settled. ${NPC_TEXTS[route.partner_type]}` });
            }

            // Decrement turns
            await db.run('UPDATE trade_routes SET turns_remaining=turns_remaining-1 WHERE id=?', route.id);
            if (route.turns_remaining - 1 <= 0) {
                await db.run('UPDATE trade_routes SET status="completed" WHERE id=?', route.id);
                const chan = await getNotificationChannel(client, user);
                if (chan) await chan.send({ content: `✅ <@${route.initiator_id}> Your trade route #${route.id} has completed after ${route.duration_turns} turns.` });
            }
        } catch (err) {
            console.error(`[TRADE] Route ${route.id} failed:`, err.message);
        }
    }
}

// Admin: dissolve a treaty
async function handleTreatyDissolve(db, interaction) {
    const initiatorId = interaction.options.getString('initiator');
    const partnerId   = interaction.options.getString('partner');
    const type        = interaction.options.getString('type');
    const treaty = await db.get(
        'SELECT * FROM treaties WHERE initiator_id=? AND partner_id=? AND treaty_type=? AND status="active"',
        initiatorId, partnerId, type
    );
    if (!treaty) return interaction.editReply({ content: 'No active treaty found matching those parameters.' });
    await db.run('UPDATE treaties SET status="broken" WHERE id=?', treaty.id);
    // Notify both parties
    for (const uid of [initiatorId, partnerId]) {
        const chan = await getNotificationChannel(interaction.client, { id: uid, notification_channel: null, last_tax_channel: null });
        if (chan) {
            try { await chan.send({ content: `⚠️ <@${uid}> Your **${type}** treaty with ${uid === initiatorId ? `<@${partnerId}>` : `<@${initiatorId}>`} has been dissolved by the High Command.` }); } catch (_) {}
        }
    }
    return interaction.editReply({ content: `⚖️ Treaty dissolved. Both parties notified.` });
}

function handleButton(interaction, action, args) {
    if (action === 'traderoute') {
        const sub = args[0];
        const routeId = parseInt(args[1]);
        if (isNaN(routeId)) return interaction.reply({ content: '⚠️ Invalid route ID.', ephemeral: true });
        if (sub === 'a') return handleRouteAccept(interaction, routeId);
        if (sub === 'r') return handleRouteReject(interaction, routeId);
    }
}

module.exports = {
    handleTradeRouteList, handleTradeRoutePropose, handleTradeRouteCancel,
    processTradeRoutes, handleTreatyDissolve, handleButton
};
