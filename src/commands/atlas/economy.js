const {
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ModalBuilder, TextInputBuilder, TextInputStyle
} = require('discord.js');
const { RESOURCES, TERRAIN_MULTIPLIERS, BUILDINGS, ANCESTRIES } = require('../../data/constants');
const {
    calcStabMultiplier, getCharBonuses, calcNobleState, formatWarningBanner,
    getPlayerRank, isVitaleFree, getNotificationChannel, calcMaintenance,
    resolveAtlasHQ, GREAT_HOUSES
} = require('../../utils/helpers');

async function handleTax(interaction) {
    const db = interaction.client.db;
    const userId = interaction.user.id;
    const user = await db.get('SELECT * FROM users WHERE id = ?', userId);

    const ONE_DAY = 24 * 60 * 60 * 1000;
    const now = Date.now();
    if (now - (user.last_tax || 0) < ONE_DAY) {
        const remaining = ONE_DAY - (now - (user.last_tax || 0));
        const hrs = Math.floor(remaining / 3600000);
        const mins = Math.floor((remaining % 3600000) / 60000);
        return interaction.editReply({ content: `⏳ You can collect taxes again in **${hrs}h ${mins}m**.` });
    }

    // ── STEP 3: Building production loop ─────────────────────────────────────
    const towns = await db.all('SELECT * FROM towns WHERE user_id = ?', userId);
    let totalWealth = 0, totalFoodProd = 0, totalFoodCost = 0, totalOresProd = 0;
    let totalOreConsume = 0, totalMetProd = 0, totalExoticProd = 0;
    let totalStabBonus = 0, totalWealthMultBonus = 0;

    for (const t of towns) {
        const mult = TERRAIN_MULTIPLIERS[t.terrain_type] || { food: 1.0, wealth: 1.0, ore: 1.0 };
        const bldgs = await db.all(
            'SELECT type FROM buildings WHERE town_id = ? AND (ready_at IS NULL OR ready_at <= ?)',
            t.id, now
        );
        for (const b of bldgs) {
            const bd = BUILDINGS[b.type.toUpperCase()];
            if (!bd) continue;
            totalWealth         += (bd.income_wealth      || 0) * mult.wealth;
            totalFoodProd       += (bd.food_prod          || 0) * mult.food;
            totalFoodCost       += (bd.food_cost          || 0);
            totalOresProd       += (bd.ore_prod           || 0) * mult.ore;
            totalOreConsume     += (bd.ore_consumption    || 0);
            totalMetProd        += (bd.metallurgy_prod    || 0);
            totalExoticProd     += (bd.exotic_prod        || 0);
            totalStabBonus      += (bd.stab_bonus         || 0);
            totalWealthMultBonus += (bd.wealth_mult_bonus || 0);
        }
    }

    // ── STEP 4: Ancestry bonuses ─────────────────────────────────────────────
    const ancestryKey = (user.ancestry || '').toUpperCase();
    const ancestryData = ANCESTRIES[ancestryKey];
    if (ancestryData?.house === 'CAOSSA') {
        totalMetProd  = Math.floor(totalMetProd  * 1.3);
        totalOresProd = Math.floor(totalOresProd * 1.2);
    }

    // ── STEP 5: Apply multipliers ────────────────────────────────────────────
    const charBonuses = getCharBonuses(user);
    const stabMult    = calcStabMultiplier(user.rate_stab);
    const servusMult  = 1 + ((user.servus || 0) * 0.02);
    const wealthMult  = 1 + totalWealthMultBonus;

    const finalWealth  = Math.floor(totalWealth * servusMult * stabMult * charBonuses.wealthBonus * wealthMult);
    const finalFoodNet = Math.floor((totalFoodProd * charBonuses.foodBonus) - totalFoodCost);
    const finalOres    = totalOresProd - totalOreConsume;
    const finalMet     = Math.floor(totalMetProd * stabMult);
    const finalExotics = totalExoticProd;
    const stabDrain    = Math.floor((user.servus || 0) / 5);

    // ── STEP 6: The Mothers faction bonus ────────────────────────────────────
    const mothersRel = await db.get(
        'SELECT score FROM relations WHERE user_id=? AND faction_name=?', userId, 'The Mothers'
    );

    // ── STEP 7: Rank-aware Vitale handling ───────────────────────────────────
    const rank    = getPlayerRank(user);
    const vFree   = isVitaleFree(user.ancestry);
    const { nobles, vitaleNeeded: rawVitaleNeeded, inGracePeriod } = calcNobleState(user);
    let vitaleNeeded = rawVitaleNeeded;
    if (mothersRel?.score >= 10 && rank === 'SOVEREIGN') vitaleNeeded = Math.ceil(vitaleNeeded / 2);

    let vitaleStabPenalty = 0, vitaleDeducted = 0, vitaleText = '';

    if (vFree || rank !== 'SOVEREIGN') {
        vitaleText = nobles > 0
            ? `${nobles} nobles (${vitaleNeeded} 💧/tick — subsidized by Imperial Academy)`
            : `No nobles yet (population below 200)`;
    } else if (inGracePeriod) {
        vitaleText = `${vitaleNeeded} 💧 — grace period (${3 - (user.tax_count || 0)} ticks left)`;
    } else if ((user.vitale || 0) >= vitaleNeeded && nobles > 0) {
        vitaleDeducted = vitaleNeeded;
        vitaleText = `${vitaleNeeded} 💧 paid ✅`;
    } else if (nobles > 0) {
        vitaleStabPenalty = -2;
        vitaleText = `${vitaleNeeded} 💧 ⚠️ DEFICIT (−2 Stability)`;
    }

    // ── STEP 8: Net stability + single DB UPDATE ─────────────────────────────
    const netStab = totalStabBonus - stabDrain + vitaleStabPenalty;
    const channelId = interaction.channelId;

    await db.run(`
        UPDATE users SET
            balance      = balance + 100,
            wealth       = COALESCE(wealth,0) + ?,
            food_surplus = COALESCE(food_surplus,0) + ?,
            ores         = MAX(0, COALESCE(ores,0) + ?),
            metallurgy   = COALESCE(metallurgy,0) + ?,
            exotics      = COALESCE(exotics,0) + ?,
            vitale       = COALESCE(vitale,0) - ?,
            rate_stab    = MAX(-10, MIN(10, rate_stab + ?)),
            last_tax     = ?,
            tax_count    = COALESCE(tax_count,0) + 1,
            last_tax_channel = ?,
            tax_notified = 0
        WHERE id = ?`,
        finalWealth, finalFoodNet, finalOres, finalMet, finalExotics,
        vitaleDeducted, netStab, now, channelId, userId
    );

    if (rank === 'SOVEREIGN' && !vFree && !inGracePeriod && nobles > 0) {
        const prestChange = vitaleDeducted > 0 ? +2 : -3;
        await db.run(
            'UPDATE users SET rate_prest = MAX(-10, MIN(10, rate_prest + ?)) WHERE id = ?',
            prestChange, userId
        );
    }

    // ── STEP 9: Atomic Guild low-relation check ──────────────────────────────
    const ag = await db.get(
        'SELECT score FROM relations WHERE user_id=? AND faction_name=?', userId, 'Atomic Guild'
    );
    if (ag?.score <= -20) {
        const r = Math.random();
        let gmAlert = null;
        if      (r < 0.005) gmAlert = `☠️ ASSASSINATION PLOT detected — Atomic Guild targeting ${interaction.user.username}. Review and decide.`;
        else if (r < 0.025) gmAlert = `🔗 SERVUS UPRISING RISK — Atomic Guild influence on ${interaction.user.username}. Review.`;
        else if (r < 0.075) gmAlert = `⚠️ REBEL ACTIVITY — Atomic Guild. Targeting ${interaction.user.username}.`;
        if (gmAlert) {
            await resolveAtlasHQ(interaction.client,
                new EmbedBuilder().setTitle('🔮 ATOMIC GUILD ALERT').setDescription(gmAlert).setColor(0x333333)
            );
        }
    }

    // ── STEP 10: Build embeds ───────────────────────────────────────────────
    const updatedUser = await db.get('SELECT rate_stab, rate_prest FROM users WHERE id=?', userId);
    const warnBanner  = formatWarningBanner(updatedUser.rate_stab, updatedUser.rate_prest);
    const warnColor   = warnBanner?.startsWith('🔴') ? 0xFF4444 : warnBanner ? 0xFFCC00 : null;
    const houseData   = ancestryData ? GREAT_HOUSES[ancestryData.house] : null;
    const houseStr    = houseData ? `${houseData.emoji} ${houseData.name}` : 'Independent';
    const armyMaint   = calcMaintenance(user);
    const servusWarn  = stabDrain > 0 && (user.rate_stab - stabDrain) <= -3
        ? '\n⚠️ **SERVUS UNREST RISING** — Rebellion may fire at −5 Stability.' : '';

    const econDesc = [
        `**Taxes Collected:** +100 :coin:`,
        `**Polity Wealth:** +${finalWealth} ⚖️`,
        ``,
        `**Resources Generated:**`,
        `🥩 Food: ${finalFoodNet >= 0 ? '+' : ''}${finalFoodNet}`,
        `⚒️ Ores: ${finalOres >= 0 ? '+' : ''}${finalOres}${finalOres < 0 ? ' ⚠️ Furnace consuming more than mines produce!' : ''}`,
        finalMet > 0 ? `🔩 Metallurgy: +${finalMet}` : null,
        finalExotics > 0 ? `🍷 Exotics: +${finalExotics}` : null,
        ``,
        `*Multipliers: Stability(×${stabMult.toFixed(2)}) · Servus(×${servusMult.toFixed(2)}) · INT(×${charBonuses.wealthBonus.toFixed(2)}) · WIS(×${charBonuses.foodBonus.toFixed(2)})*`,
        `Army upkeep: ${armyMaint} 🥩/day (charged by daily scheduler)`,
        servusWarn || null,
        warnBanner  || null,
    ].filter(Boolean).join('\n');

    const popDesc = [
        `**Rank:** ${rank} | **House:** ${houseStr}`,
        `**Commoners:** ${user.pop_commoners || 0}`,
        `⚔️ Infantry: ${user.mil_infantry || 0} | 🐎 Cavalry: ${user.mil_cavalry || 0} | 🏹 Ranged: ${user.mil_ranged || 0} | 🪨 Siege: ${user.mil_siege || 0}`,
        `**Nobles:** ${vitaleText}`,
        `**Servus drain:** ${stabDrain > 0 ? `−${stabDrain} Stability` : 'None'}`,
        `**Stability:** ${updatedUser.rate_stab}/10 | **Prestige:** ${updatedUser.rate_prest}/10`,
        warnBanner || null,
    ].filter(Boolean).join('\n');

    const econEmbed = new EmbedBuilder().setTitle('📊 ECONOMIC REPORT').setColor(warnColor || 0x00FF88).setDescription(econDesc);
    const popEmbed  = new EmbedBuilder().setTitle('👥 POPULATION REPORT').setColor(warnColor || 0x00BFFF).setDescription(popDesc);
    return interaction.editReply({ embeds: [econEmbed, popEmbed] });
}

