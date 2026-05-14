const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { ANCESTRIES, UPBRINGINGS, PROFESSIONS, EMOJIS } = require('../../data/constants');
const { getMod, fmtMod, resolveAtlasHQ, buildBaseAttributes, applyBoosts, applyBoost, getPlayerRank, GREAT_HOUSES } = require('../../utils/helpers');

async function handleOriginsIntro(interaction, user) {
    if (!user) {
        await interaction.client.db.run('INSERT INTO users (id, status) VALUES (?, ?)', interaction.user.id, 'pending');
    }
    
    if (user && user.status === 'pending_audit') {
        const embed = new EmbedBuilder().setTitle('⏳ IMPERIAL AUDIT PENDING').setColor(0xFFD700)
            .setDescription(`${EMOJIS.men} Your lineage credentials have been submitted and are currently being reviewed by the High Command.\n\n*If you wish to retract your submission and change your lineage details, click the button below.*`);
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('origins_restart_audit').setLabel('Retract & Restart').setEmoji('🔄').setStyle(ButtonStyle.Danger)
        );
        return interaction.editReply({ embeds: [embed], components: [row] });
    }

    if (!user || !user.age) {
        const embed = new EmbedBuilder().setTitle('🎲 DETERMINING VITALITY').setColor(0xFFD700)
            .setDescription(`Before your lineage can be recorded in the Imperial Ledger, we must determine your character's starting **Age**.\n\nClick the button below to roll \`1d10 + 10\`.`);
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ageroll').setLabel('Roll for Age').setEmoji('🎲').setStyle(ButtonStyle.Primary)
        );
        return interaction.editReply({ embeds: [embed], components: [row] });
    }

    const age = user.age;
    const embed = new EmbedBuilder().setTitle('📜 IMPERIAL ORIGINS').setColor(0xFFD700)
        .setDescription(`Your lineage is recorded. You are **${age}** years of age.\n\nAll attributes start at **10**. Your choices below will provide permanent bonuses to your stats.\n\nChoose your **Ancestry**:`);
    
    const rows = [];
    let currentRow = new ActionRowBuilder();
    const ancKeys = Object.keys(ANCESTRIES).filter(k => !k.startsWith('POLYSIA-'));
    for (const key of ancKeys) {
        if (currentRow.components.length === 5) { rows.push(currentRow); currentRow = new ActionRowBuilder(); }
        const anc = ANCESTRIES[key];
        currentRow.addComponents(new ButtonBuilder().setCustomId(`origins_ancestrypick_${key}_${age}`).setLabel(anc.name).setEmoji(anc.emoji || '👤').setStyle(anc.style || ButtonStyle.Primary));
    }
    const polysiaBtn = new ButtonBuilder().setCustomId(`origins_polysia_${age}`).setLabel('Polysia (Variants)').setEmoji('🌊').setStyle(ButtonStyle.Primary);
    if (currentRow.components.length < 5) {
        currentRow.addComponents(polysiaBtn);
    } else {
        rows.push(currentRow);
        currentRow = new ActionRowBuilder().addComponents(polysiaBtn);
    }
    if (currentRow.components.length > 0) rows.push(currentRow);
    return interaction.editReply({ embeds: [embed], components: rows });
}

