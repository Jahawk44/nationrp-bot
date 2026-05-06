const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('admin')
        .setDescription('Imperial High Command Protocols.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommandGroup(g => g.setName('user').setDescription('Player lineage management.')
            .addSubcommand(s => s.setName('edit').setDescription('Edit a player record.')
                .addStringOption(o => o.setName('target').setDescription('Player').setRequired(true).setAutocomplete(true))
                .addStringOption(o => o.setName('field').setDescription('Stat/Data').setRequired(true).addChoices(
                    { name: '💰 Balance', value: 'balance' }, { name: '🏛️ National Wealth', value: 'wealth' }, { name: '💎 Exotics', value: 'exotics' },
                    { name: '🥩 Food Surplus', value: 'food_surplus' }, { name: '⛓️ Ores', value: 'ores' }, { name: '💠 Vitale', value: 'vitale' },
                    { name: '💪 Strength', value: 'attr_str' }, { name: '🏃 Motoric', value: 'attr_mot' }, { name: '💀 Menace', value: 'attr_men' },
                    { name: '🧠 Intelligence', value: 'attr_int' }, { name: '🕯️ Wisdom', value: 'attr_wis' }, { name: '🎭 Charisma', value: 'attr_cha' },
                    { name: '🌍 Nation Name', value: 'nation_name' }, { name: '🧬 Ancestry', value: 'ancestry' }, { name: '📜 Upbringing', value: 'upbringing' },
                    { name: '⚒️ Profession', value: 'profession' }, { name: '⚖️ Status', value: 'status' }, { name: '👤 Username', value: 'username' }
                ))
                .addStringOption(o => o.setName('value').setDescription('Value').setRequired(true).setAutocomplete(true))
            )
            .addSubcommand(s => s.setName('purge').setDescription('Completely erase a player lineage.')
                .addStringOption(o => o.setName('target').setDescription('The user to purge').setRequired(true).setAutocomplete(true))
            )
        )
        .addSubcommandGroup(g => g.setName('town').setDescription('Settlement management.')
            .addSubcommand(s => s.setName('edit').setDescription('Edit settlement data.')
                .addIntegerOption(o => o.setName('id').setDescription('Town ID').setRequired(true))
                .addStringOption(o => o.setName('field').setDescription('Stat/Data').setRequired(true).addChoices(
                    { name: '🏙️ Town Name', value: 'name' }, { name: '🌍 Terrain Type', value: 'terrain_type' },
                    { name: '🗺️ Plots Total', value: 'plots_total' }, { name: '🌱 Fertility', value: 'fertility' }
                ))
                .addStringOption(o => o.setName('value').setDescription('Value').setRequired(true).setAutocomplete(true))
            )
            .addSubcommand(s => s.setName('remove').setDescription('Remove a settlement.')
                .addIntegerOption(o => o.setName('id').setDescription('Town ID').setRequired(true))
            )
        )
        .addSubcommandGroup(g => g.setName('relation').setDescription('Faction diplomacy.')
            .addSubcommand(s => s.setName('set').setDescription('Override faction standing.')
                .addStringOption(o => o.setName('target').setDescription('Player').setRequired(true).setAutocomplete(true))
                .addStringOption(o => o.setName('faction').setDescription('Faction').setRequired(true).setAutocomplete(true))
                .addIntegerOption(o => o.setName('score').setDescription('Score').setRequired(true))
            )
        )
        .addSubcommandGroup(g => g.setName('system').setDescription('Global protocol management.')
            .addSubcommand(s => s.setName('edit').setDescription('Edit a global protocol.')
                .addStringOption(o => o.setName('key').setDescription('Variable').setRequired(true).addChoices(
                    { name: 'Turn', value: 'current_turn' }, 
                    { name: 'Ruler', value: 'empire_ruler' }
                ))
                .addStringOption(o => o.setName('value').setDescription('Value').setRequired(true))
            )
            .addSubcommand(s => s.setName('whitelist').setDescription('Manage GM access.')
                .addStringOption(o => o.setName('action').setDescription('Grant or revoke').setRequired(true).addChoices(
                    { name: 'Grant', value: 'add' },
                    { name: 'Revoke', value: 'remove' }
                ))
                .addStringOption(o => o.setName('user').setDescription('Target User').setRequired(true).setAutocomplete(true))
            )
        ),
        
    async execute(interaction) {
        const OWNER_ID = '317883862258548737';
        const isOwner = interaction.user.id === OWNER_ID;
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

        if (!isAdmin && !isOwner) return interaction.reply({ content: 'Access Denied: Imperial clearance required.', ephemeral: true });
        
        await interaction.deferReply({ ephemeral: true });
        const db = interaction.client.db;
        const group = interaction.options.getSubcommandGroup();
        const sub = interaction.options.getSubcommand();

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
            const id = interaction.options.getInteger('id');
            if (sub === 'edit') {
                const field = interaction.options.getString('field'), val = interaction.options.getString('value');
                await db.run(`UPDATE towns SET ${field} = ? WHERE id = ?`, val, id);
                return await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('🏘️ TOWN SYSTEM EDIT').setDescription(`Town ID \`${id}\` record \`${field}\` set to \`${val}\`.`).setColor(0x0099FF)] });
            }
            if (sub === 'remove') {
                await db.run('DELETE FROM buildings WHERE town_id = ?', id);
                await db.run('DELETE FROM towns WHERE id = ?', id);
                return await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('⚠️ CRITICAL PROTOCOL: TOWN PURGED').setDescription(`Town ID \`${id}\` has been razed to the ground.`).setColor(0xFF0000)] });
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
                if (!isOwner) return interaction.editReply({ content: '⚠️ ACCESS VOID: Only the Sovereign (Owner) can modify the GM Whitelist.' });
                const action = interaction.options.getString('action'), tid = interaction.options.getString('user');
                if (action === 'add') {
                    await db.run('INSERT OR IGNORE INTO gm_whitelist (user_id) VALUES (?)', tid);
                    return await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('📜 WHITELIST UPDATED').setDescription(`<@${tid}> has been granted Game Master protocols.`).setColor(0x00FFBB)] });
                } else {
                    await db.run('DELETE FROM gm_whitelist WHERE user_id = ?', tid);
                    return await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('📜 WHITELIST UPDATED').setDescription(`<@${tid}> has been stripped of Game Master protocols.`).setColor(0xFF0000)] });
                }
            }
        }
    }
};
