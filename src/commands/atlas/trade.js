const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { RESOURCES } = require('../../data/constants');
const { getNotificationChannel, notifyPlayer } = require('../../utils/helpers');

const NPC_TEXTS = {
    styx:    'Imperial merchants arrive. Wealth exchanged for Vitale at current market rates.',
    sciatic: 'Sciatic traders deliver goods from distant ports.',
    caossa:  'A Caossi caravan arrives bearing ore and worked metal.'
};

const VALID_RESOURCES = new Set(['balance', 'wealth', 'food', 'ores', 'metallurgy', 'vitale', 'exotics', 'servus']);

async function handleTradeRouteList(interaction) {
    const db = interaction.client.db;
    const routes = await db.all(
        "SELECT * FROM trade_routes WHERE (initiator_id=? OR partner_id=?) AND status NOT IN ('completed','broken')",
        interaction.user.id, interaction.user.id
    );
    if (!routes.length) return interaction.editReply({ content: 'You have no active trade routes. Use `/atlas traderoute propose` to create one.' });

    const lines = routes.map(r => {
        const partnerLabel = r.partner_type === 'player'
            ? `<@${r.partner_id}>` : r.partner_type.charAt(0).toUpperCase() + r.partner_type.slice(1);
        return `**#${r.id}** | ${partnerLabel} | Give: ${r.give_amount.toLocaleString('en-US')} ${r.give_resource} → Receive: ${r.receive_amount.toLocaleString('en-US')} ${r.receive_resource} | ${r.turns_remaining.toLocaleString('en-US')}/${r.duration_turns.toLocaleString('en-US')} turns | ${r.status}`;
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

    // Relation embargo check — blocked only when Hostile (≤ −10). No positive-relation requirement.
    if (partnerType === 'sciatic') {
        const rel = await db.get('SELECT score FROM relations WHERE user_id=? AND faction_name=?', interaction.user.id, 'Sciatic League');
        if (rel && rel.score <= -10) return interaction.editReply({ content: '🚫 Sciatic League relations are **Hostile** (≤−10). Bribe or gift them above −10 to trade.' });
    }
    if (partnerType === 'caossa') {
        const rel = await db.get('SELECT score FROM relations WHERE user_id=? AND faction_name=?', interaction.user.id, 'Caossa');
        if (rel && rel.score <= -10) return interaction.editReply({ content: '🚫 Caossa relations are **Hostile** (≤−10). Bribe or gift them above −10 to trade.' });
    }

    // Player routes: require partner acceptance
    if (partnerType === 'player') {
        if (!partnerId) return interaction.editReply({ content: '⚠️ A partner player is required for player routes.' });
        if (partnerId === interaction.user.id) return interaction.editReply({ content: '⚠️ Cannot trade with yourself.' });
        const target = await db.get(`SELECT id FROM users WHERE id=? AND status='active'`, partnerId);
        if (!target) return interaction.editReply({ content: '⚠️ Target player not found or not active.' });

        const result = await db.run(
            'INSERT INTO trade_routes (initiator_id, partner_id, partner_type, give_resource, give_amount, receive_resource, receive_amount, duration_turns, turns_remaining, status) VALUES (?,?,?,?,?,?,?,?,?,?)',
            interaction.user.id, partnerId, partnerType, giveRes, giveAmt, recvRes, recvAmt, duration, duration, 'pending'
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
            try { await chan.send({ content: `<@${partnerId}>`, embeds: [emb], components: [row] }); } catch {}
        }
        return interaction.editReply({ content: `📨 Trade route proposal sent to <@${partnerId}>. Awaiting their response.` });
    }

    // NPC routes: insert active directly
    await db.run(
        'INSERT INTO trade_routes (initiator_id, partner_id, partner_type, give_resource, give_amount, receive_resource, receive_amount, duration_turns, turns_remaining, status) VALUES (?,NULL,?,?,?,?,?,?,?,?)',
        interaction.user.id, partnerType, giveRes, giveAmt, recvRes, recvAmt, duration, duration, 'active'
    );
    return interaction.editReply({ content: `✅ Trade route established with **${partnerType}**: Give ${giveAmt} ${giveRes} → Receive ${recvAmt} ${recvRes} for ${duration} turns.` });
}

async function handleTradeRouteCancel(interaction, routeId) {
    const db = interaction.client.db;
    const route = await db.get('SELECT * FROM trade_routes WHERE id=? AND initiator_id=?', routeId, interaction.user.id);
    if (!route) return interaction.editReply({ content: '⚠️ Route not found or you are not the initiator.' });
    if (route.status === 'tribute') return interaction.editReply({ content: '⚠️ War tributes cannot be cancelled.' });
    if (route.status === 'completed') return interaction.editReply({ content: '⚠️ This route has already completed.' });

    await db.run(`UPDATE trade_routes SET status='broken' WHERE id=?`, routeId);
    return interaction.editReply({ content: `❌ Trade route #${routeId} cancelled.` });
}

async function handleRouteAccept(interaction, routeId) {
    const db = interaction.client.db;
    const route = await db.get(`SELECT * FROM trade_routes WHERE id=? AND partner_id=? AND status='pending'`, routeId, interaction.user.id);
    if (!route)
        return ephemeralReply(interaction, '⚠️ This proposal is no longer valid.');

    await db.run(`UPDATE trade_routes SET status='active' WHERE id=?`, routeId);

    const emb = EmbedBuilder.from(interaction.message.embeds[0]).setColor(0x00FF88).setTitle('🤝 TRADE ROUTE ACCEPTED');
    await interaction.update({ embeds: [emb], components: [], content: interaction.message.content });

    const chan = await getNotificationChannel(interaction.client, { id: route.initiator_id, notification_channel: null, last_tax_channel: null });
    if (chan) {
        try { await chan.send({ content: `✅ <@${route.initiator_id}> — Your trade route proposal to <@${interaction.user.id}> was **accepted**.` }); } catch {}
    }
}

async function handleRouteReject(interaction, routeId) {
    const db = interaction.client.db;
    const route = await db.get(        `SELECT * FROM trade_routes WHERE id=? AND partner_id=? AND status='pending'`, routeId, interaction.user.id);
    if (!route)
        return ephemeralReply(interaction, '⚠️ This proposal is no longer valid.');

    await db.run(`UPDATE trade_routes SET status='broken' WHERE id=?`, routeId);

    const emb = EmbedBuilder.from(interaction.message.embeds[0]).setColor(0xFF0000).setTitle('❌ TRADE ROUTE REJECTED');
    await interaction.update({ embeds: [emb], components: [], content: interaction.message.content });

    const chan = await getNotificationChannel(interaction.client, { id: route.initiator_id, notification_channel: null, last_tax_channel: null });
    if (chan) {
        try { await chan.send({ content: `❌ <@${route.initiator_id}> — Your trade route proposal to <@${interaction.user.id}> was **rejected**.` }); } catch {}
    }
}

/**
 * Processes one scheduler tick for all active trade routes.
 * Called by the weekly scheduler (Monday 00:00) AFTER the demand pool reset.
 *
 * Faction routes: recalculates receive amount live from S&D + relations each tick.
 * Player routes:  fixed amounts agreed at route creation; breaks if either side is short.
 */
async function processTradeRoutes(db, client) {
    const { calculateFactionRouteReturn, FACTION_DB_NAMES } = require('./economy');

    // ── 1. Faction routes ─────────────────────────────────────────────────────
    const factionRoutes = await db.all(
        "SELECT * FROM trade_routes WHERE partner_type IN ('styx','sciatic','caossa') AND status='active'"
    );

    for (const route of factionRoutes) {
        try {
            // Guard against corrupted resource names reaching SQL
            if (!VALID_RESOURCES.has(route.give_resource) || !VALID_RESOURCES.has(route.receive_resource)) {
                console.error(`[TRADE ROUTES] Route #${route.id} has invalid resource column — skipping.`);
                continue;
            }

            // Relation check — pause if hostile
            const factionDbName = FACTION_DB_NAMES[route.partner_type];
            const rel = factionDbName
                ? await db.get('SELECT score FROM relations WHERE user_id=? AND faction_name=?',
                               route.initiator_id, factionDbName)
                : null;
            const relScore = rel?.score ?? 0;

            const user = await db.get(
                `SELECT ${route.give_resource}, ${route.receive_resource} FROM users WHERE id=?`,
                route.initiator_id
            );

            if (relScore <= -10) {
                await db.run("UPDATE trade_routes SET status='paused' WHERE id=?", route.id);
                await notifyPlayer(client, user, {
                    content: `⚠️ Trade route #${route.id} with **${factionDbName}** has been **paused** — your relations fell to Hostile (${relScore}). Restore standing above −10 to resume.`,
                });
                console.log(`[TRADE ROUTES] Route #${route.id} paused — hostile relations (${relScore}).`);
                continue;
            }

            // Check if the player still has enough to give this tick
            if (!user || (user[route.give_resource] || 0) < route.give_amount) {
                // Skip rather than break — player may recover next turn
                await notifyPlayer(client, user, {
                    content: `⚠️ Trade route #${route.id} skipped this turn — insufficient **${route.give_resource}** (need ${route.give_amount.toLocaleString('en-US')}, have ${(user?.[route.give_resource] || 0).toLocaleString('en-US')}).`,
                });
                console.log(`[TRADE ROUTES] Route #${route.id} skipped — insufficient ${route.give_resource}.`);
                continue;
            }

            // Execute: integral-based receive amount, demand pool updated inside
            const { recvAmount, breakdown } = await calculateFactionRouteReturn(db, route, relScore);

            if (recvAmount <= 0) {
                await notifyPlayer(client, user, {
                    content: `⚠️ Trade route #${route.id} skipped — market fully saturated for **${route.receive_resource}**. It will resume after the Monday reset.`,
                });
                continue;
            }

            // Deduct give, credit receive
            await db.run(
                `UPDATE users SET
                    ${route.give_resource}    = MAX(0, COALESCE(${route.give_resource},    0) - ?),
                    ${route.receive_resource} = COALESCE(${route.receive_resource}, 0) + ?
                 WHERE id = ?`,
                route.give_amount, recvAmount, route.initiator_id
            );

            // Manage turns_remaining and completion
            const newTurns = route.turns_remaining !== null ? route.turns_remaining - 1 : null;
            const isComplete = newTurns !== null && newTurns <= 0;

            await db.run(
                "UPDATE trade_routes SET turns_remaining=?, status=? WHERE id=?",
                isComplete ? 0 : newTurns,
                isComplete ? 'completed' : 'active',
                route.id
            );

            const avgRate = (recvAmount / route.give_amount).toFixed(4);
            const turnsMsg = isComplete
                ? `\n✅ Route completed — all turns fulfilled.`
                : newTurns !== null ? `\n${newTurns} turn(s) remaining.` : '';
            const overflowWarn = breakdown.overflow > 0
                ? `\n⚠️ ${breakdown.overflow.toLocaleString('en-US')} units traded at floor rate (pool saturated). Consider a smaller per-turn amount.`
                : '';

            await notifyPlayer(client, user, {
                content: [
                    `📦 **Trade route #${route.id} executed:**`,
                    `Gave **${route.give_amount.toLocaleString('en-US')} ${route.give_resource}** → received **${recvAmount.toLocaleString('en-US')} ${route.receive_resource}** (avg rate: ${avgRate})`,
                    overflowWarn,
                    turnsMsg,
                ].filter(Boolean).join('\n'),
            });

            console.log(`[TRADE ROUTES] Faction route #${route.id} (${route.partner_type}): gave ${route.give_amount} ${route.give_resource}, received ${recvAmount} ${route.receive_resource}.`);

        } catch (err) {
            console.error(`[TRADE ROUTES] Faction route #${route.id} failed:`, err.message);
        }
    }

    // ── 2. Player-to-player routes ────────────────────────────────────────────
    const playerRoutes = await db.all(
        "SELECT * FROM trade_routes WHERE partner_type='player' AND status='active'"
    );

    for (const route of playerRoutes) {
        try {
            if (!VALID_RESOURCES.has(route.give_resource) || !VALID_RESOURCES.has(route.receive_resource)) {
                console.error(`[TRADE ROUTES] Player route #${route.id} has invalid resource — skipping.`);
                continue;
            }

            const initiator = await db.get(
                `SELECT ${route.give_resource} FROM users WHERE id=?`, route.initiator_id
            );
            const partner = await db.get(
                `SELECT ${route.receive_resource} FROM users WHERE id=?`, route.partner_id
            );

            const initHas = initiator?.[route.give_resource]   || 0;
            const partHas = partner?.[route.receive_resource]  || 0;

            // If either side can't deliver, break the route
            if (initHas < route.give_amount || partHas < route.receive_amount) {
                await db.run("UPDATE trade_routes SET status='broken' WHERE id=?", route.id);
                const shortUser = initHas < route.give_amount ? initiator : partner;
                const otherUser = initHas < route.give_amount ? partner : initiator;
                const bothShort = initHas < route.give_amount && partHas < route.receive_amount;
                await notifyPlayer(client, shortUser, { content: `💔 Trade route #${route.id} **broken** — you lacked sufficient resources for this turn's payment.` });
                await notifyPlayer(client, otherUser, { content: bothShort ? `💔 Trade route #${route.id} **broken** — you lacked sufficient resources for this turn's payment.` : `💔 Trade route #${route.id} **broken** — your partner lacked resources to fulfill their side.` });
                console.log(`[TRADE ROUTES] Player route #${route.id} broken — insufficient resources.`);
                continue;
            }

            // Initiator: give → receive
            await db.run(
                `UPDATE users SET
                    ${route.give_resource}    = MAX(0, COALESCE(${route.give_resource},    0) - ?),
                    ${route.receive_resource} = COALESCE(${route.receive_resource}, 0) + ?
                 WHERE id = ?`,
                route.give_amount, route.receive_amount, route.initiator_id
            );
            // Partner: receive → give
            await db.run(
                `UPDATE users SET
                    ${route.receive_resource} = MAX(0, COALESCE(${route.receive_resource}, 0) - ?),
                    ${route.give_resource}    = COALESCE(${route.give_resource},    0) + ?
                 WHERE id = ?`,
                route.receive_amount, route.give_amount, route.partner_id
            );

            const newTurns = route.turns_remaining !== null ? route.turns_remaining - 1 : null;
            const isComplete = newTurns !== null && newTurns <= 0;

            await db.run(
                "UPDATE trade_routes SET turns_remaining=?, status=? WHERE id=?",
                isComplete ? 0 : newTurns,
                isComplete ? 'completed' : 'active',
                route.id
            );

            const turnsMsg = isComplete ? `✅ Route completed.` : newTurns !== null ? `${newTurns} turn(s) remaining.` : 'Indefinite route continues.';
            await notifyPlayer(client, initiator, {
                content: `📦 Route #${route.id}: gave **${route.give_amount.toLocaleString('en-US')} ${route.give_resource}**, received **${route.receive_amount.toLocaleString('en-US')} ${route.receive_resource}**. ${turnsMsg}`,
            });
            await notifyPlayer(client, partner, {
                content: `📦 Route #${route.id}: gave **${route.receive_amount.toLocaleString('en-US')} ${route.receive_resource}**, received **${route.give_amount.toLocaleString('en-US')} ${route.give_resource}**. ${turnsMsg}`,
            });

            console.log(`[TRADE ROUTES] Player route #${route.id}: ${route.initiator_id} ↔ ${route.partner_id} tick complete.`);

        } catch (err) {
            console.error(`[TRADE ROUTES] Player route #${route.id} failed:`, err.message);
        }
    }

    const total = factionRoutes.length + playerRoutes.length;
    console.log(`[TRADE ROUTES] Processed ${total} route(s) (${factionRoutes.length} faction, ${playerRoutes.length} player).`);
}

function handleButton(interaction, action, args) {
    if (action === 'traderoute') {
        const sub = args[0];
        const routeId = parseInt(args[1]);
        if (!routeId)
            return ephemeralReply(interaction, '⚠️ Invalid route ID.');
        if (sub === 'a') return handleRouteAccept(interaction, routeId);
        if (sub === 'r') return handleRouteReject(interaction, routeId);
    }
}

module.exports = {
    handleTradeRouteList, handleTradeRoutePropose, handleTradeRouteCancel,
    processTradeRoutes, handleButton
};
