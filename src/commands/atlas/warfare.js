const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { ANCESTRIES, BUILDINGS, STAT_MAPPING, STAT_KEYS, TERRAINS } = require('../../data/constants');
const { getMod, getPlayerRank, resolveAtlasHQ, getNotificationChannel, isGM, calcMaintenance } = require('../../utils/helpers');
const { generateBattleName, classifyBattle } = require('./battlename');

const TERRAIN_DEF      = { MOUNTAIN:15, FOREST:8, HILLS:5, RIVERLANDS:3, PLAINS:0, COASTAL:-2, SWAMP:6 };
const POLYSIA_KEYS     = ['POLYSIA-ESTUARIN', 'POLYSIA-RIPARIAN'];
const STYX_HOUSES      = ['TYRANNITE', 'RHAGAIA', 'SELLESELA', 'GAIUS', 'CAOSSA'];
const POLYSIA_CAV_BONUS = 10;
const STYX_FORT_BONUS   = 8;

const TERRAIN_COMBAT_MODS = {
    FOREST:     { cav: -0.4, rng: +0.2 },
    HILLS:      { rng: +0.3, inf: +0.1 },
    RIVERLANDS: { cav: -0.5, inf: -0.1 },
    SWAMP:      { cav: -0.6, sie: -0.4 },
    PLAINS:     { cav: +0.2 },
};

function encodeName(name) { return (name || '').replace(/ /g, '-'); }
function decodeName(encoded) { return (encoded || '').replace(/-/g, ' '); }

function calcMorale(user) {
    const base = 100
        + (user.rate_stab  || 0) * 3
        + (user.rate_prest || 0) * 2
        - Math.max(0, -(user.food_surplus || 0)) * 5
        - Math.floor((user.servus || 0) / 5) * 2;
    return Math.max(30, Math.min(150, base));
}

function calcArmyPower(user, context, terrainType) {
    const inf = (user.mil_infantry || 0) + (user.mercs_temp || 0);
    const cav = user.mil_cavalry || 0;
    const rng = user.mil_ranged  || 0;
    const sig = user.mil_siege   || 0;

    const tMods = (context === 'field' && terrainType)
        ? (TERRAIN_COMBAT_MODS[terrainType.toUpperCase()] || {}) : {};

    let raw = 0;
    if (context === 'field') {
        raw = inf * (1.0 + (tMods.inf || 0))
            + cav * (1.5 + (tMods.cav || 0))
            + rng * (1.0 + (tMods.rng || 0))
            + sig * (0.0 + (tMods.sie || 0));
    } else if (context === 'siege_atk') {
        raw = inf * 1.0 + cav * 0.8 + rng * 1.0 + sig * 2.0;
    } else if (context === 'siege_def') {
        raw = inf * 1.0 + cav * 0.8 + rng * 1.2 + sig * 0.5;
    }
    return Math.floor(raw * (calcMorale(user) / 100));
}

function compCounterBonus(atk, def) {
    if ((atk.mil_cavalry || 0) > 0 && (def.mil_ranged || 0) > (def.mil_infantry || 0)) return 5;
    if ((atk.mil_ranged  || 0) > 0 && (def.mil_infantry || 0) > (def.mil_cavalry || 0)) return 3;
    return 0;
}

async function calcOffenseScore(db, userId) {
    const towns = await db.all('SELECT id FROM towns WHERE user_id=?', userId);
    let score = 0;
    for (const t of towns) {
        const bldgs = await db.all('SELECT type FROM buildings WHERE town_id=? AND (ready_at IS NULL OR ready_at<=?)', t.id, Date.now());
        for (const b of bldgs) {
            const bt = b.type.toUpperCase();
            if (bt === 'BARRACKS') score += 1;
            if (bt === 'CASTLE')   score += 2;
            if (bt === 'PALACE')   score += 3;
        }
    }
    return score;
}

async function calcDefenseScore(db, townId) {
    const bldgs = await db.all('SELECT type FROM buildings WHERE town_id=? AND (ready_at IS NULL OR ready_at<=?)', townId, Date.now());
    let score = 0;
    for (const b of bldgs) {
        const bt = b.type.toUpperCase();
        if (bt === 'PALISADE')      score += 1;
        if (bt === 'BASIC_WALL')    score += 2;
        if (bt === 'ADVANCED_WALL') score += 3;
        if (bt === 'CASTLE')        score += 5;
    }
    return score;
}

async function getAgBonus(db, userId, user) {
    const ag = await db.get('SELECT score FROM relations WHERE user_id=? AND faction_name=?', userId, 'Atomic Guild');
    if (ag?.score >= 15) return Math.max(0, getMod(user.attr_int || 10), getMod(user.attr_wis || 10));
    return 0;
}

function fieldFoodCost(user) {
    const total = (user.mil_infantry || 0) + (user.mil_cavalry || 0) + (user.mil_ranged || 0) + (user.mercs_temp || 0);
    return total * 2;
}
function siegeFoodCostAtk(user) {
    const total = (user.mil_infantry || 0) + (user.mil_cavalry || 0) + (user.mil_ranged || 0) + (user.mil_siege || 0) + (user.mercs_temp || 0);
    return total * 5;
}
function siegeFoodCostDef(user) {
    const total = (user.mil_infantry || 0) + (user.mil_cavalry || 0) + (user.mil_ranged || 0) + (user.mil_siege || 0);
    return total * 2;
}

// ─── BATTLE INITIATION ──────────────────────────────────────────────────────────

async function handleBattleInitiate(interaction) {
    const db = interaction.client.db;
    const targetId = interaction.options.getString('user');
    if (targetId === interaction.user.id) return interaction.editReply({ content: '⚠️ Cannot attack yourself.' });

    const atk = await db.get('SELECT * FROM users WHERE id=?', interaction.user.id);
    const def = await db.get('SELECT * FROM users WHERE id=?', targetId);
    if (!def) return interaction.editReply({ content: '⚠️ Target not found.' });

    const rank = getPlayerRank(atk);
    if (rank === 'SCION') return interaction.editReply({ content: '⚠️ Scions cannot declare battle.' });

    const atkHouse = ANCESTRIES[(atk.ancestry || '').toUpperCase()]?.house;
    const defHouse = ANCESTRIES[(def.ancestry || '').toUpperCase()]?.house;
    if (atkHouse && defHouse && atkHouse === defHouse && atkHouse !== 'INDEPENDENT' && atkHouse !== 'REMOVED')
        return interaction.editReply({ content: '⚠️ You cannot attack a member of the same Great House.' });

    // Show composition modal
    const modal = new ModalBuilder()
        .setCustomId(`warcomp_${atk.id}_${def.id}`)
        .setTitle('⚔️ Commit Forces');

    const fields = [
        { id: 'inf', label: 'Infantry', max: atk.mil_infantry || 0 },
        { id: 'cav', label: 'Cavalry', max: atk.mil_cavalry || 0 },
        { id: 'rng', label: 'Ranged', max: atk.mil_ranged || 0 },
        { id: 'sie', label: 'Siege', max: atk.mil_siege || 0 },
        { id: 'mercs', label: 'Mercenaries', max: atk.mercs_temp || 0 },
    ];

    for (const f of fields) {
        modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId(f.id)
                .setLabel(`${f.label} (max ${f.max})`)
                .setStyle(TextInputStyle.Short)
                .setRequired(false)
                .setValue('0')
                .setPlaceholder(`0-${f.max}`)
        ));
    }

    return await interaction.showModal(modal);
}

function fieldFoodCostFor(counts) {
    return ((counts.inf || 0) + (counts.cav || 0) + (counts.rng || 0) + (counts.mercs || 0)) * 2;
}