async function handlePopulation(interaction) {
    const db = interaction.client.db;
    const user = await db.get('SELECT * FROM users WHERE id = ?', interaction.user.id);

    const { nobles, vitaleNeeded: rawVitaleNeeded, inGracePeriod } = calcNobleState(user);
    const commoners = user.pop_commoners ?? 100;
    const famineActive = (user.food_surplus ?? 0) <= 0;
    const stabDrain   = Math.floor((user.servus || 0) / 5);
    const rank        = getPlayerRank(user);
    const ancestryData = ANCESTRIES[(user.ancestry || '').toUpperCase()];
    const houseData    = ancestryData ? GREAT_HOUSES[ancestryData.house] : null;
    const houseStr     = houseData ? `${houseData.emoji} ${houseData.name}` : 'Independent';
    const armyMaint    = calcMaintenance(user);

    // The Mothers bonus for vitale display
    const mothersRel = await db.get(
        'SELECT score FROM relations WHERE user_id=? AND faction_name=?', interaction.user.id, 'The Mothers'
    );
    let vitaleNeeded = rawVitaleNeeded;
    if (mothersRel?.score >= 10 && rank === 'SOVEREIGN') vitaleNeeded = Math.ceil(vitaleNeeded / 2);

    const isSubsidized = !user.nation;
    const hasEnoughVitale = isSubsidized || (user.vitale ?? 0) >= vitaleNeeded;
    let vitaleStr;
    if (isSubsidized || rank !== 'SOVEREIGN' || isVitaleFree(user.ancestry)) {
        vitaleStr = nobles > 0
            ? `${nobles} (${vitaleNeeded} 💧 subsidized)` : `None (pop below 200)`;
    } else if (inGracePeriod) {
        vitaleStr = `${nobles} (${vitaleNeeded} 💧 grace)`;
    } else if (!hasEnoughVitale) {
        vitaleStr = `${nobles} (${vitaleNeeded} 💧 ⚠️ DEFICIT)`;
    } else {
        vitaleStr = `${nobles} (${vitaleNeeded} 💧 ✅)`;
    }

    const servusWarn = (user.servus || 0) > 0 && (user.rate_stab ?? 0) - stabDrain <= -3
        ? ` ⚠️ Rebellion risk` : '';

    const warnBanner = formatWarningBanner(user.rate_stab, user.rate_prest);
    const desc = [
        `**Rank:** ${rank} | **House:** ${houseStr}`,
        `**Commoners:** ${commoners}`,
        `⚔️ Inf: ${user.mil_infantry || 0} | 🐎 Cav: ${user.mil_cavalry || 0} | 🏹 Rng: ${user.mil_ranged || 0} | 🪨 Sie: ${user.mil_siege || 0}`,
        (user.mercs_temp || 0) > 0 ? `🗡️ Mercs: ${user.mercs_temp} *(disband at turn end)*` : null,
        `Army upkeep: ${armyMaint} 🥩/day`,
        ``,
        `Food: ${famineActive ? '🔴 FAMINE — −1%/day!' : '✅'}`,
        `Nobles: ${vitaleStr}`,
        `Servus: ${user.servus || 0}${servusWarn}${stabDrain > 0 ? ` (−${stabDrain} Stab)` : ''}`,
        warnBanner ? `\n${warnBanner}` : null,
    ].filter(Boolean).join('\n');

    const color = warnBanner
        ? (warnBanner.startsWith('🔴') ? 0xFF4444 : 0xFFCC00)
        : 0x00BFFF;

    const embed = new EmbedBuilder().setTitle('👥 CENSUS REPORT').setColor(color).setDescription(desc);
    return interaction.editReply({ embeds: [embed] });
}

