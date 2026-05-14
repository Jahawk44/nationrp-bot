const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { STAT_MAPPING, BUILDINGS, TERRAINS, EMOJIS, STAT_KEYS, ARMY_TYPES, MERC_DESC } = require('../../data/constants');
const { getMod, fmtMod, isGM, isOwner, getCharBonuses, calcMaintenance } = require('../../utils/helpers');
const warfare = require('./warfare');

// ─── Scout ────────────────────────────────────────────────────────────────────

async function handleScout(interaction) {
    const db           = interaction.client.db;
    const targetUserId = interaction.options.getString('user');
    const targetTownName = interaction.options.getString('town');

    if (targetUserId === interaction.user.id) return interaction.editReply({ content: '⚠️ You cannot scout your own settlement.' });

    const attacker = await db.get('SELECT * FROM users WHERE id = ?', interaction.user.id);
    const defender = await db.get('SELECT id FROM users WHERE id = ?', targetUserId);
    if (!defender) return interaction.editReply({ content: '⚠️ Target lineage not found.' });

    const targetTown = await db.get('SELECT * FROM towns WHERE user_id = ? AND name = ?', targetUserId, targetTownName);
    if (!targetTown) return interaction.editReply({ content: '⚠️ Target settlement not found.' });

    // ── Offense score (buildings) ─────────────────────────────────────────────
    const atkTowns = await db.all('SELECT id FROM towns WHERE user_id = ?', interaction.user.id);
    let offScore = 0;
    for (const t of atkTowns) {
        const bldgs = await db.all(
            'SELECT type FROM buildings WHERE town_id = ? AND (ready_at IS NULL OR ready_at <= ?)',
            t.id, Date.now()
        );
        for (const b of bldgs) {
            const bt = b.type.toUpperCase();
            if (bt === 'BARRACKS') offScore += 1;
            if (bt === 'CASTLE')   offScore += 2;
        }
    }
    // Palace bonus
    const pCheck = await db.get(
        'SELECT 1 FROM buildings b JOIN towns t ON b.town_id = t.id WHERE t.user_id = ? AND UPPER(b.type) = ? AND (b.ready_at IS NULL OR b.ready_at <= ?)',
        interaction.user.id, 'PALACE', Date.now()
    );
    if (pCheck && attacker.nation) offScore += 3;

    // ── NEW: Character MEN bonus adds to scout roll ───────────────────────────
    const charBonuses = getCharBonuses(attacker);
    const menBonus    = charBonuses.scoutBonus;

    // ── Defense score ─────────────────────────────────────────────────────────
    let defScore = 0;
    const defBldgs = await db.all(
        'SELECT type FROM buildings WHERE town_id = ? AND (ready_at IS NULL OR ready_at <= ?)',
        targetTown.id, Date.now()
    );
    for (const b of defBldgs) {
        const bt = b.type.toUpperCase();
        if (bt === 'PALISADE')      defScore += 1;
        if (bt === 'BASIC_WALL')    defScore += 2;
        if (bt === 'ADVANCED_WALL') defScore += 3;
        if (bt === 'CASTLE')        defScore += 5;
    }

    const roll     = Math.floor(Math.random() * 20) + 1;
    const totalOff = roll + offScore + menBonus;
    const dc       = 10 + defScore;

    if (totalOff >= dc) {
        let bList = defBldgs
            .map(b => `- ${BUILDINGS[b.type.toUpperCase()]?.name || b.type}`)
            .join('\n') || '*No completed structures.*';

        // Tiered reveal: full details only on roll ≥ DC + 5; partial otherwise
        const margin = totalOff - dc;
        let revealLevel;
        let revealNote = '';
        if (margin >= 5) {
            revealLevel = 'full';
        } else {
            revealLevel = 'partial';
            revealNote  = '\n*Partial intel — roll higher for full building details.*';
            bList       = `${defBldgs.length} structure(s) detected (names hidden)${revealNote}`;
        }

        const menNote = menBonus > 0 ? ` + ${menBonus}(MEN)` : '';
        const embed = new EmbedBuilder()
            .setTitle('🕵️ SCOUT REPORT: ' + targetTown.name)
            .setColor(revealLevel === 'full' ? 0x00FF88 : 0x88DD00)
            .setDescription([
                `**${revealLevel === 'full' ? 'Full Intel Acquired' : 'Partial Intel Acquired'}**`,
                `Roll: ${roll} + ${offScore}(Offense)${menNote} = **${totalOff}** vs DC **${dc}** (margin: +${margin})`,
                ``,
                `**Terrain:** ${TERRAINS[targetTown.terrain_type]?.name || 'Unknown'}`,
                `**Plots:** ${targetTown.plots_total}`,
                `**Fertility:** ${targetTown.fertility}%`,
                ``,
                `**Structures:**`,
                bList,
            ].join('\n'));
        return interaction.editReply({ embeds: [embed] });
    } else {
        const menNote = menBonus > 0 ? ` + ${menBonus}(MEN)` : '';
        const embed = new EmbedBuilder()
            .setTitle('💀 SPIES CAPTURED')
            .setColor(0xFF0000)
            .setDescription([
                `Your spies were intercepted at **${targetTown.name}**.`,
                `Roll: ${roll} + ${offScore}(Offense)${menNote} = **${totalOff}** vs DC **${dc}**`,
                ``,
                `Build more military structures (Barracks, Castles) to improve your Offense Score.`,
                menBonus === 0 ? `A higher MEN stat also improves spy operations.` : ``,
            ].filter(Boolean).join('\n'));
        return interaction.editReply({ embeds: [embed] });
    }
}