async function handleBattleCompositionSubmit(interaction, atkId, defId) {
    const db = interaction.client.db;
    const atk = await db.get('SELECT * FROM users WHERE id=?', atkId);
    const def = await db.get('SELECT * FROM users WHERE id=?', defId);
    if (!atk || !def) return interaction.reply({ content: '⚠️ Data not found.', ephemeral: true });

    const fields = ['inf', 'cav', 'rng', 'sie', 'mercs'];
    const colMap = { inf: 'mil_infantry', cav: 'mil_cavalry', rng: 'mil_ranged', sie: 'mil_siege', mercs: 'mercs_temp' };
    const counts = {};
    for (const f of fields) {
        const val = parseInt(interaction.fields.getTextInputValue(f)) || 0;
        if (val < 0) return interaction.reply({ content: '⚠️ Values must be 0 or positive.', ephemeral: true });
        const max = atk[colMap[f]] || 0;
        if (val > max) return interaction.reply({ content: `⚠️ Cannot commit more ${f} than you own (max ${max}).`, ephemeral: true });
        counts[f] = val;
    }

    const foodCost = fieldFoodCostFor(counts);
    if ((atk.food_surplus || 0) < foodCost)
        return interaction.reply({ content: `⚠️ Insufficient supplies. Need **${foodCost} 🥩**.`, ephemeral: true });

    await db.run('UPDATE users SET food_surplus=food_surplus-? WHERE id=?', foodCost, atk.id);

    const terrainKeys = Object.keys(TERRAINS);
    const terrainKey = terrainKeys[Math.floor(Math.random() * terrainKeys.length)];
    const terrain = TERRAINS[terrainKey];
    const compStr = `${counts.inf}_${counts.cav}_${counts.rng}_${counts.sie}_${counts.mercs}_${terrainKey}`;
    const emb = new EmbedBuilder()
        .setTitle('⚔️ BATTLE REQUEST')
        .setColor(0xFF4400)
        .setImage(terrain?.img || null)
        .setDescription([
            `**Attacker:** <@${atk.id}> ${atk.ruler_name ? `— ${atk.ruler_name}` : ''}${atk.nation ? ` of ${atk.nation}` : ''}`,
            `**Target:** <@${def.id}> ${def.ruler_name ? `— ${def.ruler_name}` : ''}${def.nation ? ` of ${def.nation}` : ''}`,
            '',
            `🌍 **Terrain:** ${terrain?.name || terrainKey}`,
            '',
            `⚔️ Inf: ${counts.inf} | 🐎 Cav: ${counts.cav} | 🏹 Rng: ${counts.rng} | 🪨 Sie: ${counts.sie} | 🗡️ Mercs: ${counts.mercs}`,
            `🔥 Morale: ${calcMorale(atk)} | 🥩 Food: ${foodCost}`,
        ].join('\n'));

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`warapprove_battle_${atk.id}_${def.id}_${compStr}`).setLabel('✅ Approve Battle').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`warreject_battle_${atk.id}_${def.id}`).setLabel('❌ Reject').setStyle(ButtonStyle.Danger)
    );
    await resolveAtlasHQ(interaction.client, emb, [row]);
    return interaction.reply({ content: `⚔️ Battle request submitted. **${foodCost} 🥩** supply spent. Awaiting GM approval.`, ephemeral: true });
}

// ─── BATTLE APPROVE (GM) ───────────────────────────────────────────────────────

async function handleBattleApprove(interaction, atkId, defId, compArgs, battleName) {
    const db = interaction.client.db;
    if (!await isGM(db, interaction.user.id)) return interaction.reply({ content: 'Access Denied.', ephemeral: true });

    const atk = await db.get('SELECT * FROM users WHERE id=?', atkId);
    const def = await db.get('SELECT * FROM users WHERE id=?', defId);
    if (!atk || !def) return interaction.reply({ content: '⚠️ One or both players not found.', ephemeral: true });

    // Parse attacker composition
    const compParts = compArgs ? compArgs : [`${atk.mil_infantry || 0}`, `${atk.mil_cavalry || 0}`, `${atk.mil_ranged || 0}`, `${atk.mil_siege || 0}`, `${atk.mercs_temp || 0}`, 'PLAINS'];
    const atkComp = compParts.slice(0, 5).join('_');
    const terrainKey = compParts[5] || 'PLAINS';
    const terrain = TERRAINS[terrainKey.toUpperCase()] || TERRAINS['PLAINS'];

    await interaction.update({ components: [], content: `⚔️ Battle approved. Awaiting <@${defId}> to commit forces...` });

    // Lock defender: only battle-response commands allowed
    await db.run('UPDATE users SET pending_battle=? WHERE id=?', `${atkId}|${atkComp}_${terrainKey}|${encodeName(displayName)}`, defId);

    // Send defender a "Commit Forces" button
    const displayName = battleName || 'Battle';

    const chan = await getNotificationChannel(interaction.client, def);
    if (chan) {
        const emb = new EmbedBuilder()
            .setTitle(`⚔️ ${displayName}`)
            .setColor(0xFF0000)
            .setImage(terrain?.img || null)
            .setDescription([
                `<@${atkId}> ${atk.ruler_name ? `(${atk.ruler_name})` : ''}${atk.nation ? ` of **${atk.nation}**` : ''} is marching against you!`,
                `🌍 Terrain: **${terrain?.name || terrainKey}**`,
                '',
                `Choose which forces to commit to this battle.`,
                `You have: ⚔️ Inf: ${def.mil_infantry || 0} | 🐎 Cav: ${def.mil_cavalry || 0} | 🏹 Rng: ${def.mil_ranged || 0} | 🪨 Sie: ${def.mil_siege || 0} | 🗡️ Mercs: ${def.mercs_temp || 0}`,
            ].join('\n'));
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`wardefcommit_${atkId}_${defId}_${atkComp}`).setLabel('⚔️ Commit Forces').setStyle(ButtonStyle.Danger)
        );
        try { await chan.send({ content: `<@${defId}>`, embeds: [emb], components: [row] }); } catch (_) {}
    }

    // Also send via DM as fallback
    try {
        const u = await interaction.client.users.fetch(defId);
        if (u && !chan) {
            const emb = new EmbedBuilder().setTitle('⚔️ YOU ARE UNDER ATTACK').setColor(0xFF0000)
                .setDescription(`<@${atkId}> is marching against you! Click below to commit your forces.`);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`wardefcommit_${atkId}_${defId}_${atkComp}`).setLabel('⚔️ Commit Forces').setStyle(ButtonStyle.Danger)
            );
            await u.send({ embeds: [emb], components: [row] });
        }
    } catch (_) {}
}

// Defender clicks "Commit Forces" → show composition modal
async function handleDefenderCommit(interaction, atkId, defId, atkComp) {
    const db = interaction.client.db;
    const def = await db.get('SELECT * FROM users WHERE id=?', defId);
    const atk = await db.get('SELECT * FROM users WHERE id=?', atkId);
    if (!def) return interaction.reply({ content: '⚠️ Data not found.', ephemeral: true });
    if (interaction.user.id !== defId) return interaction.reply({ content: '⚠️ Only the defender may commit forces to this battle.', ephemeral: true });

    const atkCompArr = atkComp.split('_');
    const terrainKey = atkCompArr[5] || 'PLAINS';
    const terrain = TERRAINS[terrainKey.toUpperCase()] || TERRAINS['PLAINS'];

    // Retrieve battle name from pending_battle
    let battleName = 'Battle';
    if (def.pending_battle) {
        const parts = def.pending_battle.split('|');
        if (parts.length >= 3) battleName = decodeName(parts[2]);
    }

    const modal = new ModalBuilder()
        .setCustomId(`wardefmodal_${atkId}_${defId}_${atkComp}`)
        .setTitle(battleName.length > 35 ? battleName.substring(0, 32) + '...' : battleName);

    const fields = [
        { id: 'inf', label: 'Infantry', max: def.mil_infantry || 0 },
        { id: 'cav', label: 'Cavalry', max: def.mil_cavalry || 0 },
        { id: 'rng', label: 'Ranged', max: def.mil_ranged || 0 },
        { id: 'sie', label: 'Siege', max: def.mil_siege || 0 },
        { id: 'mercs', label: 'Mercenaries', max: def.mercs_temp || 0 },
    ];
    for (const f of fields) {
        modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId(f.id).setLabel(`${f.label} (max ${f.max})`)
                .setStyle(TextInputStyle.Short).setRequired(false)
                .setValue('0').setPlaceholder(`0-${f.max}`)
        ));
    }
    return await interaction.showModal(modal);
}