async function handleBalance(interaction) {
    const db = interaction.client.db;
    const user = await db.get('SELECT * FROM users WHERE id = ?', interaction.user.id);
    const servusCount = user.servus || 0;
    const stabDrain   = Math.floor(servusCount / 5);
    const armyMaint   = calcMaintenance(user);

    let servusLine = `🔗 Servus: ${servusCount}`;
    if (servusCount > 0) {
        servusLine += ` *(−${stabDrain} Stability/tick)*`;
        if ((user.rate_stab ?? 0) - stabDrain <= -3) servusLine += ` ⚠️ Rebellion risk`;
    }

    const embed = new EmbedBuilder().setTitle('💰 TREASURY').setColor(0xFFD700)
        .setDescription([
            `:coin: Balance: ${user.balance || 0}  |  ⚖️ Wealth: ${user.wealth || 0}`,
            ``,
            `🥩 Food: ${user.food_surplus || 0}  |  ⚒️ Ores: ${user.ores || 0}`,
            `🔩 Metallurgy: ${user.metallurgy || 0}  |  💧 Vitale: ${user.vitale || 0}`,
            `🍷 Exotics: ${user.exotics || 0}`,
            servusLine,
            ``,
            `⚔️ Inf: ${user.mil_infantry || 0}  🐎 Cav: ${user.mil_cavalry || 0}  🏹 Rng: ${user.mil_ranged || 0}  🪨 Sie: ${user.mil_siege || 0}`,
            `🗡️ Mercs: ${user.mercs_temp || 0}  |  Upkeep: ${armyMaint} 🥩/day`,
        ].join('\n'));
    return interaction.editReply({ embeds: [embed] });
}