// ─── Recruit ──────────────────────────────────────────────────────────────────

async function handleRecruit(interaction) {
    const db     = interaction.client.db;
    const type   = interaction.options.getString('type').toUpperCase();
    const amount = interaction.options.getInteger('amount');
    const userId = interaction.user.id;
    const user   = await db.get('SELECT * FROM users WHERE id = ?', userId);

    // Mercenary: flat 500:coin: cost, no building requirement, expires weekly
    if (type === 'MERCENARY') {
        const cost = amount * 500;
        if ((user.balance || 0) < cost) return interaction.editReply({ content: `⚠️ Insufficient Balance. Need **${cost} :coin:** to hire **${amount}** mercenaries.` });
        await db.run('UPDATE users SET balance=balance-?, mercs_temp=COALESCE(mercs_temp,0)+? WHERE id=?', cost, amount, userId);
        return interaction.editReply({ content: `🗡️ Hired **${amount} mercenaries** for **${cost} :coin:**.\n\n*${MERC_DESC}*` });
    }

    const def = ARMY_TYPES[type];
    if (!def) return interaction.editReply({ content: '⚠️ Unknown unit type.' });

    // Building requirement check
    if (def.requires) {
        const check = await db.get(
            'SELECT 1 FROM buildings b JOIN towns t ON b.town_id=t.id WHERE t.user_id=? AND UPPER(b.type)=? AND (b.ready_at IS NULL OR b.ready_at<=?)',
            userId, def.requires, Date.now()
        );
        if (!check) return interaction.editReply({ content: `⚠️ You need a **${def.requires}** to recruit ${def.name}.` });
    }

    // Metallurgy cost check
    const metCost = def.cost_met * amount;
    if (metCost > 0 && (user.metallurgy || 0) < metCost)
        return interaction.editReply({ content: `⚠️ Insufficient Metallurgy. Need **${metCost} 🔩** for ${amount} ${def.name}.` });

    // Balance cost
    const balCost = def.cost_balance * amount;
    if ((user.balance || 0) < balCost)
        return interaction.editReply({ content: `⚠️ Insufficient Balance. Need **${balCost} :coin:** to recruit **${amount}** ${def.name}.` });

    // Population check (max 10% of commoners)
    const maxRecruits = Math.floor((user.pop_commoners || 0) * 0.10);
    if (amount > maxRecruits)
        return interaction.editReply({ content: `⚠️ Max recruitable: **${maxRecruits}** (10% of commoners). You tried to recruit **${amount}**.` });

    // The Fathers relation bonus: +50% mil cap
    const fathers = await db.get('SELECT score FROM relations WHERE user_id=? AND faction_name=?', userId, 'The Fathers');
    if (fathers?.score >= 10 && amount <= Math.floor(maxRecruits * 1.5)) {
        // cap bonus applies — no extra validation needed beyond recruit limit check above
    }

    // Determine which column
    const colMap = { INFANTRY: 'mil_infantry', CAVALRY: 'mil_cavalry', RANGED: 'mil_ranged', SIEGE: 'mil_siege' };
    const col = colMap[type];

    // Compute new maintenance
    const updated = { ...user, [col]: (user[col] || 0) + amount };
    const newMaint = calcMaintenance(updated);

    await db.run(
        `UPDATE users SET balance=balance-?, metallurgy=COALESCE(metallurgy,0)-?, ${col}=COALESCE(${col},0)+?, pop_commoners=pop_commoners-?, mil_strength=COALESCE(mil_strength,0)+?, mil_maintenance_cost=? WHERE id=?`,
        balCost, metCost, amount, amount, amount, newMaint, userId
    );

    const strMod = Math.max(0, getMod(user.attr_str || 10));
    const discount = Math.min(0.30, strMod * 0.01);
    const dailyUpkeep = Math.floor(def.food_per_unit * amount * (1 - discount));

    return interaction.editReply({ content: `⚔️ Recruited **${amount} ${def.name}** for **${balCost} :coin:**${metCost > 0 ? ` + **${metCost} 🔩**` : ''}.\nDaily food upkeep: **${dailyUpkeep} 🥩**${discount > 0 ? ` *(STR discount applied)*` : ''}.` });
}