// Defender submits their composition → battle resolves
async function handleBattleResolve(interaction, atkId, defId, atkCompStr) {
    const db = interaction.client.db;
    const atkComp = atkCompStr.split('_').map(Number);

    const atk = await db.get('SELECT * FROM users WHERE id=?', atkId);
    const def = await db.get('SELECT * FROM users WHERE id=?', defId);
    if (!atk || !def) return interaction.reply({ content: '⚠️ Data not found.', ephemeral: true });

    // Retrieve battle name from defender's pending_battle
    let battleName = 'Battle';
    if (def.pending_battle) {
        const parts = def.pending_battle.split('|');
        if (parts.length >= 3) battleName = decodeName(parts[2]);
    }

    // Parse defender composition from modal
    const terrainKey = atkCompStr.split('_')[5] || 'PLAINS';
    const colMap = ['inf', 'cav', 'rng', 'sie', 'mercs'];
    const defCols = { inf: 'mil_infantry', cav: 'mil_cavalry', rng: 'mil_ranged', sie: 'mil_siege', mercs: 'mercs_temp' };
    const defComp = {};
    let defTotal = 0;
    for (const f of colMap) {
        const val = parseInt(interaction.fields.getTextInputValue(f)) || 0;
        if (val < 0) return interaction.reply({ content: '⚠️ Values must be 0 or positive.', ephemeral: true });
        const max = def[defCols[f]] || 0;
        if (val > max) return interaction.reply({ content: `⚠️ Cannot commit more ${f} than you own (max ${max}).`, ephemeral: true });
        defComp[f] = val;
        if (f !== 'sie') defTotal += val;
    }

    // Deduct defender food for committed units
    const defFood = (defTotal) * 2;
    if ((def.food_surplus || 0) < defFood)
        return interaction.reply({ content: `⚠️ Insufficient food. Need **${defFood} 🥩**.`, ephemeral: true });
    await db.run('UPDATE users SET food_surplus=MAX(0,food_surplus-?) WHERE id=?', defFood, def.id);

    // Virtual objects for power calc
    const atkForPower = { ...atk, mil_infantry: atkComp[0], mil_cavalry: atkComp[1], mil_ranged: atkComp[2], mil_siege: atkComp[3], mercs_temp: atkComp[4] };
    const defForPower = { ...def, mil_infantry: defComp.inf, mil_cavalry: defComp.cav, mil_ranged: defComp.rng, mil_siege: defComp.sie, mercs_temp: defComp.mercs };

    // Rolls
    const atkRoll = Math.floor(Math.random() * 20) + 1;
    const defRoll = Math.floor(Math.random() * 20) + 1;
    const agBonusAtk = await getAgBonus(db, atkId, atk);
    const agBonusDef = await getAgBonus(db, defId, def);

    const atkOff  = await calcOffenseScore(db, atkId);
    const menMod  = getMod(atk.attr_men || 10);
    const hasCav  = POLYSIA_KEYS.includes((atk.ancestry || '').toUpperCase()) && (atkForPower.mil_cavalry || 0) > 0;
    const polyB   = hasCav ? POLYSIA_CAV_BONUS : 0;
    const counter = compCounterBonus(atkForPower, defForPower);

    const atkPower = calcArmyPower(atkForPower, 'field', terrainKey) + atkOff * 5 + menMod * 2 + polyB + counter + atkRoll + agBonusAtk;
    const defPower = calcArmyPower(defForPower, 'field', terrainKey) * 1.2 + (await calcOffenseScore(db, defId)) * 5 + defRoll + agBonusDef;

    const winnerId = atkPower > defPower ? atkId : defId;
    const loserId  = winnerId === atkId ? defId : atkId;
    const winner   = winnerId === atkId ? atk : def;
    const loser    = winnerId === atkId ? def : atk;
    const isAtkWin = winnerId === atkId;

    // Casualties with committed counts
    const lossFactor = 0.70 + Math.random() * 0.15;

    // Attacker casualties from committed units
    const atkInfSurvive = Math.max(0, Math.floor(atkComp[0] * lossFactor));
    const atkCavSurvive = Math.max(0, Math.floor(atkComp[1] * lossFactor));
    const atkRngSurvive = Math.max(0, Math.floor(atkComp[2] * lossFactor));
    const atkSieSurvive = Math.max(0, Math.floor(atkComp[3] * lossFactor));
    const atkMercsSurvive = Math.max(0, Math.floor(atkComp[4] * lossFactor));

    // Defender casualties from committed units
    const defInfSurvive = Math.max(0, Math.floor(defComp.inf * lossFactor));
    const defCavSurvive = Math.max(0, Math.floor(defComp.cav * lossFactor));
    const defRngSurvive = Math.max(0, Math.floor(defComp.rng * lossFactor));

    // Apply casualties to DB (subtract losses from actual counts)
    const atkInfLost = Math.max(0, atkComp[0] - atkInfSurvive);
    const atkCavLost = Math.max(0, atkComp[1] - atkCavSurvive);
    const atkRngLost = Math.max(0, atkComp[2] - atkRngSurvive);
    const atkSieLost = Math.max(0, atkComp[3] - atkSieSurvive);
    const atkMercsLost = Math.max(0, atkComp[4] - atkMercsSurvive);

    const defInfLost = Math.max(0, defComp.inf - defInfSurvive);
    const defCavLost = Math.max(0, defComp.cav - defCavSurvive);
    const defRngLost = Math.max(0, defComp.rng - defRngSurvive);

    await db.run('UPDATE users SET mil_infantry=MAX(0,mil_infantry-?), mil_cavalry=MAX(0,mil_cavalry-?), mil_ranged=MAX(0,mil_ranged-?), mil_siege=MAX(0,mil_siege-?), mercs_temp=MAX(0,mercs_temp-?) WHERE id=?',
        atkInfLost, atkCavLost, atkRngLost, atkSieLost, atkMercsLost, atkId);
    await db.run('UPDATE users SET mil_infantry=MAX(0,mil_infantry-?), mil_cavalry=MAX(0,mil_cavalry-?), mil_ranged=MAX(0,mil_ranged-?) WHERE id=?',
        defInfLost, defCavLost, defRngLost, defId);

    // Update maintenance for both
    const atkRow = await db.get('SELECT * FROM users WHERE id=?', atkId);
    const defRow = await db.get('SELECT * FROM users WHERE id=?', defId);
    await db.run('UPDATE users SET mil_maintenance_cost=? WHERE id=?', calcMaintenance(atkRow), atkId);
    await db.run('UPDATE users SET mil_maintenance_cost=? WHERE id=?', calcMaintenance(defRow), defId);

    // Prestige/stability
    if (isAtkWin) {
        await db.run('UPDATE users SET rate_prest=MAX(-10,rate_prest-2), rate_stab=MAX(-10,rate_stab-1) WHERE id=?', defId);
        await db.run('UPDATE users SET rate_prest=MIN(10,rate_prest+1) WHERE id=?', atkId);
    } else {
        await db.run('UPDATE users SET rate_prest=MAX(-10,rate_prest-2), rate_stab=MAX(-10,rate_stab-1) WHERE id=?', atkId);
        await db.run('UPDATE users SET rate_prest=MIN(10,rate_prest+1) WHERE id=?', defId);
    }

    await db.run('INSERT INTO gm_events (user_id, gm_id, event_type, severity, effect_snapshot, created_at) VALUES (?,?,?,?,?,?)',
        winnerId, interaction.user?.id || 'system', 'field_battle', 1,
        JSON.stringify({ atk: atkId, def: defId, winner: winnerId, atkComp: atkCompStr, defComp: `${defComp.inf}_${defComp.cav}_${defComp.rng}_${defComp.sie}_${defComp.mercs}` }),
        Date.now());

    // Clear defender lock
    await db.run('UPDATE users SET pending_battle=NULL WHERE id=?', defId);

    // Detect if outnumbered (loser had <= half winner's power)
    const loserPower = isAtkWin ? defPower : atkPower;
    const winnerPower = isAtkWin ? atkPower : defPower;
    const isOutnumbered = loserPower > 0 && winnerPower / loserPower >= 2.0;

    // Notify defender that forces are committed
    await interaction.reply({ content: '⚔️ Forces committed! The battle is joined.', ephemeral: true });

    // Notify both players
    const terrain = TERRAINS[terrainKey.toUpperCase()] || TERRAINS['PLAINS'];

    for (const uid of [atkId, defId]) {
        const userObj = uid === atkId ? atk : def;
        const chan = await getNotificationChannel(interaction.client, userObj);
        const isWinner = uid === winnerId;
        const isAtk = uid === atkId;
        const lossText = isAtk
            ? `\n⚔️ Inf: ${atkInfLost} lost | 🐎 Cav: ${atkCavLost} lost | 🏹 Rng: ${atkRngLost} lost | 🪨 Sie: ${atkSieLost} lost | 🗡️ Mercs: ${atkMercsLost} lost`
            : `\n⚔️ Inf: ${defInfLost} lost | 🐎 Cav: ${defCavLost} lost | 🏹 Rng: ${defRngLost} lost`;

        const embTitle = isOutnumbered
            ? `The Desperate Stand at ${isWinner ? '🏆' : '💀'} ${battleName}`
            : `${isWinner ? '🏆' : '💀'} ${battleName}`;

        const emb = new EmbedBuilder()
            .setTitle(embTitle)
            .setColor(isWinner ? 0x00FF88 : 0xFF0000)
            .setImage(terrain.img || null)
            .setDescription([
                `**${isAtk ? (atk.ruler_name || 'Attacker') : (def.ruler_name || 'Defender')}** vs **${isAtk ? (def.ruler_name || 'Defender') : (atk.ruler_name || 'Attacker')}**`,
                `🌍 Terrain: ${terrain.name || terrainKey}`,
                '',
                `Atk roll: ${atkRoll} → Power: ${atkPower}`,
                `Def roll: ${defRoll} → Power: ${defPower}`,
                '',
                isWinner ? '+1 Prestige' : `-2 Prestige, -1 Stability${lossText}`,
            ].join('\n'));
        let sent = false;
        if (chan) { try { await chan.send({ content: `<@${uid}>`, embeds: [emb] }); sent = true; } catch (_) {} }
        if (!sent) { try { const u = await interaction.client.users.fetch(uid); if (u) await u.send({ embeds: [emb] }); } catch (_) {} }
    }

    // Substation pick for winner
    if (Math.random() < 0.20) {
        const chan = await getNotificationChannel(interaction.client, winner);
        if (chan) {
            const emb = new EmbedBuilder().setTitle('✨ MOMENT OF BRILLIANCE').setColor(0xFFD700)
                .setDescription('Choose a substat to improve (+1):');
            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`warbattle_ss_str_${winnerId}`).setLabel('💪 STR').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`warbattle_ss_mot_${winnerId}`).setLabel('🏃 MOT').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`warbattle_ss_men_${winnerId}`).setLabel('💀 MEN').setStyle(ButtonStyle.Primary)
            );
            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`warbattle_ss_int_${winnerId}`).setLabel('🧠 INT').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`warbattle_ss_wis_${winnerId}`).setLabel('🕯️ WIS').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`warbattle_ss_cha_${winnerId}`).setLabel('🎭 CHA').setStyle(ButtonStyle.Primary)
            );
            try { await chan.send({ content: `<@${winnerId}>`, embeds: [emb], components: [row1, row2] }); } catch (_) {}
        }
    }
}