async function handleDonate(interaction) {
    const db = interaction.client.db;
    const amount = interaction.options.getInteger('amount');
    const user   = await db.get('SELECT balance FROM users WHERE id = ?', interaction.user.id);
    const cost   = amount * 1000;
    if ((user.balance || 0) < cost) return interaction.editReply({ content: `⚠️ Insufficient Balance. You need **${cost.toLocaleString()} :coin:** to convert **${amount} ⚖️**.` });
    await db.run('UPDATE users SET balance = balance - ?, wealth = COALESCE(wealth, 0) + ? WHERE id = ?', cost, amount, interaction.user.id);
    return interaction.editReply({ content: `✅ Converted **${cost.toLocaleString()} :coin:** → **${amount} ⚖️** Polity Wealth.` });
}

async function handleGift(interaction) {
    const db       = interaction.client.db;
    const targetId = interaction.options.getString('target');
    const res      = interaction.options.getString('resource');
    const amount   = interaction.options.getInteger('amount');
    if (amount <= 0) return interaction.editReply({ content: '⚠️ Amount must be positive.' });
    if (targetId === interaction.user.id) return interaction.editReply({ content: '⚠️ You cannot gift to yourself.' });
    const target = await db.get('SELECT id FROM users WHERE id = ?', targetId);
    if (!target) return interaction.editReply({ content: '⚠️ Target lineage not found.' });
    const user = await db.get('SELECT * FROM users WHERE id = ?', interaction.user.id);
    if ((user[res] || 0) < amount) return interaction.editReply({ content: `⚠️ Insufficient ${res}. You have **${user[res] || 0}**.` });
    await db.run(`UPDATE users SET ${res} = ${res} - ? WHERE id = ?`, amount, interaction.user.id);
    await db.run(`UPDATE users SET ${res} = COALESCE(${res}, 0) + ? WHERE id = ?`, amount, targetId);
    return interaction.editReply({ content: `🎁 Gifted **${amount} ${res.toUpperCase()}** to <@${targetId}>.` });
}