// ─── Nation founding ──────────────────────────────────────────────────────────

async function handleNationFound(interaction) {
    const db   = interaction.client.db;
    const name = interaction.options.getString('name').trim();
    const user = await db.get('SELECT wealth, nation FROM users WHERE id = ?', interaction.user.id);

    if (user.nation) return interaction.editReply({ content: '⚠️ You are already the sovereign of a nation.' });
    if ((user.wealth || 0) < 100000) return interaction.editReply({ content: '⚠️ Founding a nation requires **100,000 ⚖️**. Use `/atlas donate` to convert Balance → Wealth.' });

    const check = await db.get('SELECT id FROM users WHERE LOWER(nation) = ?', name.toLowerCase());
    if (check) return interaction.editReply({ content: '⚠️ A nation with that name already exists.' });

    await db.run('UPDATE users SET wealth = wealth - 100000, nation = ? WHERE id = ?', name, interaction.user.id);

    const embed = new EmbedBuilder().setTitle('👑 NATION FOUNDED').setColor(0xFFD700)
        .setDescription(`The sovereign nation of **${name}** has been established.\nYou may now access Imperial protocols and the Vitale market.`);
    return interaction.editReply({ embeds: [embed] });
}

// ─── Dice Oracle ──────────────────────────────────────────────────────────────

async function renderRollGUI(interaction, userId) {
    const uid = userId || interaction.user.id;
    const embed = new EmbedBuilder().setTitle('🎲 DICE ORACLE').setColor(0xFFD700)
        .setDescription('**Select an attribute** for a check (1d20 + modifier) or choose a **raw die**.');

    const statMenu = new StringSelectMenuBuilder()
        .setCustomId(`roll_stat_${uid}`)
        .setPlaceholder('Choose an Attribute Check...')
        .addOptions(Object.entries(STAT_MAPPING).map(([k, v]) => ({ label: v.name, value: k, emoji: EMOJIS[k] || '🎲' })));

    const dieMenu = new StringSelectMenuBuilder()
        .setCustomId(`roll_raw_${uid}`)
        .setPlaceholder('Choose a Raw Die (d4 – d100)...')
        .addOptions(['4', '6', '8', '10', '12', '20', '100'].map(d => ({ label: `d${d}`, value: d, emoji: '🎲' })));

    return interaction.editReply({ embeds: [embed], components: [
        new ActionRowBuilder().addComponents(statMenu),
        new ActionRowBuilder().addComponents(dieMenu),
    ]});
}

