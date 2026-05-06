const { Events, EmbedBuilder } = require('discord.js');
const { BUILDINGS, RESOURCES, TERRAINS, ANCESTRIES, UPBRINGINGS, PROFESSIONS, FACTIONS } = require('../data/constants');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        const client = interaction.client;
        console.log(`[ATLAS] [${new Date().toISOString()}] Interaction received: ${interaction.type} (Name: ${interaction.commandName || interaction.customId})`);
        
        try {
            if (interaction.isAutocomplete()) {
                const focusedOption = interaction.options.getFocused(true);
                const db = client.db;
                
                if (focusedOption.name === 'user' || focusedOption.name === 'target' || focusedOption.name === 'partner') {
                    const users = await db.all('SELECT id, username FROM users WHERE status = "active"');
                    const filtered = users.filter(u => u.username.toLowerCase().includes(focusedOption.value.toLowerCase()));
                    await interaction.respond(filtered.slice(0, 25).map(u => ({ name: u.username, value: u.id })));
                } else if (focusedOption.name === 'town') {
                    const towns = await db.all('SELECT id, name FROM towns WHERE user_id = ?', interaction.user.id);
                    const filtered = towns.filter(t => t.name.toLowerCase().includes(focusedOption.value.toLowerCase()));
                    await interaction.respond(filtered.slice(0, 25).map(t => ({ name: t.name, value: t.id.toString() })));
                } else if (focusedOption.name === 'type') {
                    const sub = interaction.options.getSubcommand(false);
                    const townId = interaction.options.getString('town');
                    let buildingKeys = Object.keys(BUILDINGS);
                    
                    if (sub === 'upgrade' && townId) {
                        const currentBuildings = await db.all('SELECT type FROM buildings WHERE town_id = ?', townId);
                        const types = currentBuildings.map(b => b.type.toUpperCase());
                        buildingKeys = buildingKeys.filter(k => {
                            const b = BUILDINGS[k];
                            return b.upgrade_from && types.includes(b.upgrade_from);
                        });
                    } else if (sub === 'build' || sub === 'demolish') {
                        if (sub === 'build') buildingKeys = buildingKeys.filter(k => BUILDINGS[k].tier === 1);
                        if (sub === 'demolish' && townId) {
                            const currentBuildings = await db.all('SELECT type FROM buildings WHERE town_id = ?', townId);
                            const types = [...new Set(currentBuildings.map(b => b.type.toUpperCase()))];
                            buildingKeys = buildingKeys.filter(k => types.includes(k));
                        }
                    }
                    
                    const filtered = buildingKeys.filter(k => k.toLowerCase().includes(focusedOption.value.toLowerCase()));
                    await interaction.respond(filtered.slice(0, 25).map(k => ({ name: BUILDINGS[k].name, value: k })));
                } else if (focusedOption.name === 'give_resource' || focusedOption.name === 'ask_resource') {
                    const resKeys = Object.keys(RESOURCES);
                    const filtered = resKeys.filter(k => k.toLowerCase().includes(focusedOption.value.toLowerCase()));
                    await interaction.respond(filtered.slice(0, 25).map(k => ({ name: RESOURCES[k].name, value: k.toLowerCase() })));
                } else if (focusedOption.name === 'terrain_type') {
                    const terrainKeys = Object.keys(TERRAINS);
                    const filtered = terrainKeys.filter(k => k.toLowerCase().includes(focusedOption.value.toLowerCase()));
                    await interaction.respond(filtered.slice(0, 25).map(k => ({ name: TERRAINS[k].name, value: k })));
                } else if (focusedOption.name === 'value') {
                    const field = interaction.options.getString('field');
                    let list = [];
                    if (field === 'ancestry') list = Object.keys(ANCESTRIES).map(k => ({ name: ANCESTRIES[k].name, value: k }));
                    else if (field === 'upbringing') list = Object.keys(UPBRINGINGS).map(k => ({ name: UPBRINGINGS[k].name, value: k }));
                    else if (field === 'profession') list = Object.keys(PROFESSIONS).map(k => ({ name: PROFESSIONS[k].name, value: k }));
                    else if (field === 'terrain_type') list = Object.keys(TERRAINS).map(k => ({ name: TERRAINS[k].name, value: k }));
                    else if (field === 'status') list = [{ name: 'Pending', value: 'pending' }, { name: 'Active', value: 'active' }, { name: 'Dead', value: 'dead' }];
                    
                    const filtered = list.filter(i => i.name.toLowerCase().includes(focusedOption.value.toLowerCase()));
                    await interaction.respond(filtered.slice(0, 25));
                } else if (focusedOption.name === 'faction') {
                    const filtered = FACTIONS.filter(f => f.toLowerCase().includes(focusedOption.value.toLowerCase()));
                    await interaction.respond(filtered.slice(0, 25).map(f => ({ name: f, value: f })));
                }
                return;
            }

            if (interaction.isChatInputCommand()) {
                const command = client.commands.get(interaction.commandName);
                if (!command) return;
                await command.execute(interaction);
            }

            if (interaction.isButton()) {
                const [action, ...args] = interaction.customId.split('_');
                const atlasCmd = client.commands.get('atlas');
                
                if (action === 'purgeconfirm') {
                    if (args[0] === 'yes') {
                        const tid = args[1];
                        await client.db.run('DELETE FROM users WHERE id = ?', tid);
                        await client.db.run('DELETE FROM towns WHERE user_id = ?', tid);
                        await client.db.run('DELETE FROM buildings WHERE town_id IN (SELECT id FROM towns WHERE user_id = ?)', tid);
                        await client.db.run('DELETE FROM relations WHERE user_id = ?', tid);
                        await interaction.update({ embeds: [new EmbedBuilder().setTitle('👤 USER PURGED').setDescription(`Lineage erased: <@${tid}>.`).setColor(0xFF0000)], components: [] });
                    } else await interaction.update({ content: 'Purge protocol cancelled.', embeds: [], components: [] });
                    return;
                }
                
                if (atlasCmd && atlasCmd.handleButton) {
                    await atlasCmd.handleButton(interaction, action, args);
                }
            }
        } catch (error) {
            if (interaction.isAutocomplete()) return;
            console.error('[ATLAS] INTERACTION ERROR:', error);
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: 'Critical system error.', ephemeral: true });
                } else {
                    await interaction.editReply({ content: 'Critical system error.' });
                }
            } catch (e) {}
        }
    }
};