async function handleTrade(interaction) {
    const targetId = interaction.options.getString('target');
    if (targetId === interaction.user.id) return interaction.editReply({ content: '⚠️ Cannot trade with yourself.' });
    const embed = new EmbedBuilder().setTitle('🤝 TRADE PROPOSAL').setColor(0x00BFFF)
        .setDescription(`Drafting a trade with <@${targetId}>... Click below to build the offer.`);
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`tmodalg_${targetId}`).setLabel('Set What You Give').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`tmodalr_${targetId}`).setLabel('Set What You Request').setStyle(ButtonStyle.Success)
    );
    return interaction.editReply({ embeds: [embed], components: [row] });
}

async function handleEmpire(interaction) {
    const db = interaction.client.db;
    const userId = interaction.user.id;
    const emb = await renderEmpireEmbed(db);

    const rel = await db.get('SELECT score FROM relations WHERE user_id=? AND faction_name=?', userId, 'Tyrannite');
    const isEmbargoed = rel ? rel.score <= -20 : false;

    let vitaleBtn;
    if (isEmbargoed) {
        emb.setFooter({ text: 'Embargoed — seek Vitale through player trade.' });
        vitaleBtn = new ButtonBuilder().setCustomId('vitale_buy').setLabel('Embargoed').setStyle(ButtonStyle.Danger).setDisabled(true);
    } else {
        vitaleBtn = new ButtonBuilder().setCustomId('vitale_buy').setLabel('Buy Vitale').setStyle(ButtonStyle.Primary).setEmoji('💧');
    }

    const routeCount = (await db.get("SELECT COUNT(*) as cnt FROM trade_routes WHERE initiator_id=? AND status NOT IN ('completed','broken')", userId))?.cnt || 0;

    return interaction.editReply({ embeds: [emb], components: [
        new ActionRowBuilder().addComponents(vitaleBtn,
            new ButtonBuilder().setCustomId(`empire_trade_${userId}`).setLabel('Propose Trade').setStyle(ButtonStyle.Primary).setEmoji('🤝'),
            new ButtonBuilder().setCustomId(`empire_routes_${userId}`).setLabel(`Routes (${routeCount})`).setStyle(ButtonStyle.Secondary).setEmoji('🔄')
        ),
        new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`empire_newroute_${userId}`).setLabel('New Trade Route').setStyle(ButtonStyle.Success).setEmoji('📨'),
            new ButtonBuilder().setCustomId(`empire_cancelroute_${userId}`).setLabel('Cancel Route').setStyle(ButtonStyle.Danger).setEmoji('❌')
        )
    ]});
}