async function handleBattleSubstat(interaction, statKey, winnerId) {
    const db = interaction.client.db;
    if (interaction.user.id !== winnerId) return interaction.reply({ content: '⚠️ Only the battle winner may choose.', ephemeral: true });
    const attrKey = STAT_KEYS[statKey] || `attr_${statKey}`;
    await db.run(`UPDATE users SET ${attrKey}=MIN(20,${attrKey}+1) WHERE id=?`, winnerId);
    await interaction.update({ components: [], content: interaction.message.content + `\n\n✨ ${STAT_MAPPING[statKey]?.name || statKey.toUpperCase()} improved!` });
}

// ─── SIEGE ──────────────────────────────────────────────────────────────────────

async function handleSiegeInitiate(interaction) {
    const db = interaction.client.db;
    const targetId  = interaction.options.getString('user');
    const townName  = interaction.options.getString('target_town');
    if (targetId === interaction.user.id) return interaction.editReply({ content: '⚠️ Cannot siege your own settlement.' });
    const rank = getPlayerRank(await db.get('SELECT * FROM users WHERE id=?', interaction.user.id));
    if (rank !== 'SOVEREIGN') return interaction.editReply({ content: '⚠️ Only Sovereigns may lay siege.' });

    const atk = await db.get('SELECT * FROM users WHERE id=?', interaction.user.id);
    const def = await db.get('SELECT * FROM users WHERE id=?', targetId);
    if (!def) return interaction.editReply({ content: '⚠️ Target not found.' });
    const town = await db.get('SELECT * FROM towns WHERE user_id=? AND name=?', targetId, townName);
    if (!town) return interaction.editReply({ content: '⚠️ Target town not found.' });

    const atkFood = siegeFoodCostAtk(atk);
    if ((atk.food_surplus || 0) < atkFood) return interaction.editReply({ content: `⚠️ Need **${atkFood} 🥩** to lay siege.` });
    await db.run('UPDATE users SET food_surplus=food_surplus-? WHERE id=?', atkFood, atk.id);

    const defFood = siegeFoodCostDef(def);
    const defSupplied = (def.food_surplus || 0) >= defFood;
    if (defSupplied) await db.run('UPDATE users SET food_surplus=food_surplus-? WHERE id=?', defFood, def.id);

    const siegeName = generateBattleName('SIEGE', {
        townName: town.name,
        attackerNation: atk.nation, defenderNation: def.nation,
        attackerRulerName: atk.ruler_name
    });

    const emb = new EmbedBuilder()
        .setTitle(`🏰 ${siegeName}`)
        .setColor(0xFF4400)
        .setDescription([
            `**Attacker:** <@${atk.id}> | **Target:** <@${def.id}> — **${town.name}**`,
            '',
            `⚔️ Inf: ${atk.mil_infantry || 0} | 🐎 Cav: ${atk.mil_cavalry || 0} | 🏹 Rng: ${atk.mil_ranged || 0} | 🪨 Sie: ${atk.mil_siege || 0}`,
            `Morale: ${calcMorale(atk)} | Food: ${atkFood} 🥩`,
            !defSupplied ? '⚠️ **DEFENDER UNDERSUPPLIED** — power halved.' : '',
        ].filter(Boolean).join('\n'));

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`warconfirm_s_${atk.id}_${def.id}_${town.id}`).setLabel('✅ Confirm Siege').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`warabort_s_${atk.id}`).setLabel('❌ Abort').setStyle(ButtonStyle.Danger)
    );
    await resolveAtlasHQ(interaction.client, emb, [row]);
    return interaction.editReply({ content: `🏰 Siege request submitted. **${atkFood} 🥩** supply spent. Awaiting GM approval.` });
}