async function handleOriginsLogic(interaction, action, args) {
    const db = interaction.client.db;
    const sub = args[0];

    if (action === 'origins') {
        if (sub === 'polysia') {
            const age = args[1];
            const embed = new EmbedBuilder().setTitle('🌊 POLYSIA ANCESTRY').setColor(0x00BFFF)
                .setDescription('The Polysians are a diverse seafaring people. Select your specific variant:\n\n**Polysia-Estuarin:** +2 MOT, +1 CHA\n**Polysia-Riparian:** +2 WIS, +1 INT');
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`origins_ancestrypick_POLYSIA-ESTUARIN_${age}`).setLabel('Polysia-Estuarin').setEmoji('🏝️').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`origins_ancestrypick_POLYSIA-RIPARIAN_${age}`).setLabel('Polysia-Riparian').setEmoji('🚣').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`origins_back_intro`).setLabel('Back').setStyle(ButtonStyle.Secondary)
            );
            await interaction.deferUpdate();
            return interaction.editReply({ embeds: [embed], components: [row] });
        }
        
        if (sub === 'ancestrypick') {
            const [ , ancKey, age ] = args;
            const anc = ANCESTRIES[ancKey];
            const bonuses = Object.entries(anc.bonuses).map(([k, v]) => `${k.replace('stat_', '').toUpperCase()} +${v}`).join(', ');
            const embed = new EmbedBuilder().setTitle(`📜 BACKGROUND: ${anc.name}`).setColor(0xFFD700)
                .setDescription(`*${anc.desc}*\n\n**Ancestry Bonus:** \`${bonuses}\`\n\nNow, choose your **Background (Upbringing)**:`);
            const rows = [];
            let currentRow = new ActionRowBuilder();
            for (const [key, ub] of Object.entries(UPBRINGINGS)) {
                if (currentRow.components.length === 5) { rows.push(currentRow); currentRow = new ActionRowBuilder(); }
                const b = Object.entries(ub.bonuses).map(([k, v]) => `${k.replace('stat_', '').toUpperCase()} +${v}`).join(', ');
                currentRow.addComponents(new ButtonBuilder().setCustomId(`origins_bgpick_${ancKey}_${key}_${age}`).setLabel(`${ub.name} (${b})`).setStyle(ButtonStyle.Secondary));
            }
            if (currentRow.components.length > 0) rows.push(currentRow);
            const backRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`origins_back_intro`).setLabel('Back').setStyle(ButtonStyle.Secondary));
            rows.push(backRow);
            await interaction.deferUpdate();
            return interaction.editReply({ embeds: [embed], components: rows });
        }

        if (sub === 'bgpick') {
            const [ , ancKey, bgKey, age ] = args;
            const ub = UPBRINGINGS[bgKey];
            const bonuses = Object.entries(ub.bonuses).map(([k, v]) => `${k.replace('stat_', '').toUpperCase()} +${v}`).join(', ');
            const embed = new EmbedBuilder().setTitle(`📜 PROFESSION: ${ub.name}`).setColor(0xFFD700)
                .setDescription(`*${ub.desc}*\n\n**Background Bonus:** \`${bonuses}\`\n\nFinally, choose your **Profession**:`);
            const rows = [];
            let currentRow = new ActionRowBuilder();
            for (const [key, prof] of Object.entries(PROFESSIONS)) {
                if (currentRow.components.length === 5) { rows.push(currentRow); currentRow = new ActionRowBuilder(); }
                const b = Object.entries(prof.bonuses).map(([k, v]) => {
                    if (k === 'all') return 'ALL +1';
                    return `${k.replace('stat_', '').toUpperCase()} +${v}`;
                }).join(', ');
                currentRow.addComponents(new ButtonBuilder().setCustomId(`origins_profpick_${ancKey}_${bgKey}_${key}_${age}`).setLabel(`${prof.name} (${b})`).setStyle(ButtonStyle.Success));
            }
            if (currentRow.components.length > 0) rows.push(currentRow);
            const backRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`origins_back_ancestry_${age}`).setLabel('Back').setStyle(ButtonStyle.Secondary));
            rows.push(backRow);
            await interaction.deferUpdate();
            return interaction.editReply({ embeds: [embed], components: rows });
        }

        if (sub === 'profpick') {
            const [ , ancKey, bgKey, profKey, age ] = args;
            await interaction.deferUpdate();
            return await renderFreeBoostView(interaction, ancKey, bgKey, profKey, '000000', age);
        }

        if (sub === 'back') {
            const type = args[1];
            await interaction.deferUpdate();
            const user = await db.get('SELECT * FROM users WHERE id = ?', interaction.user.id);
            if (type === 'intro') return await handleOriginsIntro(interaction, user);
            if (type === 'ancestry') return await handleOriginsLogic(interaction, 'origins', ['ancestrypick', 'placeholder', args[2]]);
            if (type === 'bg') return await handleOriginsLogic(interaction, 'origins', ['bgpick', args[2], 'placeholder', args[3]]);
            return await handleOriginsIntro(interaction, user);
        }

        if (sub === 'restart') {
            await interaction.deferUpdate();
            await db.run('UPDATE users SET status = "pending", age = NULL, ancestry = NULL, upbringing = NULL, profession = NULL, attr_str = 10, attr_mot = 10, attr_int = 10, attr_men = 10, attr_wis = 10, attr_cha = 10 WHERE id = ?', interaction.user.id);
            const user = await db.get('SELECT * FROM users WHERE id = ?', interaction.user.id);
            return await handleOriginsIntro(interaction, user);
        }
    }

    if (action === 'ageroll') {
        const age = Math.floor(Math.random() * 10) + 11;
        await db.run('UPDATE users SET age = ? WHERE id = ?', age, interaction.user.id);
        await interaction.deferUpdate();
        const user = await db.get('SELECT * FROM users WHERE id = ?', interaction.user.id);
        return await handleOriginsIntro(interaction, user);
    }

    if (action === 'fbadd') {
        const [anc, ub, prof, distStr, idx, age] = args;
        const dist = distStr.split('').map(Number);
        dist[idx]++;
        const newDistStr = dist.join('');
        await interaction.deferUpdate();
        return await renderFreeBoostView(interaction, anc, ub, prof, newDistStr, age);
    }

    if (action === 'fbreset') {
        const [anc, ub, prof, , age] = args;
        await interaction.deferUpdate();
        return await renderFreeBoostView(interaction, anc, ub, prof, '000000', age);
    }

    if (action === 'fbfinalize') {
        const [anc, ub, prof, distStr, age] = args;
        const modal = new ModalBuilder().setCustomId(`originsmodal_${anc}_${ub}_${prof}_${distStr || '000000'}_${age}`).setTitle('Imperial Audit — Biography');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ruler_name').setLabel('Character Name').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(32)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('description').setLabel('Biography').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(1500))
        );
        return await interaction.showModal(modal);
    }
}