async function renderEmpireEmbed(db) {
    const settings    = await db.all('SELECT * FROM global_settings');
    const getS        = (k) => settings.find(s => s.key === k)?.value;
    const playerCount = (await db.get('SELECT COUNT(*) as cnt FROM users WHERE status = ?', 'active'))?.cnt || 1;
    const vitaleBase  = parseInt(getS('vitale_base')) || 15;
    const vitaleSold  = parseInt(getS('vitale_sold_week')) || 0;
    const vitalePool  = vitaleBase + (10 * playerCount);
    const demandRatio = vitaleSold / Math.max(1, vitalePool);
    const vitalePrice = Math.floor(50 * (1 + demandRatio * 4));

    return new EmbedBuilder().setTitle('🏛️ STYX EMPIRE DASHBOARD').setColor(0x6A0DAD)
        .setDescription([
            `**Vitale Market**`,
            `Pool: ${vitalePool} 💧 | Sold: ${vitaleSold} 💧`,
            `Current Price: **${vitalePrice} ⚖️** per unit`,
            ``,
            `*Price rises with weekly demand. Market resets each Monday.*`,
        ].join('\n'));
}

async function handleButton(interaction, action, args) {
    const db = interaction.client.db;

    // Trade: "Set What You Give" button
    if (action === 'tmodalg') {
        const targetId = args[0];
        const modal = new ModalBuilder().setCustomId(`tmodalgm_${targetId}`).setTitle('🎁 Set What You Give');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('res').setLabel('Resource (wealth, food_surplus, etc)').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('wealth')),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('amt').setLabel('Amount').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('100'))
        );
        return await interaction.showModal(modal);
    }

    // Trade: "Set What You Request" button
    if (action === 'tmodalr') {
        const targetId = args[0];
        const modal = new ModalBuilder().setCustomId(`tmodalrm_${targetId}`).setTitle('🤝 Set What You Request');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('res').setLabel('Resource (wealth, food_surplus, etc)').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('food_surplus')),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('amt').setLabel('Amount').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('50'))
        );
        return await interaction.showModal(modal);
    }

    if (action === 'vitale' && args[0] === 'buy') {
        const rel = await db.get('SELECT score FROM relations WHERE user_id=? AND faction_name=?', interaction.user.id, 'Tyrannite');
        if (rel && rel.score <= -20)
            return interaction.reply({ content: '🚫 Embargoed by Styx Empire.', ephemeral: true });

        const settings = await db.all('SELECT * FROM global_settings');
        const getS = k => settings.find(s => s.key === k)?.value;
        const pCount = (await db.get('SELECT COUNT(*) as cnt FROM users WHERE status=?', 'active'))?.cnt || 1;
        const vBase = parseInt(getS('vitale_base')) || 15;
        const vSold = parseInt(getS('vitale_sold_week')) || 0;
        const pool = vBase + (10 * pCount);
        const price = Math.floor(50 * (1 + (vSold / Math.max(1, pool)) * 4));

        const modal = new ModalBuilder().setCustomId(`vitale_modal_${price}`).setTitle(`💧 Buy Vitale — ${price}⚖️ each`);
        modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId('amount').setLabel(`Price: ${price} ⚖️/unit`).setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('How many?')
        ));
        return await interaction.showModal(modal);
    }

    // Empire GUI: My Routes
    if (action === 'empire' && args[0] === 'routes') {
        await interaction.deferUpdate();
        const trade = require('./trade');
        return await trade.handleTradeRouteList(interaction);
    }
    // Empire GUI: New Route — open interactive modal
    if (action === 'empire' && args[0] === 'newroute') {
        const modal = new ModalBuilder().setCustomId(`empire_route_modal`).setTitle('📨 New Trade Route');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('partner_type').setLabel('Partner (styx/sciatic/caossa/player)').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('styx')),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('partner_id').setLabel('Player ID (only if partner=player)').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('')),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('give_res').setLabel('Resource you give').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('wealth')),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('give_amt').setLabel('Amount you give').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('100')),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('recv_res').setLabel('Resource you receive').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('vitale'))
        );
        return await interaction.showModal(modal);
    }
    // Empire GUI: Cancel Route
    if (action === 'empire' && args[0] === 'cancelroute') {
        await interaction.deferUpdate();
        return interaction.editReply({ embeds: [new EmbedBuilder().setTitle('❌ Cancel Route').setColor(0xFF4444)
            .setDescription('Use `/atlas traderoute cancel route_id:{id}`.\nClick **Routes** to see your route IDs.')],
            components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`empire_back`).setLabel('← Back').setStyle(ButtonStyle.Secondary))] });
    }
    // Empire GUI: Propose Trade
    if (action === 'empire' && args[0] === 'trade') {
        await interaction.deferUpdate();
        return interaction.editReply({ embeds: [new EmbedBuilder().setTitle('🤝 Propose Trade').setColor(0x00BFFF)
            .setDescription('Use `/atlas trade target:{player}` for player-to-player trading.')],
            components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`empire_back`).setLabel('← Back').setStyle(ButtonStyle.Secondary))] });
    }
    // Empire GUI: Back button
    if (action === 'empire' && args[0] === 'back') {
        return await handleEmpire(interaction);
    }
}