async function handleUserRoll(interaction) {
    return await renderRollGUI(interaction, interaction.user.id);
}

async function handleSelect(interaction, action, args) {
    const db  = interaction.client.db;
    const sub = args[0];

    if (action === 'roll') {
        if (sub === 'stat') {
            // customId: roll_stat_{uid} → args=['stat', uid]
            const uid = args[1] || interaction.user.id;
            if (uid !== interaction.user.id) {
                return interaction.reply({ content: '⚠️ Only the player who opened this Oracle may use it.', ephemeral: true });
            }
            const statKey  = interaction.values[0];
            const statData = STAT_MAPPING[statKey];
            await interaction.deferUpdate();

            const embed = new EmbedBuilder().setTitle(`🎲 ${statData.name.toUpperCase()}`).setColor(0xFFD700)
                .setDescription(`Select a sub-skill under **${statData.name}**, or roll a general check.`);

            const subMenu = new StringSelectMenuBuilder()
                .setCustomId(`roll_substat_${statKey}_${uid}`)
                .setPlaceholder(`Select ${statData.name} skill...`)
                .addOptions([
                    { label: `General ${statData.name} Check`, value: 'none', emoji: '🎲' },
                    ...statData.sub.map(s => ({ label: s, value: s, emoji: '✨' }))
                ]);

            return interaction.editReply({ embeds: [embed], components: [
                new ActionRowBuilder().addComponents(subMenu),
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`roll_back_${uid}`).setLabel('Back').setStyle(ButtonStyle.Secondary)
                )
            ]});
        }

        if (sub === 'substat') {
            // customId: roll_substat_{statKey}_{uid} → args=['substat', statKey, uid]
            const statKey  = args[1];
            const uid      = args[2];
            if (uid && interaction.user.id !== uid) {
                return interaction.reply({ content: '⚠️ Only the player who opened this Oracle may use it.', ephemeral: true });
            }
            const subSkill = interaction.values[0];
            const user     = await db.get('SELECT * FROM users WHERE id = ?', interaction.user.id);
            const dbKey    = STAT_KEYS[statKey] || `attr_${statKey}`;
            const val      = user[dbKey] || 10;
            const mod      = getMod(val);
            const roll     = Math.floor(Math.random() * 20) + 1;
            const total    = roll + mod;

            await interaction.deferUpdate();
            const label = subSkill === 'none'
                ? STAT_MAPPING[statKey].name
                : `${STAT_MAPPING[statKey].name} · ${subSkill}`;

            await interaction.followUp({
                ephemeral: false,
                content: `🎲 **${interaction.user.displayName}** rolled **${label}** — 1d20 (**${roll}**) ${fmtMod(mod)} = **${total}**`
            });

            return interaction.editReply({ embeds: [
                new EmbedBuilder().setTitle('🎲 DICE ORACLE').setColor(0x00FF88)
                    .setDescription(`Result posted! Click Roll Again to continue.`)
            ], components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`roll_back_${uid || interaction.user.id}`).setLabel('Roll Again').setStyle(ButtonStyle.Primary)
                )
            ]});
        }

        if (sub === 'raw') {
            // customId: roll_raw_{uid} → args=['raw', uid]
            const uid = args[1];
            if (uid && interaction.user.id !== uid) {
                return interaction.reply({ content: '⚠️ Only the player who opened this Oracle may use it.', ephemeral: true });
            }
            const sides = parseInt(interaction.values[0]);
            const roll  = Math.floor(Math.random() * sides) + 1;
            await interaction.deferUpdate();

            await interaction.followUp({
                ephemeral: false,
                content: `🎲 **${interaction.user.displayName}** rolled **d${sides}** — **${roll}**`
            });

            return interaction.editReply({ embeds: [
                new EmbedBuilder().setTitle('🎲 DICE ORACLE').setColor(0x00FF88)
                    .setDescription(`d${sides} result posted! Click Roll Again to continue.`)
            ], components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`roll_back_${uid || interaction.user.id}`).setLabel('Roll Again').setStyle(ButtonStyle.Primary)
                )
            ]});
        }
    }
}