async function handleSiegeConfirm(interaction, atkId, defId, townId) {
    const db = interaction.client.db;
    if (!await isGM(db, interaction.user.id)) return interaction.reply({ content: 'Access Denied.', ephemeral: true });

    const atk = await db.get('SELECT * FROM users WHERE id=?', atkId);
    const def = await db.get('SELECT * FROM users WHERE id=?', defId);
    const town = await db.get('SELECT * FROM towns WHERE id=?', townId);
    if (!atk || !def || !town) return interaction.reply({ content: '⚠️ Data not found.', ephemeral: true });

    const defSupplied = (def.food_surplus || 0) >= siegeFoodCostDef(def);
    const atkRoll = Math.floor(Math.random() * 20) + 1;
    const defRoll = Math.floor(Math.random() * 20) + 1;
    const agAtk = await getAgBonus(db, atkId, atk);
    const agDef = await getAgBonus(db, defId, def);

    const styxBonus = STYX_HOUSES.includes(ANCESTRIES[(def.ancestry || '').toUpperCase()]?.house) ? STYX_FORT_BONUS : 0;
    const terrainB  = TERRAIN_DEF[town.terrain_type] || 0;
    const defScore  = await calcDefenseScore(db, townId);
    const atkOff    = await calcOffenseScore(db, atkId);
    const menMod    = getMod(atk.attr_men || 10);
    const hasCav    = POLYSIA_KEYS.includes((atk.ancestry || '').toUpperCase()) && (atk.mil_cavalry || 0) > 0;
    const polyB     = hasCav ? POLYSIA_CAV_BONUS : 0;

    let atkPower = calcArmyPower(atk, 'siege_atk', town.terrain_type) + atkOff * 5 + menMod * 2 + polyB + atkRoll + agAtk;
    let defPower = calcArmyPower(def, 'siege_def', town.terrain_type) * 1.2 + defScore * 8 + terrainB + styxBonus + defRoll + agDef;
    if (!defSupplied) defPower = Math.floor(defPower * 0.5);

    const atkWins = atkPower > defPower;
    const winner  = atkWins ? atk : def;
    const loser   = atkWins ? def : atk;

    // Casualties
    if (atkWins) {
        const al = 0.70 + Math.random() * 0.20;
        const dl = 0.40 + Math.random() * 0.30;
        await applySiegeCasualties(db, atk, al, true);
        await applySiegeCasualties(db, def, dl, false);
        await db.run('UPDATE users SET rate_stab=MAX(-10,rate_stab-3) WHERE id=?', def.id);
        await db.run('UPDATE users SET rate_prest=MIN(10,rate_prest+2) WHERE id=?', atk.id);

        // Show destroy building buttons to GM
        const bldgs = await db.all('SELECT * FROM buildings WHERE town_id=?', townId);
        if (bldgs.length > 0) {
            const rows = [];
            let row = new ActionRowBuilder();
            for (let i = 0; i < bldgs.length; i++) {
                if (i > 0 && i % 5 === 0) { rows.push(row); row = new ActionRowBuilder(); }
                row.addComponents(new ButtonBuilder()
                    .setCustomId(`warsiege_destroy_${bldgs[i].id}_${def.id}`)
                    .setLabel(BUILDINGS[bldgs[i].type.toUpperCase()]?.name || bldgs[i].type)
                    .setStyle(ButtonStyle.Danger));
            }
            if (row.components.length > 0) rows.push(row);
            await interaction.update({ components: rows, content: `🏰 Siege resolved. **<@${atk.id}>** wins! Select a building to destroy in **${town.name}**:` });
            return;
        }
    } else {
        const dl = 0.85 + Math.random() * 0.10;
        const al = 0.60 + Math.random() * 0.20;
        await applySiegeCasualties(db, def, dl, false);
        await applySiegeCasualties(db, atk, al, true);
        await db.run('UPDATE users SET rate_stab=MAX(-10,rate_stab-2) WHERE id=?', atk.id);
        await db.run('UPDATE users SET rate_prest=MIN(10,rate_prest+3) WHERE id=?', def.id);
        await interaction.update({ components: [], content: `🏰 Siege resolved. **<@${def.id}>** holds ${town.name}!` });
    }

    await db.run('INSERT INTO gm_events (user_id, gm_id, event_type, severity, effect_snapshot, created_at) VALUES (?,?,?,?,?,?)',
        winner.id, interaction.user.id, 'siege', 1, JSON.stringify({ atk: atkId, def: defId, winner: winner.id, battleName: siegeName }), Date.now());

    // Notify players
    const siegeName = generateBattleName('SIEGE', { townName: town.name, attackerNation: atk.nation, defenderNation: def.nation, attackerRulerName: atk.ruler_name });

    for (const uid of [atkId, defId]) {
        const userObj = uid === atkId ? atk : def;
        const chan = await getNotificationChannel(interaction.client, userObj);
        const isWin = uid === winner.id;
        const emb = new EmbedBuilder()
            .setTitle(`${isWin ? '🏆' : '💀'} ${siegeName}`)
            .setColor(isWin ? 0x00FF88 : 0xFF0000)
            .setDescription(`${siegeName}\nAtk: ${atkPower} vs Def: ${defPower}${!defSupplied ? ' *(defender undersupplied)*' : ''}\n${isWin ? '+2 Prestige' : atkWins ? '-3 Stability' : '-2 Stability'}`);
        let sent = false;
        if (chan) { try { await chan.send({ content: `<@${uid}>`, embeds: [emb] }); sent = true; } catch (_) {} }
        if (!sent) {
            try { const u = await interaction.client.users.fetch(uid); if (u) await u.send({ embeds: [emb] }); } catch (_) {}
        }
    }
}

async function applySiegeCasualties(db, user, surviveRatio, isAtk) {
    const inf = Math.max(0, Math.floor((user.mil_infantry || 0) * surviveRatio));
    const cav = Math.max(0, Math.floor((user.mil_cavalry  || 0) * surviveRatio));
    const rng = Math.max(0, Math.floor((user.mil_ranged   || 0) * surviveRatio));
    const sig = isAtk ? Math.max(0, Math.floor((user.mil_siege || 0) * surviveRatio)) : Math.max(0, Math.floor((user.mil_siege || 0) * surviveRatio));
    // Siege units always take casualties too
    const updated = { ...user, mil_infantry: inf, mil_cavalry: cav, mil_ranged: rng, mil_siege: sig };
    await db.run(
        'UPDATE users SET mil_infantry=?, mil_cavalry=?, mil_ranged=?, mil_siege=?, mil_maintenance_cost=? WHERE id=?',
        inf, cav, rng, sig, calcMaintenance(updated), user.id
    );
}

async function handleSiegeDestroy(interaction, bldgId, defId) {
    const db = interaction.client.db;
    if (!await isGM(db, interaction.user.id)) return interaction.reply({ content: 'Access Denied.', ephemeral: true });
    await db.run('DELETE FROM buildings WHERE id=?', bldgId);
    await interaction.update({ components: [], content: interaction.message.content + '\n\nBuilding destroyed.' });
}

// ─── RAID MODE ──────────────────────────────────────────────────────────────────

