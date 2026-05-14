const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { isOwner, isGM } = require('../utils/helpers');
const { BUILDINGS } = require('../data/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin')
        .setDescription('Imperial High Command Protocols.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommandGroup(g => g.setName('user').setDescription('Player lineage management.')
            .addSubcommand(s => s.setName('edit').setDescription('Edit a player record.')
                .addStringOption(o => o.setName('target').setDescription('Player').setRequired(true).setAutocomplete(true))
                .addStringOption(o => o.setName('field').setDescription('Stat/Data').setRequired(true).addChoices(
                    { name: '🥮 Balance', value: 'balance' }, { name: '⚖️ National Wealth', value: 'wealth' }, { name: '💎 Exotics', value: 'exotics' },
                    { name: '🥩 Food Surplus', value: 'food_surplus' }, { name: '⛓️ Ores', value: 'ores' }, { name: '💠 Vitale', value: 'vitale' },
                    { name: '💪 Strength', value: 'attr_str' }, { name: '🏃 Motoric', value: 'attr_mot' }, { name: '💀 Menace', value: 'attr_men' },
                    { name: '🧠 Intelligence', value: 'attr_int' }, { name: '🕯️ Wisdom', value: 'attr_wis' }, { name: '🎭 Charisma', value: 'attr_cha' },
                    { name: '🌍 Nation Name', value: 'nation' }, { name: '🧬 Ancestry', value: 'ancestry' }, { name: '📜 Upbringing', value: 'upbringing' },
                    { name: '⚒️ Profession', value: 'profession' }, { name: '🎂 Age', value: 'age' }, { name: '📝 Biography', value: 'description' },
                    { name: '👑 Roleplay Name', value: 'ruler_name' },
                    { name: '⚖️ Status', value: 'status' }, { name: '👤 Username', value: 'username' }
                ))
                .addStringOption(o => o.setName('value').setDescription('Value').setRequired(true).setAutocomplete(true))
                .addStringOption(o => o.setName('channel_id').setDescription('Set notification channel for this player').setRequired(false))
            )
            .addSubcommand(s => s.setName('purge').setDescription('Completely erase a player lineage.')
                .addStringOption(o => o.setName('target').setDescription('The user to purge').setRequired(true).setAutocomplete(true))
            )
        )
        .addSubcommand(s => s.setName('dashboard').setDescription('Global GM overview dashboard.'))
        .addSubcommandGroup(g => g.setName('town').setDescription('Settlement management.')
            .addSubcommand(s => s.setName('edit').setDescription('Edit settlement data.')
                .addStringOption(o => o.setName('id').setDescription('Settlement').setRequired(true).setAutocomplete(true))
                .addStringOption(o => o.setName('field').setDescription('Stat/Data').setRequired(true).addChoices(
                    { name: '🏙️ Town Name', value: 'name' }, { name: '🌍 Terrain Type', value: 'terrain_type' },
                    { name: '🗺️ Plots Total', value: 'plots_total' }, { name: '🌱 Fertility', value: 'fertility' }
                ))
                .addStringOption(o => o.setName('value').setDescription('Value').setRequired(true).setAutocomplete(true))
            )
            .addSubcommand(s => s.setName('remove').setDescription('Remove a settlement.')
                .addStringOption(o => o.setName('id').setDescription('Settlement').setRequired(true).setAutocomplete(true))
            )
            .addSubcommand(s => s.setName('list').setDescription('List player settlements.')
                .addStringOption(o => o.setName('user').setDescription('Player').setRequired(true).setAutocomplete(true))
            )
        )
        .addSubcommandGroup(g => g.setName('nation').setDescription('National governance oversight.')
            .addSubcommand(s => s.setName('view').setDescription('Inspect national credentials.')
                .addStringOption(o => o.setName('target').setDescription('Player').setRequired(true).setAutocomplete(true))
            )
            .addSubcommand(s => s.setName('edit').setDescription('Modify national parameters.')
                .addStringOption(o => o.setName('target').setDescription('Player').setRequired(true).setAutocomplete(true))
                .addStringOption(o => o.setName('field').setDescription('Stat').setRequired(true).addChoices(
                    { name: '🌍 Nation Name', value: 'nation' },
                    { name: '👑 Ruler Name', value: 'ruler_name' },
                    { name: '⚖️ Wealth', value: 'wealth' }
                ))
                .addStringOption(o => o.setName('value').setDescription('Value').setRequired(true))
            )
            .addSubcommand(s => s.setName('remove').setDescription('Dissolve a nation.')
                .addStringOption(o => o.setName('target').setDescription('Player').setRequired(true).setAutocomplete(true))
            )
        )
        .addSubcommandGroup(g => g.setName('relation').setDescription('Faction diplomacy.')
            .addSubcommand(s => s.setName('set').setDescription('Override faction standing.')
                .addStringOption(o => o.setName('target').setDescription('Player').setRequired(true).setAutocomplete(true))
                .addStringOption(o => o.setName('faction').setDescription('Faction').setRequired(true).setAutocomplete(true))
                .addIntegerOption(o => o.setName('score').setDescription('Score').setRequired(true))
            )
        )
        .addSubcommandGroup(g => g.setName('event').setDescription('GM event tools.')
            .addSubcommand(s => s.setName('fire').setDescription('Trigger a world event on a player.')
                .addStringOption(o => o.setName('target').setDescription('Player').setRequired(true).setAutocomplete(true))
                .addStringOption(o => o.setName('type').setDescription('Event type').setRequired(true).addChoices(
                    { name: '🌾 Famine',           value: 'famine' },
                    { name: '☠️ Plague',           value: 'plague' },
                    { name: '⚔️ Raid',             value: 'raid' },
                    { name: '🌻 Bumper Harvest',   value: 'harvest' },
                    { name: '👑 Noble Unrest',     value: 'noble_unrest' },
                    { name: '🏛️ Imperial Favor',   value: 'imperial_favor' },
                    { name: '🔗 Servus Uprising',  value: 'servus_uprising' },
                    { name: '⚖️ War Tribute',      value: 'tribute' }
                ))
                .addIntegerOption(o => o.setName('severity').setDescription('Severity (1-3)').setRequired(false).setMinValue(1).setMaxValue(3))
                .addIntegerOption(o => o.setName('amount').setDescription('Amount (for tribute)').setRequired(false))
            )
            .addSubcommand(s => s.setName('undo').setDescription('Reverse a recent event.')
                .addStringOption(o => o.setName('target').setDescription('Player').setRequired(true).setAutocomplete(true))
                .addStringOption(o => o.setName('event_type').setDescription('Event type to undo').setRequired(true).addChoices(
                    { name: '🌾 Famine',           value: 'famine' },
                    { name: '☠️ Plague',           value: 'plague' },
                    { name: '⚔️ Raid',             value: 'raid' },
                    { name: '🌻 Bumper Harvest',   value: 'harvest' },
                    { name: '👑 Noble Unrest',     value: 'noble_unrest' },
                    { name: '🏛️ Imperial Favor',   value: 'imperial_favor' },
                    { name: '🔗 Servus Uprising',  value: 'servus_uprising' },
                    { name: '⚖️ War Tribute',      value: 'tribute' }
                ))
            )
            .addSubcommand(s => s.setName('list').setDescription('View event history.')
                .addStringOption(o => o.setName('target').setDescription('Player').setRequired(true).setAutocomplete(true))
            )
        )
        .addSubcommandGroup(g => g.setName('system').setDescription('Global protocol management.')
            .addSubcommand(s => s.setName('edit').setDescription('Edit a global protocol.')
                .addStringOption(o => o.setName('key').setDescription('Variable').setRequired(true).addChoices(
                    { name: 'Turn', value: 'current_turn' },
                    { name: 'Ruler', value: 'empire_ruler' },
                    { name: 'Vitale Base', value: 'vitale_base' }
                ))
                .addStringOption(o => o.setName('value').setDescription('Value').setRequired(true))
            )
            .addSubcommand(s => s.setName('whitelist').setDescription('Manage GM access.')
                .addStringOption(o => o.setName('action').setDescription('Grant or revoke').setRequired(true).addChoices(
                    { name: 'Grant', value: 'add' },
                    { name: 'Revoke', value: 'remove' },
                    { name: 'List', value: 'list' }
                ))
                .addStringOption(o => o.setName('user').setDescription('Target User (ignore if listing)').setRequired(false).setAutocomplete(true))
            )
        ),
        
    async execute(interaction) {
        const db = interaction.client.db;
        const authorized = await isGM(db, interaction.user.id);

        if (!authorized) return interaction.reply({ content: 'Access Denied: Imperial High Command clearance required.', ephemeral: true });
        
        await interaction.deferReply({ ephemeral: true });
        const group = interaction.options.getSubcommandGroup();
        const sub = interaction.options.getSubcommand();

        if (sub === 'dashboard') {
            const currentTurn = (await db.get('SELECT value FROM global_settings WHERE key=?', 'current_turn'))?.value || '1';
            const ONE_DAY = 24 * 60 * 60 * 1000;
            const now = Date.now();
            const weekAgo = now - 7 * ONE_DAY;
            const users = await db.all('SELECT * FROM users WHERE status="active" ORDER BY COALESCE(wealth,0) DESC');

            let lines = [];
            for (const u of users) {
                const rankEmoji = u.nation ? '👑' : (u.player_rank === 'DOMINAR' ? '🏡' : '🎓');
                const label = u.status === 'deposed' ? '⚠️ DEPOSED' : (u.nation || u.ruler_name || u.username || u.id);
                const foodText = (u.food_surplus || 0) <= 0 ? '⚠️FAMINE' : `${u.food_surplus || 0}🥩`;
                const stabWarn = (u.rate_stab || 0) <= -3 ? '🔴' : '';
                const prestWarn = (u.rate_prest || 0) <= -2 ? '🔴' : '';
                lines.push(
                    `${rankEmoji} **${label}** | ${u.wealth || 0}⚖️ | ${foodText} | ` +
                    `${u.mil_infantry || 0}⚔️${u.mil_cavalry || 0}🐎${u.mil_ranged || 0}🏹${u.mil_siege || 0}🪨 | ` +
                    `Stab:${u.rate_stab || 0}${stabWarn} Prest:${u.rate_prest || 0}${prestWarn}`
                );
            }

            let taxedCount = 0;
            for (const u of users) {
                if ((u.last_tax || 0) > weekAgo) taxedCount++;
            }

            const embed = new EmbedBuilder()
                .setTitle(`📊 GM DASHBOARD — Turn ${currentTurn}`)
                .setDescription(lines.join('\n') || '*No active players.*')
                .setColor(0x0099FF)
                .setFooter({ text: `${users.length} active | ${taxedCount} taxed this week | ${users.length - taxedCount} not taxed` });

            return await interaction.editReply({ embeds: [embed] });
        }

        if (group === 'user') {
            const targetId = interaction.options.getString('target');
            if (sub === 'purge') {
                const embed = new EmbedBuilder().setTitle('⚠️ CRITICAL PROTOCOL: PURGE').setDescription(`Are you certain you wish to erase the lineage of <@${targetId}>?\n\n*This action is irreversible.*`).setColor(0xFF0000);
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`purgeconfirm_yes_${targetId}`).setLabel('YES (Purge)').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId(`purgeconfirm_no`).setLabel('NO (Cancel)').setStyle(ButtonStyle.Secondary)
                );
                return await interaction.editReply({ embeds: [embed], components: [row] });
            }
            if (sub === 'edit') {
                const field = interaction.options.getString('field'), val = interaction.options.getString('value');
                const channelId = interaction.options.getString('channel_id');

                if (channelId) {
                    try {
                        const chan = await interaction.client.channels.fetch(channelId);
                        if (!chan) throw new Error('not found');
                        await db.run('UPDATE users SET notification_channel = ? WHERE id = ?', channelId, targetId);
                        return await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('👤 SYSTEM EDIT').setDescription(`Notification channel for <@${targetId}> set to <#${channelId}>.`).setColor(0x0099FF)] });
                    } catch (_) {
                        return interaction.editReply({ content: '⚠️ Channel not found. Please provide a valid channel ID.' });
                    }
                }

                if (field === 'town_name') {
                    const t = await db.get('SELECT id FROM towns WHERE user_id = ? ORDER BY id ASC LIMIT 1', targetId);
                    if (t) await db.run('UPDATE towns SET name = ? WHERE id = ?', val, t.id);
                    else return interaction.editReply({ content: 'User has no towns to rename.' });
                } else {
                    await db.run(`UPDATE users SET ${field} = ? WHERE id = ?`, val, targetId);
                }
                return await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('👤 SYSTEM EDIT').setDescription(`<@${targetId}> record \`${field}\` set to \`${val}\`.`).setColor(0x0099FF)] });
            }
        }

        if (group === 'town') {
            if (sub === 'list') {
                const targetId = interaction.options.getString('user');
                const towns = await db.all('SELECT * FROM towns WHERE user_id = ?', targetId);
                if (!towns.length) return interaction.editReply({ content: 'User has no settlements.' });
                
                const embed = new EmbedBuilder().setTitle(`🏙️ SETTLEMENTS: <@${targetId}>`).setColor(0x0099FF);
                for (const t of towns) {
                    const buildings = await db.all('SELECT type FROM buildings WHERE town_id = ?', t.id);
                    const bList = buildings.map(b => {
                        const bData = BUILDINGS[b.type.toUpperCase()];
                        return `${bData?.emoji || '🏗️'} ${bData?.name || b.type}`;
                    }).join(', ') || '*No Buildings*';
                    embed.addFields({ name: `${t.name} (#${t.id})`, value: `**Terrain**: ${t.terrain_type}\n**Plots**: ${t.plots_total}\n**Buildings**: ${bList}` });
                }
                return await interaction.editReply({ embeds: [embed] });
            }

            const idStr = interaction.options.getString('id');
            const id = idStr ? parseInt(idStr, 10) : NaN;
            if (Number.isNaN(id)) return interaction.editReply({ content: '⚠️ Invalid settlement reference.' });
            const town = await db.get('SELECT name FROM towns WHERE id = ?', id);
            const townLabel = town ? `${town.name} (#${id})` : `#${id}`;

            if (sub === 'edit') {
                const field = interaction.options.getString('field'), val = interaction.options.getString('value');
                await db.run(`UPDATE towns SET ${field} = ? WHERE id = ?`, val, id);
                return await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('🏘️ TOWN SYSTEM EDIT').setDescription(`Settlement \`${townLabel}\` record \`${field}\` set to \`${val}\`.`).setColor(0x0099FF)] });
            }
            if (sub === 'remove') {
                await db.run('DELETE FROM buildings WHERE town_id = ?', id);
                await db.run('DELETE FROM towns WHERE id = ?', id);
                return await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('⚠️ CRITICAL PROTOCOL: TOWN PURGED').setDescription(`Settlement \`${townLabel}\` has been razed to the ground.`).setColor(0xFF0000)] });
            }
        }

        if (group === 'nation') {
            const targetId = interaction.options.getString('target');
            const u = await db.get('SELECT * FROM users WHERE id = ?', targetId);
            if (!u) return interaction.editReply({ content: 'Lineage not found.' });

            if (sub === 'view') {
                const embed = new EmbedBuilder().setTitle(`🏛️ NATIONAL STATUS: ${u.nation || 'Unclaimed'}`)
                    .setColor(0xFFD700)
                    .setThumbnail(u.avatar_url || null)
                    .addFields(
                        { name: '👤 Ruler', value: u.ruler_name || u.username, inline: true },
                        { name: '⚖️ Wealth', value: `⚖️${u.wealth || 0}`, inline: true },
                        { name: '📈 Status', value: u.status, inline: true }
                    );
                return await interaction.editReply({ embeds: [embed] });
            }
            if (sub === 'edit') {
                const field = interaction.options.getString('field'), val = interaction.options.getString('value');
                await db.run(`UPDATE users SET ${field} = ? WHERE id = ?`, val, targetId);
                return await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('🏛️ NATION EDIT').setDescription(`<@${targetId}> nation \`${field}\` set to \`${val}\`.`).setColor(0x00FFBB)] });
            }
            if (sub === 'remove') {
                await db.run('UPDATE users SET nation = NULL, ruler_name = NULL WHERE id = ?', targetId);
                return await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('⚠️ NATION DISSOLVED').setDescription(`The sovereignty of <@${targetId}> has been revoked.`).setColor(0xFF0000)] });
            }
        }

        if (group === 'event') {
            const { handleEventFire, handleEventUndo, handleEventList } = require('../commands/atlas/events');
            const targetId = interaction.options.getString('target');
            if (sub === 'fire') {
                const type = interaction.options.getString('type');
                const severity = interaction.options.getInteger('severity') || 1;
                const amount = interaction.options.getInteger('amount') || 0;
                return await handleEventFire(interaction, type, targetId, severity, amount);
            }
            if (sub === 'undo') {
                const type = interaction.options.getString('event_type');
                return await handleEventUndo(interaction, targetId, type);
            }
            if (sub === 'list') {
                return await handleEventList(interaction, targetId);
            }
        }

        if (group === 'relation') {
            if (sub === 'set') {
                const targetId = interaction.options.getString('target'), faction = interaction.options.getString('faction'), score = interaction.options.getInteger('score');
                await db.run('INSERT OR REPLACE INTO relations (user_id, faction_name, score) VALUES (?, ?, ?)', targetId, faction, score);
                return await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('🤝 RELATION OVERRIDE').setDescription(`<@${targetId}> standing with **${faction}** set to **${score}**.`).setColor(0x00FFBB)] });
            }
        }

        if (group === 'system') {
            if (sub === 'edit') {
                const key = interaction.options.getString('key'), val = interaction.options.getString('value');
                await db.run('UPDATE global_settings SET value = ? WHERE key = ?', val, key);
                return await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('⚙️ SYSTEM EDIT').setDescription(`Protocol \`${key}\` set to \`${val}\`.`).setColor(0x00FFBB)] });
            }
            if (sub === 'whitelist') {
                const action = interaction.options.getString('action');
                
                if (action === 'list') {
                    const gms = await db.all('SELECT user_id FROM gm_whitelist');
                    const gmList = gms.length ? gms.map(g => `<@${g.user_id}> (\`${g.user_id}\`)`).join('\n') : '*No Game Masters whitelisted.*';
                    return await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('📜 GM WHITELIST').setDescription(gmList).setColor(0x00BFFF)] });
                }

                if (!isOwner(interaction.user.id)) return interaction.editReply({ content: '⚠️ ACCESS VOID: Only the Sovereign (Owner) can modify the GM Whitelist.' });
                const tid = interaction.options.getString('user');
                if (!tid) return interaction.editReply({ content: '⚠️ Target user required for this action.' });

                if (action === 'add') {
                    await db.run('INSERT OR IGNORE INTO gm_whitelist (user_id) VALUES (?)', tid);
                    return await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('📜 WHITELIST UPDATED').setDescription(`<@${tid}> has been granted Game Master protocols.`).setColor(0x00FFBB)] });
                } else {
                    await db.run('DELETE FROM gm_whitelist WHERE user_id = ?', tid);
                    return await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('📜 WHITELIST UPDATED').setDescription(`<@${tid}> has been stripped of Game Master protocols.`).setColor(0xFF0000)] });
                }
            }
        }
    },

    async handleAudit(interaction, action, args) {
        const db = interaction.client.db;
        const sub = args[0]; // approve or deny
        const tid = args[1]; // target id
        
        await interaction.deferUpdate();

        if (sub === 'approve') {
            await db.run('UPDATE users SET status = "active" WHERE id = ?', tid);
            const embed = EmbedBuilder.from(interaction.message.embeds[0]).setColor(0x00FF88).setTitle('✅ LINEAGE APPROVED');
            await interaction.editReply({ embeds: [embed], components: [] });
            
            try {
                const user = await interaction.client.users.fetch(tid);
                if (user) await user.send('📜 **Imperial Notice:** Your character credentials have been **Approved**. You may now access all `/atlas` protocols.');
            } catch (e) { console.log('Could not DM user ' + tid); }
        } else if (sub === 'deny') {
            await db.run('UPDATE users SET status = "pending" WHERE id = ?', tid);
            const embed = EmbedBuilder.from(interaction.message.embeds[0]).setColor(0xFF0000).setTitle('❌ LINEAGE DENIED');
            await interaction.editReply({ embeds: [embed], components: [] });

            try {
                const user = await interaction.client.users.fetch(tid);
                if (user) await user.send('📜 **Imperial Notice:** Your character credentials have been **Denied** by the High Command. Please review your biography and try `/atlas begin` again.');
            } catch (e) { console.log('Could not DM user ' + tid); }
        }
    }
};