async function renderFreeBoostView(interaction, anc, ub, prof, distStr, age) {
    const dist = distStr.split('').map(Number);
    const used = dist.reduce((a, b) => a + b, 0);
    
    const stats = buildBaseAttributes();
    applyBoosts(stats, ANCESTRIES[anc].bonuses);
    applyBoosts(stats, UPBRINGINGS[ub].bonuses);
    applyBoosts(stats, PROFESSIONS[prof].bonuses);
    const distKeys = ['stat_str', 'stat_mot', 'stat_int', 'stat_men', 'stat_wis', 'stat_cha'];
    for (let i = 0; i < 6; i++) { if (dist[i] > 0) stats[distKeys[i]] = applyBoost(stats[distKeys[i]], dist[i]); }

    const statRows = [
        `${EMOJIS.str} **STR:** ${stats.stat_str} (${fmtMod(getMod(stats.stat_str))})`,
        `${EMOJIS.mot} **MOT:** ${stats.stat_mot} (${fmtMod(getMod(stats.stat_mot))})`,
        `${EMOJIS.men} **MEN:** ${stats.stat_men} (${fmtMod(getMod(stats.stat_men))})`,
        `${EMOJIS.int} **INT:** ${stats.stat_int} (${fmtMod(getMod(stats.stat_int))})`,
        `${EMOJIS.wis} **WIS:** ${stats.stat_wis} (${fmtMod(getMod(stats.stat_wis))})`,
        `${EMOJIS.cha} **CHA:** ${stats.stat_cha} (${fmtMod(getMod(stats.stat_cha))})`
    ];

    const embed = new EmbedBuilder().setTitle('✨ LINEAGE FINALIZATION').setColor(0xFFD700)
        .setDescription(`You have **${4 - used}** free boosts remaining to customize your lineage.\n\n**Calculated Statistics:**\n${statRows.join('\n')}\n\n*Select a stat below to apply a boost (+1).*`);
    
    const rows = [new ActionRowBuilder(), new ActionRowBuilder()];
    const statLabels = ['str', 'mot', 'int', 'men', 'wis', 'cha'];
    const statEmojis = [EMOJIS.str, EMOJIS.mot, EMOJIS.men, EMOJIS.int, EMOJIS.wis, EMOJIS.cha];
    statLabels.forEach((s, i) => {
        const rowIdx = i < 3 ? 0 : 1;
        const btn = new ButtonBuilder().setCustomId(`fbadd_${anc}_${ub}_${prof}_${distStr}_${i}_${age}`).setLabel(`${s.toUpperCase()} (+${dist[i]})`).setEmoji(statEmojis[i]).setStyle(ButtonStyle.Secondary);
        if (used >= 4 || dist[i] >= 2) btn.setDisabled(true);
        rows[rowIdx].addComponents(btn);
    });
    
    const ctlRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`fbreset_${anc}_${ub}_${prof}_${distStr}_${age}`).setLabel('Reset').setEmoji('🔄').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`fbfinalize_${anc}_${ub}_${prof}_${distStr}_${age}`).setLabel('Finalize Audit').setEmoji('📜').setStyle(ButtonStyle.Success).setDisabled(used < 4),
        new ButtonBuilder().setCustomId(`origins_back_bg_${anc}_${age}`).setLabel('Back').setStyle(ButtonStyle.Secondary)
    );
    rows.push(ctlRow);
    return interaction.editReply({ embeds: [embed], components: rows });
}