async function handleRaidInitiate(interaction) {
    const db = interaction.client.db;
    const targetId  = interaction.options.getString('user');
    const townName  = interaction.options.getString('town') || null;
    if (targetId === interaction.user.id) return interaction.editReply({ content: '⚠️ Cannot raid yourself.' });

    const atk = await db.get('SELECT * FROM users WHERE id=?', interaction.user.id);
    const def = await db.get('SELECT * FROM users WHERE id=?', targetId);
    if (!def) return interaction.editReply({ content: '⚠️ Target not found.' });
    if (townName) {
        const t = await db.get('SELECT * FROM towns WHERE user_id=? AND name=?', targetId, townName);
        if (!t) return interaction.editReply({ content: '⚠️ Target town not found.' });
    }

    const rank = getPlayerRank(atk);
    if (rank === 'SCION') return interaction.editReply({ content: '⚠️ Scions cannot raid.' });

    const atkHouse = ANCESTRIES[(atk.ancestry || '').toUpperCase()]?.house;
    const defHouse = ANCESTRIES[(def.ancestry || '').toUpperCase()]?.house;
    if (atkHouse && defHouse && atkHouse === defHouse && atkHouse !== 'INDEPENDENT' && atkHouse !== 'REMOVED')
        return interaction.editReply({ content: '⚠️ You cannot raid a member of the same Great House.' });

    // Show composition modal for raid forces
    const modal = new ModalBuilder()
        .setCustomId(`warraid_${atk.id}_${def.id}${townName ? '_' + encodeName(townName) : ''}`)
        .setTitle('🗡️ Commit Raid Forces');

    const fields = [
        { id: 'inf', label: 'Infantry', max: atk.mil_infantry || 0 },
        { id: 'cav', label: 'Cavalry (recommended)', max: atk.mil_cavalry || 0 },
        { id: 'rng', label: 'Ranged (recommended)', max: atk.mil_ranged || 0 },
        { id: 'sie', label: 'Siege (slows withdrawal!)', max: atk.mil_siege || 0 },
        { id: 'mercs', label: 'Mercenaries', max: atk.mercs_temp || 0 },
    ];
    for (const f of fields) {
        modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder().setCustomId(f.id).setLabel(`${f.label} (max ${f.max})`).setStyle(TextInputStyle.Short).setRequired(false).setValue('0').setPlaceholder(`0-${f.max}`)
        ));
    }
    return await interaction.showModal(modal);
}

async function handleRaidCompositionSubmit(interaction, atkId, defId, townNameEnc) {
    const db = interaction.client.db;
    const atk = await db.get('SELECT * FROM users WHERE id=?', atkId);
    const def = await db.get('SELECT * FROM users WHERE id=?', defId);
    if (!atk || !def) return interaction.reply({ content: '⚠️ Data not found.', ephemeral: true });

    const townName = townNameEnc ? decodeName(townNameEnc) : null;
    const fields = ['inf', 'cav', 'rng', 'sie', 'mercs'];
    const colMap = { inf: 'mil_infantry', cav: 'mil_cavalry', rng: 'mil_ranged', sie: 'mil_siege', mercs: 'mercs_temp' };
    const counts = {};
    for (const f of fields) {
        const val = parseInt(interaction.fields.getTextInputValue(f)) || 0;
        if (val < 0) return interaction.reply({ content: '⚠️ Values must be 0 or positive.', ephemeral: true });
        if (val > (atk[colMap[f]] || 0)) return interaction.reply({ content: `⚠️ Cannot commit more ${f} than you own.`, ephemeral: true });
        counts[f] = val;
    }

    const foodCost = fieldFoodCostFor(counts);
    if ((atk.food_surplus || 0) < foodCost) return interaction.reply({ content: `⚠️ Need **${foodCost} 🥩**.`, ephemeral: true });
    await db.run('UPDATE users SET food_surplus=food_surplus-? WHERE id=?', foodCost, atk.id);

    const siegeWarn = counts.sie > 0 ? '\n⚠️ Siege units committed — withdrawal will be slower.' : '';
    const terrainKeys = Object.keys(TERRAINS);
    const terrainKey = terrainKeys[Math.floor(Math.random() * terrainKeys.length)];
    const terrain = TERRAINS[terrainKey];
    const compStr = `${counts.inf}_${counts.cav}_${counts.rng}_${counts.sie}_${counts.mercs}_${terrainKey}`;
    const raidName = generateBattleName('RAID', {
        townName: townName || undefined,
        attackerNation: atk.nation, defenderNation: def.nation,
        attackerRulerName: atk.ruler_name
    });

    const emb = new EmbedBuilder()
        .setTitle(`🗡️ ${raidName}`)
        .setColor(0xFF6600)
        .setImage(terrain?.img || null)
        .setDescription([
            `**Raider:** <@${atk.id}> ${atk.ruler_name ? `— ${atk.ruler_name}` : ''}${atk.nation ? ` of ${atk.nation}` : ''}`,
            `**Target:** <@${def.id}> ${def.ruler_name ? `— ${def.ruler_name}` : ''}${def.nation ? ` of ${def.nation}` : ''}`,
            townName ? `🎯 Town: **${townName}**` : '',
            `🌍 Terrain: **${terrain?.name || terrainKey}**`,
            '',
            `⚔️ Inf: ${counts.inf} | 🐎 Cav: ${counts.cav} | 🏹 Rng: ${counts.rng} | 🪨 Sie: ${counts.sie} | 🗡️ Mercs: ${counts.mercs}`,
            `🔥 Morale: ${calcMorale(atk)} | 🥩 Food: ${foodCost}${siegeWarn}`,
        ].filter(Boolean).join('\n'));

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`warraid_approve_${atk.id}_${def.id}_${compStr}${townName ? '_' + encodeName(townName) : ''}`).setLabel('✅ Approve Raid').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`warraid_abort_${atk.id}`).setLabel('❌ Abort').setStyle(ButtonStyle.Danger)
    );
    await resolveAtlasHQ(interaction.client, emb, [row]);
    return interaction.reply({ content: `🗡️ Raid submitted. **${foodCost} 🥩** spent. Awaiting GM approval.`, ephemeral: true });
}

async function handleRaidApprove(interaction, atkId, defId, compArgs, townNameEnc) {
    const db = interaction.client.db;
    if (!await isGM(db, interaction.user.id)) return interaction.reply({ content: 'Access Denied.', ephemeral: true });

    const atk = await db.get('SELECT * FROM users WHERE id=?', atkId);
    const def = await db.get('SELECT * FROM users WHERE id=?', defId);
    if (!atk || !def) return interaction.reply({ content: '⚠️ Data not found.', ephemeral: true });

    const townName = townNameEnc ? decodeName(townNameEnc) : null;
    const comps = compArgs ? compArgs : [`${atk.mil_infantry || 0}`, `${atk.mil_cavalry || 0}`, `${atk.mil_ranged || 0}`, `${atk.mil_siege || 0}`, `${atk.mercs_temp || 0}`, 'PLAINS'];
    const rInf = parseInt(comps[0]) || 0, rCav = parseInt(comps[1]) || 0, rRng = parseInt(comps[2]) || 0, rSie = parseInt(comps[3]) || 0, rMercs = parseInt(comps[4]) || 0;
    const terrainKey = comps[5] || 'PLAINS';
    const terrain = TERRAINS[terrainKey.toUpperCase()] || TERRAINS['PLAINS'];

    // Phase 1: Raid combat
    const atkForPower = { ...atk, mil_infantry: rInf, mil_cavalry: rCav, mil_ranged: rRng, mil_siege: rSie, mercs_temp: rMercs };
    const atkRoll = Math.floor(Math.random() * 20) + 1;
    const defRoll = Math.floor(Math.random() * 20) + 1;
    const agAtk = await getAgBonus(db, atkId, atk);
    const agDef = await getAgBonus(db, defId, def);
    const atkOff = await calcOffenseScore(db, atkId);
    const menMod = getMod(atk.attr_men || 10);
    const hasCav = POLYSIA_KEYS.includes((atk.ancestry || '').toUpperCase()) && rCav > 0;
    const polyB   = hasCav ? POLYSIA_CAV_BONUS : 0;
    const counter = compCounterBonus(atkForPower, def);

    const atkPower = calcArmyPower(atkForPower, 'field', terrainKey) + atkOff * 5 + menMod * 2 + polyB + counter + atkRoll + agAtk;
    const defPower = calcArmyPower(def, 'field', terrainKey) * 1.2 + (await calcOffenseScore(db, defId)) * 5 + defRoll + agDef;
    const raidWins = atkPower > defPower;

    // Phase 1 casualties
    const lossFactor = raidWins ? (0.80 + Math.random() * 0.10) : (0.60 + Math.random() * 0.20);
    const p1Inf = Math.max(0, Math.floor(rInf * lossFactor));
    const p1Cav = Math.max(0, Math.floor(rCav * lossFactor));
    const p1Rng = Math.max(0, Math.floor(rRng * lossFactor));
    const p1Sie = Math.max(0, Math.floor(rSie * lossFactor));
    const p1Mercs = Math.max(0, Math.floor(rMercs * lossFactor));

    const powerMargin = raidWins ? (atkPower / Math.max(1, defPower)) : (defPower / Math.max(1, atkPower));
    const battleData = `${atkId}_${defId}_${comps.join('_')}_${raidWins ? 1 : 0}_${powerMargin.toFixed(2)}_${p1Inf}_${p1Cav}_${p1Rng}_${p1Sie}_${p1Mercs}_${townName ? encodeName(townName) : 'none'}`;

    await interaction.update({ components: [], content: `🗡️ Raid Phase 1 complete. <@${atkId}> — choose to withdraw or press the attack.` });

    // Send withdrawal prompt to attacker
    const chan = await getNotificationChannel(interaction.client, atk);
    if (chan) {
        const emb = new EmbedBuilder()
            .setTitle(`🗡️ Raid — ${raidWins ? 'Advantage' : 'Resistance'}`)
            .setColor(raidWins ? 0x00FF88 : 0xFF0000)
            .setDescription([
                `Raid against <@${defId}> ${townName ? `(${townName})` : ''}`,
                `Phase 1: Atk ${atkPower} vs Def ${defPower}`,
                raidWins ? 'You have the upper hand.' : 'The defenders are holding firm.',
                '',
                'Choose your next move (5 min countdown):',
            ].join('\n'));
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`raidwithdraw_now_${battleData}`).setLabel('🏃 Withdraw Now').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`raidwithdraw_press_${battleData}`).setLabel('⚔️ Press the Attack').setStyle(ButtonStyle.Danger)
        );
        try { await chan.send({ content: `<@${atkId}>`, embeds: [emb], components: [row] }); } catch (_) {}
    }
}