async function handleGMRoll(interaction) {
    const db = interaction.client.db;
    if (!(await isGM(db, interaction.user.id)) && !isOwner(interaction.user.id)) {
        return interaction.editReply({ content: '⚠️ Oracle protocols restricted to Game Masters.' });
    }

    const targetId = interaction.options.getString('user');
    const stat     = interaction.options.getString('stat');
    const substat  = interaction.options.getString('substat');
    const dc       = interaction.options.getInteger('dc');
    const type     = interaction.options.getString('type') || '20';

    const target = await db.get('SELECT * FROM users WHERE id = ?', targetId);
    if (!target) return interaction.editReply({ content: '⚠️ Target lineage not found.' });

    const sides = parseInt(type);
    const dbKey = STAT_KEYS[stat] || `attr_${stat}`;
    const val   = target[dbKey] || 10;
    const mod   = getMod(val);
    const roll  = Math.floor(Math.random() * sides) + 1;
    const total = roll + mod;

    const success = total >= dc;
    const label   = substat ? `${stat.toUpperCase()} (${substat})` : stat.toUpperCase();
    const embed   = new EmbedBuilder()
        .setTitle(`👁️ ORACLE CHECK: ${label}`)
        .setColor(success ? 0x00FF88 : 0xFF0000)
        .setDescription([
            `Target: <@${targetId}>`,
            `DC: **${dc}**`,
            ``,
            `Roll: 1d${sides} (${roll}) ${fmtMod(mod)} = **${total}**`,
            ``,
            `**Result: ${success ? 'SUCCESS ✅' : 'FAILURE ❌'}**`,
        ].join('\n'));

    return interaction.editReply({ content: `<@${targetId}>`, embeds: [embed] });
}

async function handleButton(interaction, action, args) {
    const db = interaction.client.db;

    if (action === 'roll' && args[0] === 'back') {
        const uid = args[1] || interaction.user.id;
        if (uid !== interaction.user.id) {
            return interaction.reply({ content: '⚠️ Only the player who opened this Oracle may use it.', ephemeral: true });
        }
        await interaction.deferUpdate();
        return await renderRollGUI(interaction, uid);
    }

    if (action === 'rebellion' && args[0] === 'suppress') {
        await interaction.deferUpdate();
        const user = await db.get('SELECT * FROM users WHERE id=?', interaction.user.id);
        const result = await warfare.handleRebellionEvent(db, user);
        if (result?.type === 'servus') {
            const msg = result.result === 'suppressed'
                ? '⚔️ **SERVUS REBELLION SUPPRESSED** — Your forces crushed the uprising. −1 Stability, −5 Servus.'
                : '🔗 **SERVUS REBELLION OVERWHELMS YOU** — The laborers broke free. −5 Stability, −2000 Wealth, all Servus lost.';
            return interaction.editReply({ content: msg, embeds: [], components: [] });
        }
        return interaction.editReply({ content: 'No active rebellion detected.', embeds: [], components: [] });
    }

    if (action === 'revolt' && args[0] === 'suppress') {
        await interaction.deferUpdate();
        const user = await db.get('SELECT * FROM users WHERE id=?', interaction.user.id);
        const result = await warfare.handleRebellionEvent(db, user);
        if (result?.type === 'noble') {
            const msg = result.result === 'suppressed'
                ? '📜 **NOBLE REVOLT SUPPRESSED** — Your loyalists held the line. −1 Prestige.'
                : '⚠️ **NOBLE REVOLT SUCCEEDS** — You have been **DEPOSED**. The High Command must intervene.';
            return interaction.editReply({ content: msg, embeds: [], components: [] });
        }
        return interaction.editReply({ content: 'No active revolt detected.', embeds: [], components: [] });
    }
}

module.exports = {
    handleScout, handleRecruit, handleNationFound,
    handleUserRoll, handleGMRoll, handleButton, handleSelect
};