async function handleModal(interaction, action, args) {
    if (action === 'originsmodal') {
        const [anc, ub, prof, distStr, age] = args;
        const dist = distStr.split('').map(Number);
        const rulerName = interaction.fields.getTextInputValue('ruler_name')?.trim();
        const description = interaction.fields.getTextInputValue('description')?.trim();
        
        await interaction.deferUpdate();
        
        const db = interaction.client.db;
        let stats = buildBaseAttributes();
        applyBoosts(stats, ANCESTRIES[anc].bonuses);
        applyBoosts(stats, UPBRINGINGS[ub].bonuses);
        applyBoosts(stats, PROFESSIONS[prof].bonuses);
        
        const distKeys = ['stat_str', 'stat_mot', 'stat_int', 'stat_men', 'stat_wis', 'stat_cha'];
        for (let i = 0; i < 6; i++) {
            if (dist[i] > 0) stats[distKeys[i]] = applyBoost(stats[distKeys[i]], dist[i]);
        }

        await db.run(`UPDATE users SET
            status = 'pending_audit', ancestry = ?, upbringing = ?, profession = ?, age = ?,
            ruler_name = ?, username = ?,
            attr_str = ?, attr_mot = ?, attr_int = ?, attr_men = ?, attr_wis = ?, attr_cha = ?,
            description = ?
            WHERE id = ?`,
            anc, ub, prof, age,
            rulerName, interaction.user.username,
            stats.stat_str, stats.stat_mot, stats.stat_int, stats.stat_men, stats.stat_wis, stats.stat_cha,
            description, interaction.user.id
        );

        const statBlock = [
            `${EMOJIS.str} STR: ${stats.stat_str}`, `${EMOJIS.mot} MOT: ${stats.stat_mot}`, `${EMOJIS.men} MEN: ${stats.stat_men}`,
            `${EMOJIS.int} INT: ${stats.stat_int}`, `${EMOJIS.wis} WIS: ${stats.stat_wis}`, `${EMOJIS.cha} CHA: ${stats.stat_cha}`
        ].join(' | ');

        const ancestry = ANCESTRIES[anc];
        const houseKey = ancestry?.house;
        const houseData = houseKey ? GREAT_HOUSES[houseKey] : null;
        const houseStr = houseData ? `${houseData.emoji} ${houseData.name}` : 'Independent';

        const auditEmbed = new EmbedBuilder().setTitle('📜 NEW LINEAGE AUDIT').setColor(0xFFD700)
            .setThumbnail(interaction.user.displayAvatarURL())
            .setDescription([
                `**Player:** <@${interaction.user.id}> (${interaction.user.username})`,
                `**Character Name:** ${rulerName}`,
                `**Age:** ${age} | **Ancestry:** ${ancestry?.name || anc} | **House:** ${houseStr}`,
                `**Upbringing:** ${UPBRINGINGS[ub]?.name || ub} | **Profession:** ${PROFESSIONS[prof]?.name || prof}`,
                ``,
                `**Statistics:**`,
                `\`${statBlock}\``,
                ``,
                `**Biography:**`,
                description || '*None provided*'
            ].join('\n'));
        
        const auditRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`audit_approve_${interaction.user.id}`).setLabel('Approve').setEmoji('✅').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`audit_deny_${interaction.user.id}`).setLabel('Deny').setEmoji('❌').setStyle(ButtonStyle.Danger)
        );

        await resolveAtlasHQ(interaction.client, auditEmbed, [auditRow]);
        return interaction.editReply({ content: '✅ Lineage submitted for Imperial Audit. Please wait for a Game Master to review your credentials.', embeds: [], components: [] });
    }
}