async function handleRaidWithdraw(interaction, battleData, isNow) {
    const db = interaction.client.db;
    const parts = battleData.split('_');
    const atkId = parts[0], defId = parts[1];
    const rInf = parseInt(parts[2]), rCav = parseInt(parts[3]), rRng = parseInt(parts[4]), rSie = parseInt(parts[5]), rMercs = parseInt(parts[6]);
    const terrainKey = parts[7];
    const raidWonPhase1 = parts[8] === '1';
    const p1Inf = parseInt(parts[10]), p1Cav = parseInt(parts[11]), p1Rng = parseInt(parts[12]), p1Sie = parseInt(parts[13]), p1Mercs = parseInt(parts[14]);
    const townNameEnc = parts.length > 15 ? parts.slice(15).join('_') : 'none';
    const townName = townNameEnc !== 'none' ? decodeName(townNameEnc) : null;

    const atk = await db.get('SELECT * FROM users WHERE id=?', atkId);
    const def = await db.get('SELECT * FROM users WHERE id=?', defId);
    if (!atk || !def || interaction.user.id !== atkId) return interaction.reply({ content: '⚠️ Only the raider may choose.', ephemeral: true });

    let finalInf = p1Inf, finalCav = p1Cav, finalRng = p1Rng, finalSie = p1Sie, finalMercs = p1Mercs;
    let defLosses = 0;
    let loot = 0;

    if (isNow) {
        // Withdraw now: reduced casualties (0.90 survival), loot
        finalInf  = Math.max(0, Math.floor(rInf  * 0.90));
        finalCav  = Math.max(0, Math.floor(rCav  * 0.90));
        finalRng  = Math.max(0, Math.floor(rRng  * 0.90));
        finalSie  = Math.max(0, Math.floor(rSie  * 0.90));
        finalMercs = Math.max(0, Math.floor(rMercs * 0.90));

        const powerMargin = parseFloat(parts[9]) || 1;
        loot = Math.floor((def.wealth || 0) * 0.05 * powerMargin);
        loot = Math.min(loot, Math.floor((def.wealth || 0) * 0.10));
    } else {
        // Press the attack: Phase 2, defender buff x1.3
        const atkRoll2 = Math.floor(Math.random() * 20) + 1;
        const defRoll2 = Math.floor(Math.random() * 20) + 1;
        const atkForPower2 = { ...atk, mil_infantry: p1Inf, mil_cavalry: p1Cav, mil_ranged: p1Rng, mil_siege: p1Sie, mercs_temp: p1Mercs };
        const atkP2 = calcArmyPower(atkForPower2, 'field', terrainKey) + (await calcOffenseScore(db, atkId)) * 5 + getMod(atk.attr_men || 10) * 2 + atkRoll2 + (await getAgBonus(db, atkId, atk));
        const defP2 = calcArmyPower(def, 'field', terrainKey) * 1.3 + (await calcOffenseScore(db, defId)) * 5 + defRoll2 + (await getAgBonus(db, defId, def));
        const p2Wins = atkP2 > defP2;
        const p2Loss = p2Wins ? (0.85 + Math.random() * 0.10) : (0.50 + Math.random() * 0.20);
        finalInf  = Math.max(0, Math.floor(p1Inf  * p2Loss));
        finalCav  = Math.max(0, Math.floor(p1Cav  * p2Loss));
        finalRng  = Math.max(0, Math.floor(p1Rng  * p2Loss));
        finalSie  = Math.max(0, Math.floor(p1Sie  * p2Loss));
        finalMercs = Math.max(0, Math.floor(p1Mercs * p2Loss));
        defLosses  = Math.max(0, Math.floor((def.pop_commoners || 100) * 0.05));
        if (p2Wins) {
            const pm = (atkP2 / Math.max(1, defP2));
            loot = Math.floor((def.wealth || 0) * 0.05 * pm);
            loot = Math.min(loot, Math.floor((def.wealth || 0) * 0.10));
        }
    }

    // Apply casualties and loot
    const atkLost = {
        inf: Math.max(0, rInf - finalInf), cav: Math.max(0, rCav - finalCav),
        rng: Math.max(0, rRng - finalRng), sie: Math.max(0, rSie - finalSie), mercs: Math.max(0, rMercs - finalMercs)
    };
    await db.run('UPDATE users SET mil_infantry=MAX(0,mil_infantry-?), mil_cavalry=MAX(0,mil_cavalry-?), mil_ranged=MAX(0,mil_ranged-?), mil_siege=MAX(0,mil_siege-?), mercs_temp=MAX(0,mercs_temp-?) WHERE id=?',
        atkLost.inf, atkLost.cav, atkLost.rng, atkLost.sie, atkLost.mercs, atkId);
    if (loot > 0) {
        await db.run('UPDATE users SET wealth=MAX(0,wealth-?) WHERE id=?', loot, defId);
        await db.run('UPDATE users SET wealth=COALESCE(wealth,0)+? WHERE id=?', loot, atkId);
    }
    if (defLosses > 0) {
        await db.run('UPDATE users SET pop_commoners=MAX(10,pop_commoners-?) WHERE id=?', defLosses, defId);
    }

    const atkRow = await db.get('SELECT * FROM users WHERE id=?', atkId);
    await db.run('UPDATE users SET mil_maintenance_cost=? WHERE id=?', calcMaintenance(atkRow), atkId);

    const raidName = generateBattleName('RAID', { townName, attackerNation: atk.nation, attackerRulerName: atk.ruler_name });

    // Notify both players
    for (const uid of [atkId, defId]) {
        const userObj = uid === atkId ? atk : def;
        const chan = await getNotificationChannel(interaction.client, userObj);
        const isRaider = uid === atkId;
        const emb = new EmbedBuilder()
            .setTitle(`🗡️ ${raidName} — ${isRaider ? (isNow ? 'Withdrawn' : 'Complete') : 'Raided'}`)
            .setColor(isRaider ? 0x00FF88 : 0xFF0000)
            .setDescription([
                `Raider: <@${atkId}> | Target: <@${defId}>`,
                isRaider ? (
                    isNow
                        ? `Withdrew with reduced losses.\nLoot: **${loot} ⚖️**\nLosses: ⚔️${atkLost.inf} 🐎${atkLost.cav} 🏹${atkLost.rng} 🪨${atkLost.sie} 🗡️${atkLost.mercs}`
                        : `Pressed the attack and ${atkLost.inf+atkLost.cav+atkLost.rng > 0 ? 'sustained casualties' : 'succeeded'}.\nLoot: **${loot} ⚖️**\nLosses: ⚔️${atkLost.inf} 🐎${atkLost.cav} 🏹${atkLost.rng} 🪨${atkLost.sie} 🗡️${atkLost.mercs}`
                ) : `Raid against you concluded.\nLoot lost: **${loot} ⚖️**${defLosses > 0 ? `\n☠️ Pop loss: ${defLosses} commoners` : ''}`,
            ].join('\n'));
        let sent = false;
        if (chan) { try { await chan.send({ content: `<@${uid}>`, embeds: [emb] }); sent = true; } catch (_) {} }
        if (!sent) { try { const u = await interaction.client.users.fetch(uid); if (u) await u.send({ embeds: [emb] }); } catch (_) {} }
    }

    await db.run('INSERT INTO gm_events (user_id, gm_id, event_type, severity, effect_snapshot, created_at) VALUES (?,?,?,?,?,?)',
        atkId, 'system', 'raid', 1, JSON.stringify({ atkId, defId, loot, atkLost, defLosses, isNow, townName }), Date.now());

    await interaction.update({ components: [], content: `🗡️ Raid concluded. Loot: **${loot} ⚖️**.` });
}