async function handleModal(interaction, action, args) {
    const db = interaction.client.db;

    // Empire: New Route modal submit
    if (action === 'empire' && args[0] === 'route' && args[1] === 'modal') {
        const partnerType = interaction.fields.getTextInputValue('partner_type')?.trim().toLowerCase();
        const partnerId   = interaction.fields.getTextInputValue('partner_id')?.trim() || null;
        const giveRes     = interaction.fields.getTextInputValue('give_res')?.trim().toLowerCase();
        const giveAmt     = parseInt(interaction.fields.getTextInputValue('give_amt'));
        const recvRes     = interaction.fields.getTextInputValue('recv_res')?.trim().toLowerCase();
        if (!partnerType || !giveRes || !recvRes || isNaN(giveAmt) || giveAmt <= 0)
            return interaction.reply({ content: '⚠️ Invalid input.', ephemeral: true });

        if (!['styx', 'sciatic', 'caossa', 'player'].includes(partnerType))
            return interaction.reply({ content: '⚠️ Partner must be: styx, sciatic, caossa, or player.', ephemeral: true });

        const user = await db.get('SELECT * FROM users WHERE id=?', interaction.user.id);

        // Player routes need partner ID
        if (partnerType === 'player') {
            if (!partnerId) return interaction.reply({ content: '⚠️ Player ID required for player routes.', ephemeral: true });
            if (partnerId === interaction.user.id) return interaction.reply({ content: '⚠️ Cannot trade with yourself.', ephemeral: true });
            const target = await db.get('SELECT id FROM users WHERE id=? AND status="active"', partnerId);
            if (!target) return interaction.reply({ content: '⚠️ Target not found.', ephemeral: true });

            const result = await db.run(
                'INSERT INTO trade_routes (initiator_id, partner_id, partner_type, give_resource, give_amount, receive_resource, receive_amount, duration_turns, turns_remaining, status) VALUES (?,?,?,?,?,?,?,?,?,"pending")',
                interaction.user.id, partnerId, partnerType, giveRes, giveAmt, recvRes, 0, 1, 1
            );
            // Notify partner
            const chan = await getNotificationChannel(interaction.client, { id: partnerId, notification_channel: null, last_tax_channel: null });
            if (chan) {
                const emb = new EmbedBuilder().setTitle('🤝 TRADE ROUTE PROPOSAL').setColor(0x00BFFF)
                    .setDescription(`<@${interaction.user.id}> proposes: Give **${giveAmt} ${giveRes}** → Receive from you.\nAccept within the diplomacy menu.`);
                try { await chan.send({ content: `<@${partnerId}>`, embeds: [emb] }); } catch (_) {}
            }
            return interaction.reply({ content: `📨 Trade route proposal sent to <@${partnerId}>.`, ephemeral: true });
        }

        // NPC routes: insert active directly
        if (partnerType === 'sciatic') {
            const rel = await db.get('SELECT score FROM relations WHERE user_id=? AND faction_name=?', interaction.user.id, 'Sciatic League');
            if (!rel || rel.score < 10) return interaction.reply({ content: '⚠️ Sciatic League requires relation ≥ 10.', ephemeral: true });
        }
        if (partnerType === 'caossa') {
            const rel = await db.get('SELECT score FROM relations WHERE user_id=? AND faction_name=?', interaction.user.id, 'Caossa');
            if (!rel || rel.score < 5) return interaction.reply({ content: '⚠️ Caossa requires relation ≥ 5.', ephemeral: true });
        }

        await db.run(
            'INSERT INTO trade_routes (initiator_id, partner_id, partner_type, give_resource, give_amount, receive_resource, receive_amount, duration_turns, turns_remaining, status) VALUES (?,NULL,?,?,?,?,?,?,?,"active")',
            interaction.user.id, partnerType, giveRes, giveAmt, recvRes, 0, 1, 1
        );
        return interaction.reply({ content: `✅ Trade route with **${partnerType}** established! Give ${giveAmt} ${giveRes} → Receive from them.`, ephemeral: true });
    }

    // Trade: Give modal submit
    if (action === 'tmodalgm') {
        const targetId = args[0];
        const res = interaction.fields.getTextInputValue('res')?.trim().toLowerCase();
        const amt = parseInt(interaction.fields.getTextInputValue('amt'));
        if (!res || isNaN(amt) || amt <= 0) return interaction.reply({ content: '⚠️ Invalid input.', ephemeral: true });
        const user = await db.get('SELECT * FROM users WHERE id=?', interaction.user.id);
        if ((user[res] || 0) < amt) return interaction.reply({ content: `⚠️ Insufficient ${res}.`, ephemeral: true });

        return interaction.reply({
            content: `✅ You will give **${amt} ${res}**.\nClick **Set What You Request** to continue.`,
            ephemeral: true
        });
    }

    // Trade: Request modal submit
    if (action === 'tmodalrm') {
        const targetId = args[0];
        const res = interaction.fields.getTextInputValue('res')?.trim().toLowerCase();
        const amt = parseInt(interaction.fields.getTextInputValue('amt'));
        if (!res || isNaN(amt) || amt <= 0) return interaction.reply({ content: '⚠️ Invalid input.', ephemeral: true });

        return interaction.reply({
            content: `✅ You will request **${amt} ${res}**.\nBoth sides set — use the trade embed to confirm or start over.`,
            ephemeral: true
        });
    }

    if (action === 'vitale' && args[0] === 'modal') {
        const vitalePrice = parseInt(args[1]);
        const amount      = parseInt(interaction.fields.getTextInputValue('amount')?.trim());
        if (isNaN(amount) || amount <= 0) return interaction.reply({ content: '⚠️ Invalid amount.', ephemeral: true });
        await interaction.deferUpdate();

        const user = await db.get('SELECT wealth, nation FROM users WHERE id = ?', interaction.user.id);
        if (!user.nation) return interaction.editReply({ content: '⚠️ You must found a nation to trade with the Styx Empire.', embeds: [], components: [] });

        const totalCost = vitalePrice * amount;
        if ((user.wealth || 0) < totalCost) return interaction.editReply({ content: `⚠️ Insufficient Wealth. You need **${totalCost} ⚖️**.`, embeds: [], components: [] });

        await db.run('UPDATE users SET wealth = wealth - ?, vitale = COALESCE(vitale, 0) + ? WHERE id = ?', totalCost, amount, interaction.user.id);
        await db.run('UPDATE global_settings SET value = CAST(value AS INTEGER) + ? WHERE key = ?', amount, 'vitale_sold_week');

        const emb = await renderEmpireEmbed(db);
        return interaction.editReply({ content: `💧 **Transaction complete.** Purchased **${amount} Vitale** for **${totalCost} ⚖️**.`, embeds: [emb], components: [] });
    }
}

module.exports = {
    handleTax, handlePopulation, handleBalance, handleDonate, handleGift,
    handleTrade, handleEmpire, handleButton, handleModal
};