async function handleProfile(interaction) {
    const db = interaction.client.db;
    const targetId = interaction.options.getString('user') || interaction.user.id;
    const user = await db.get('SELECT * FROM users WHERE id = ?', targetId);
    
    if (!user) return interaction.editReply({ content: '⚠️ Lineage not found.' });
    if (user.status === 'pending_audit') {
        const isOwn = targetId === interaction.user.id;
        return interaction.editReply({ content: isOwn
            ? '⏳ **Your lineage is pending Imperial Audit.** A Game Master will review your credentials soon.'
            : '⏳ This lineage is currently undergoing **Imperial Audit**.' });
    }
    if (user.status !== 'active') return interaction.editReply({ content: '⚠️ This lineage is inactive or deceased.' });

    const ancestry = ANCESTRIES[(user.ancestry || '').toUpperCase()];
    const houseKey = ancestry?.house;
    const houseData = houseKey ? GREAT_HOUSES[houseKey] : null;
    const houseStr  = houseData ? `${houseData.emoji} ${houseData.name}` : '🌐 Independent';
    const rank      = getPlayerRank(user);

    const stats = [
        `${EMOJIS.str} **STR:** ${user.attr_str ?? 10} (${fmtMod(getMod(user.attr_str ?? 10))})`,
        `${EMOJIS.mot} **MOT:** ${user.attr_mot ?? 10} (${fmtMod(getMod(user.attr_mot ?? 10))})`,
        `${EMOJIS.men} **MEN:** ${user.attr_men ?? 10} (${fmtMod(getMod(user.attr_men ?? 10))})`,
        `${EMOJIS.int} **INT:** ${user.attr_int ?? 10} (${fmtMod(getMod(user.attr_int ?? 10))})`,
        `${EMOJIS.wis} **WIS:** ${user.attr_wis ?? 10} (${fmtMod(getMod(user.attr_wis ?? 10))})`,
        `${EMOJIS.cha} **CHA:** ${user.attr_cha ?? 10} (${fmtMod(getMod(user.attr_cha ?? 10))})`
    ];

    const descLines = [
        `**Lineage:** <@${targetId}>`,
        `**Name:** ${user.ruler_name || user.username || 'Unknown'} | **Age:** ${user.age || '?'}`,
        `**Rank:** ${rank} | **House:** ${houseStr}`,
        `**Nation:** ${user.nation || '*None founded*'}`,
        ``,
        `**${ancestry?.name || 'Unknown'} · ${UPBRINGINGS[(user.upbringing || '').toUpperCase()]?.name || '?'} · ${PROFESSIONS[(user.profession || '').toUpperCase()]?.name || '?'}**`,
        ``,
        `**Statistics:**`,
        stats.join('\n'),
        user.description ? `\n**Biography:**\n*${user.description}*` : null,
    ].filter(s => s !== null).join('\n');

    const embed = new EmbedBuilder()
        .setTitle('📜 IMPERIAL CREDENTIALS')
        .setColor(houseData?.color || 0xFFD700)
        .setDescription(descLines)
        .setThumbnail(user.avatar_url || null);

    return interaction.editReply({ embeds: [embed] });
}

async function handleRelation(interaction) {
    return interaction.editReply({ content: 'Diplomatic relations feature coming soon.' });
}

module.exports = {
    handleOriginsIntro, handleOriginsLogic, renderFreeBoostView, handleModal, handleProfile, handleRelation
};