// ─── REBELLION EVENT (exported for events.js) ───────────────────────────────────

// GM submits battle name modal
async function handleBattleNameSubmit(interaction, atkId, defId, compArgs) {
    const db = interaction.client.db;
    const nameInput = interaction.fields.getTextInputValue('battle_name')?.trim();
    const atk = await db.get('SELECT * FROM users WHERE id=?', atkId);
    const def = await db.get('SELECT * FROM users WHERE id=?', defId);

    let battleName = nameInput;
    if (!battleName || battleName.length === 0) {
        const terrainKey = (compArgs && compArgs.length >= 6) ? compArgs[5] : 'PLAINS';
        const terrain = TERRAINS[terrainKey.toUpperCase()] || TERRAINS['PLAINS'];
        const battleType = classifyBattle({ hasTown: false, terrainType: terrainKey, isRaid: false });
        battleName = generateBattleName(battleType, {
            attackerNation: atk?.nation, defenderNation: def?.nation,
            attackerRulerName: atk?.ruler_name, isOutnumbered: false
        });
    }

    return handleBattleApprove(interaction, atkId, defId, compArgs, battleName);
}

async function handleRebellionEvent(db, user) {
    // Servus rebellion: stab <= -5 AND servus > 0
    const servusCount = user.servus || 0;
    const stab        = user.rate_stab || 0;
    if (stab <= -5 && servusCount > 0) {
        const rebelStr = servusCount * 3;
        const armyPow  = calcArmyPower(user, 'field');
        if (armyPow > rebelStr) {
            await db.run('UPDATE users SET rate_stab=MAX(-10,rate_stab-1), servus=MAX(0,servus-5) WHERE id=?', user.id);
            return { type: 'servus', result: 'suppressed' };
        } else {
            await db.run('UPDATE users SET rate_stab=MAX(-10,rate_stab-5), wealth=MAX(0,wealth-2000), servus=0 WHERE id=?', user.id);
            const bldg = await db.get('SELECT id FROM buildings WHERE town_id IN (SELECT id FROM towns WHERE user_id=?) ORDER BY RANDOM() LIMIT 1', user.id);
            if (bldg) await db.run('DELETE FROM buildings WHERE id=?', bldg.id);
            return { type: 'servus', result: 'overwhelmed', buildingDestroyed: !!bldg };
        }
    }

    // Noble revolt: prest <= -3 AND pop_commoners >= 200
    const prest = user.rate_prest || 0;
    const pop   = user.pop_commoners || 0;
    if (prest <= -3 && pop >= 200) {
        const nobles    = Math.floor(pop / 50);
        const defectors = Math.floor(nobles * Math.abs(prest) / 10);
        const armyPow   = calcArmyPower(user, 'field');
        if (armyPow > defectors * 10) {
            await db.run('UPDATE users SET rate_prest=MAX(-10,rate_prest-1) WHERE id=?', user.id);
            return { type: 'noble', result: 'suppressed' };
        } else {
            await db.run('UPDATE users SET rate_prest=MAX(-10,rate_prest-5), status="deposed" WHERE id=?', user.id);
            return { type: 'noble', result: 'deposed' };
        }
    }
    return null;
}

// ─── BUTTON HANDLER ────────────────────────────────────────────────────────────

async function handleButton(interaction, action, args) {
    if (action === 'warapprove' && args[0] === 'battle') {
        if (!await isGM(interaction.client.db, interaction.user.id))
            return interaction.reply({ content: 'Access Denied.', ephemeral: true });
        const modal = new ModalBuilder()
            .setCustomId(`warbattlename_${args.slice(1).join('_')}`)
            .setTitle('⚔️ Name This Battle');
        modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('battle_name').setLabel('Battle Name (optional)')
                .setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(80)
                .setPlaceholder('Leave blank for auto-generated name')
        ));
        return await interaction.showModal(modal);
    }
    if (action === 'warreject' && args[0] === 'battle') {
        if (!await isGM(interaction.client.db, interaction.user.id))
            return interaction.reply({ content: 'Access Denied.', ephemeral: true });
        // Refund attacker food (stored in composition — parse comp for food calc)
        if (args.length > 3) {
            const compArr = args.slice(3);
            const refund = fieldFoodCostFor({ inf: parseInt(compArr[0])||0, cav: parseInt(compArr[1])||0, rng: parseInt(compArr[2])||0, mercs: parseInt(compArr[4])||0 });
            await interaction.client.db.run('UPDATE users SET food_surplus=food_surplus+? WHERE id=?', refund, args[1]);
        }
        await interaction.update({ components: [], content: '❌ Battle rejected.' });
        return;
    }
    if (action === 'warbattle' && args[0] === 'ss')
        return handleBattleSubstat(interaction, args[1], args[2]);
    if (action === 'warconfirm' && args[0] === 's')
        return handleSiegeConfirm(interaction, args[1], args[2], args[3]);
    if (action === 'warabort' && args[0] === 's') {
        if (!await isGM(interaction.client.db, interaction.user.id))
            return interaction.reply({ content: 'Access Denied.', ephemeral: true });
        await interaction.update({ components: [], content: '❌ Siege aborted.' });
        return;
    }
    if (action === 'warsiege' && args[0] === 'destroy')
        return handleSiegeDestroy(interaction, args[1], args[2]);
    if (action === 'wardefcommit')
        return handleDefenderCommit(interaction, args[0], args[1], args[2]);
    if (action === 'warraid' && args[0] === 'approve') {
        if (!await isGM(interaction.client.db, interaction.user.id))
            return interaction.reply({ content: 'Access Denied.', ephemeral: true });
        const compArgs = args.length > 3 ? args.slice(3, 9) : null;
        const townEnc = args.length > 9 ? args[9] : null;
        return handleRaidApprove(interaction, args[1], args[2], compArgs, townEnc);
    }
    if (action === 'warraid' && args[0] === 'abort') {
        if (!await isGM(interaction.client.db, interaction.user.id))
            return interaction.reply({ content: 'Access Denied.', ephemeral: true });
        await interaction.update({ components: [], content: '❌ Raid aborted.' });
        return;
    }
    if (action === 'raidwithdraw') {
        const battleData = args.slice(1).join('_');
        if (args[0] === 'now') return handleRaidWithdraw(interaction, battleData, true);
        if (args[0] === 'press') return handleRaidWithdraw(interaction, battleData, false);
    }
}

module.exports = { handleBattleInitiate, handleBattleCompositionSubmit, handleBattleNameSubmit, handleSiegeInitiate, handleRaidInitiate, handleRaidCompositionSubmit, handleButton, handleRebellionEvent };
