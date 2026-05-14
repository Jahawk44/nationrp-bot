const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { BUILDINGS, TERRAINS } = require('../data/constants');
const { decodeFreeDist } = require('../utils/helpers');

const character = require('./atlas/character');
const town = require('./atlas/town');
const leaderboard = require('./atlas/leaderboard');
const economy = require('./atlas/economy');
const actionMod = require('./atlas/action');
const trade = require('./atlas/trade');
const diplomacy = require('./atlas/diplomacy');
const warfare = require('./atlas/warfare');
const admin = require('./admin');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('atlas')
        .setDescription('Atlas AI: Imperial Interface')
        .addSubcommand(s => s.setName('begin').setDescription('Start your Imperial Origins.'))
        .addSubcommand(s => s.setName('tax').setDescription('Daily tax collection cycle.'))
        .addSubcommand(s => s.setName('donate').setDescription('Donate Balance (:coin:) to National Wealth (⚖️).').addIntegerOption(o => o.setName('amount').setDescription('Amount of Wealth to buy (1 ⚖️ = 1,000 :coin:).').setRequired(true)))
        .addSubcommand(s => s.setName('gift').setDescription('Gift a resource to another player.')
            .addStringOption(o => o.setName('target').setDescription('Target Player').setRequired(true).setAutocomplete(true))
            .addStringOption(o => o.setName('resource').setDescription('Resource to gift').setRequired(true).addChoices(
                { name: 'Balance', value: 'balance' }, { name: 'Food', value: 'food_surplus' }, { name: 'Ores', value: 'ores' }, { name: 'Vitale', value: 'vitale' }, { name: 'Exotics', value: 'exotics' }, { name: 'Servus', value: 'servus' }
            ))
            .addIntegerOption(o => o.setName('amount').setDescription('Amount to gift').setRequired(true))
        )
        .addSubcommand(s => s.setName('trade').setDescription('Propose an interactive trade with another player.')
            .addStringOption(o => o.setName('target').setDescription('Target Player').setRequired(true).setAutocomplete(true))
        )
        .addSubcommand(s => s.setName('population').setDescription('View population, noble, and military census.'))
        .addSubcommand(s => s.setName('balance').setDescription('View personal and national wealth.'))
        .addSubcommand(s => s.setName('leaderboard').setDescription('View imperial rankings.')
            .addStringOption(o => o.setName('category').setDescription('Rank category').addChoices(
                { name: 'Total Score', value: 'total' }, { name: 'Economy', value: 'economy' },
                { name: 'Defense', value: 'defense' }, { name: 'Stability', value: 'stability' },
                { name: 'Offense', value: 'offense' }
            ))
        )
        .addSubcommand(s => s.setName('profile').setDescription('Inspect player lineage.').addStringOption(o => o.setName('user').setDescription('Player').setRequired(false).setAutocomplete(true)))
        .addSubcommand(s => s.setName('diplomacy').setDescription('Diplomatic ledger with faction details and treaties.'))
        .addSubcommand(s => s.setName('empire').setDescription('Imperial status and Vitale market.'))
        .addSubcommand(s => s.setName('town').setDescription('Open the Town Management dashboard.'))
        .addSubcommandGroup(g => g.setName('action').setDescription('World actions.')
            .addSubcommand(s => s.setName('scout').setDescription('Scout an enemy settlement.')
                .addStringOption(o => o.setName('user').setDescription('Target Player').setRequired(true).setAutocomplete(true))
                .addStringOption(o => o.setName('town').setDescription('Name of the target town').setRequired(true).setAutocomplete(true))
            )
            .addSubcommand(s => s.setName('recruit').setDescription('Recruit military units from your commoner population.')
                .addStringOption(o => o.setName('type').setDescription('Unit type').setRequired(true).addChoices(
                    { name: '⚔️ Infantry', value: 'infantry' },
                    { name: '🐎 Cavalry', value: 'cavalry' },
                    { name: '🏹 Ranged', value: 'ranged' },
                    { name: '🪨 Siege', value: 'siege' },
                    { name: '🗡️ Mercenary', value: 'mercenary' }
                ))
                .addIntegerOption(o => o.setName('amount').setDescription('Number of units to recruit').setRequired(true).setMinValue(1))
            )
            .addSubcommand(s => s.setName('battle').setDescription('Declare field battle against another player.')
                .addStringOption(o => o.setName('user').setDescription('Target Player').setRequired(true).setAutocomplete(true))
            )
            .addSubcommand(s => s.setName('warfare').setDescription('Lay siege to an enemy settlement (Sovereign only).')
                .addStringOption(o => o.setName('user').setDescription('Target Player').setRequired(true).setAutocomplete(true))
                .addStringOption(o => o.setName('target_town').setDescription('Name of the target town').setRequired(true).setAutocomplete(true))
            )
            .addSubcommand(s => s.setName('raid').setDescription('Launch a raid on another player.')
                .addStringOption(o => o.setName('user').setDescription('Target Player').setRequired(true).setAutocomplete(true))
                .addStringOption(o => o.setName('town').setDescription('Target town (optional)').setRequired(false).setAutocomplete(true))
            )
        )
        .addSubcommand(s => s.setName('roll').setDescription('Open the Dice Oracle GUI.'))
        .addSubcommandGroup(g => g.setName('gm').setDescription('Game Master Oracle (Whitelisted only)')
            .addSubcommand(s => s.setName('roll').setDescription('Roll a skill check for a player.')
                .addStringOption(o => o.setName('user').setDescription('Target Player').setRequired(true).setAutocomplete(true))
                .addStringOption(o => o.setName('stat').setDescription('Stat to roll').setRequired(true).setAutocomplete(true))
                .addIntegerOption(o => o.setName('dc').setDescription('Difficulty Class (DC)').setRequired(true))
                .addStringOption(o => o.setName('substat').setDescription('Sub-stat to roll').setAutocomplete(true))
                .addStringOption(o => o.setName('type').setDescription('Die Type (Default: d20)').setChoices({ name: 'd4', value: '4' }, { name: 'd6', value: '6' }, { name: 'd8', value: '8' }, { name: 'd10', value: '10' }, { name: 'd12', value: '12' }, { name: 'd20', value: '20' }, { name: 'd100', value: '100' }))
            )
        )
        .addSubcommandGroup(g => g.setName('nation').setDescription('Nation Management')
            .addSubcommand(s => s.setName('found').setDescription('Establish a sovereign nation (Requires 100,000 ⚖️).')
                .addStringOption(o => o.setName('name').setDescription('The name of your nation.').setRequired(true).setMaxLength(32))
            )
        )
        .addSubcommandGroup(g => g.setName('traderoute').setDescription('Trade route management.')
            .addSubcommand(s => s.setName('list').setDescription('List your active trade routes.'))
            .addSubcommand(s => s.setName('propose').setDescription('Propose a new trade route.')
                .addStringOption(o => o.setName('partner_type').setDescription('Trade partner type').setRequired(true).addChoices(
                    { name: 'Player', value: 'player' },
                    { name: 'Styx Empire', value: 'styx' },
                    { name: 'Sciatic League', value: 'sciatic' },
                    { name: 'Caossa', value: 'caossa' }
                ))
                .addStringOption(o => o.setName('give_resource').setDescription('Resource you give').setRequired(true).addChoices(
                    { name: 'Wealth', value: 'wealth' }, { name: 'Food', value: 'food_surplus' },
                    { name: 'Ores', value: 'ores' }, { name: 'Vitale', value: 'vitale' },
                    { name: 'Exotics', value: 'exotics' }, { name: 'Metallurgy', value: 'metallurgy' },
                    { name: 'Balance', value: 'balance' }, { name: 'Servus', value: 'servus' }
                ))
                .addIntegerOption(o => o.setName('give_amount').setDescription('Amount you give').setRequired(true).setMinValue(1))
                .addStringOption(o => o.setName('receive_resource').setDescription('Resource you receive').setRequired(true).addChoices(
                    { name: 'Wealth', value: 'wealth' }, { name: 'Food', value: 'food_surplus' },
                    { name: 'Ores', value: 'ores' }, { name: 'Vitale', value: 'vitale' },
                    { name: 'Exotics', value: 'exotics' }, { name: 'Metallurgy', value: 'metallurgy' },
                    { name: 'Balance', value: 'balance' }, { name: 'Servus', value: 'servus' }
                ))
                .addIntegerOption(o => o.setName('receive_amount').setDescription('Amount you receive').setRequired(true).setMinValue(1))
                .addIntegerOption(o => o.setName('duration').setDescription('Duration in turns (1-10)').setRequired(true).setMinValue(1).setMaxValue(10))
                .addStringOption(o => o.setName('partner').setDescription('Partner player').setRequired(false).setAutocomplete(true))
            )
            .addSubcommand(s => s.setName('cancel').setDescription('Cancel a trade route.')
                .addIntegerOption(o => o.setName('route_id').setDescription('Route ID to cancel').setRequired(true).setMinValue(1))
            )
        ),

    async execute(interaction) {
        const db = interaction.client.db, group = interaction.options.getSubcommandGroup(false), sub = interaction.options.getSubcommand(false);
        try {
            if (interaction.replied || interaction.deferred) return;
            const isEphemeral = sub === 'begin' || (group === 'action' && sub === 'scout') || sub === 'town' || sub === 'roll';
            await interaction.deferReply({ ephemeral: isEphemeral });
        } catch (e) {
            console.error(`[ATLAS] DEFER ERROR:`, e.message);
            return;
        }

        const user = await db.get('SELECT * FROM users WHERE id = ?', interaction.user.id);
        if (sub === 'begin') {
            if (user && user.status === 'active') return interaction.editReply({ content: '⚠️ Your lineage credentials are already active. Use `/atlas profile` to view them.' });
            return await character.handleOriginsIntro(interaction, user);
        }

        if (!user || user.status !== 'active') {
            const statusMsg = user?.status === 'pending_audit' ? '⏳ Your lineage is currently undergoing **Imperial Audit**. Please wait for GM approval.' : '⚠️ Sovereignty required. You must initialize your lineage with `/atlas begin` first.';
            return await interaction.editReply({ content: statusMsg });
        }

        // Check if defender is locked in a pending battle
        if (user.pending_battle && sub !== 'diplomacy' && sub !== 'begin') {
            const parts = user.pending_battle.split('|');
            const atkId = parts[0];
            const atkComp = parts[1] || '';
            const battleName = parts.length >= 3 ? (parts[2] || '').replace(/-/g, ' ') : 'Battle';
            const emb = new EmbedBuilder()
                .setTitle(`⚔️ ${battleName} — COMMIT YOUR FORCES`)
                .setColor(0xFF0000)
                .setDescription(`<@${atkId}> is marching on you! You must commit forces before taking any other action.\n\nUse the button below or \`/atlas diplomacy\` to respond.`);
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`wardefcommit_${atkId}_${interaction.user.id}_${atkComp}`).setLabel('⚔️ Commit Forces').setStyle(ButtonStyle.Danger)
            );
            return interaction.editReply({ embeds: [emb], components: [row] });
        }

        if (sub === 'town') {
            const towns = await db.all('SELECT id FROM towns WHERE user_id = ?', interaction.user.id);
            if (towns.length === 0) {
                return await town.handleSettlePrompt(interaction);
            }
        }

        if (sub === 'leaderboard') return await leaderboard.handleLeaderboard(interaction);
        if (sub === 'profile') return await character.handleProfile(interaction);
        if (sub === 'diplomacy') {
            if (interaction.replied || interaction.deferred) {} else await interaction.deferReply({ ephemeral: true });
            return await diplomacy.handleDiplomacy(interaction);
        }
        if (sub === 'tax') return await economy.handleTax(interaction);
        if (sub === 'population') return await economy.handlePopulation(interaction);
        if (sub === 'balance') return await economy.handleBalance(interaction);
        if (sub === 'donate') return await economy.handleDonate(interaction);
        if (sub === 'gift') return await economy.handleGift(interaction);
        if (sub === 'trade') return await economy.handleTrade(interaction);
        if (sub === 'empire') return await economy.handleEmpire(interaction);
        if (sub === 'town') return await town.handleTownGUI(interaction);
        
        if (group === 'action' && sub === 'scout') return await actionMod.handleScout(interaction);
        if (group === 'action' && sub === 'recruit') return await actionMod.handleRecruit(interaction);
        if (group === 'action' && sub === 'battle') return await warfare.handleBattleInitiate(interaction);
        if (group === 'action' && sub === 'warfare') return await warfare.handleSiegeInitiate(interaction);
        if (group === 'action' && sub === 'raid') return await warfare.handleRaidInitiate(interaction);
        if (group === 'nation' && sub === 'found') return await actionMod.handleNationFound(interaction);
        if (sub === 'roll') return await actionMod.handleUserRoll(interaction);
        if (group === 'gm' && sub === 'roll') return await actionMod.handleGMRoll(interaction);
        if (group === 'traderoute' && sub === 'list') return await trade.handleTradeRouteList(interaction);
        if (group === 'traderoute' && sub === 'propose') return await trade.handleTradeRoutePropose(interaction);
        if (group === 'traderoute' && sub === 'cancel') return await trade.handleTradeRouteCancel(interaction, interaction.options.getInteger('route_id'));
    },

    async handleButton(interaction, action, args) {
        if (action === 'origins' || action === 'ageroll' || action === 'fbadd' || action === 'fbreset' || action === 'fbfinalize') {
            return await character.handleOriginsLogic(interaction, action, args);
        }
        if (action === 'town' || action === 'buildconfirm' || action === 'upgradeconfirm' || action === 'demolishconfirm') {
            return await town.handleButton(interaction, action, args);
        }
        if (action === 'roll') {
            return await actionMod.handleButton(interaction, action, args);
        }
        if (action === 'vitale' || action === 'ta' || action === 'td' || action.startsWith('tmodal') || action === 'empire') {
            return await economy.handleButton(interaction, action, args);
        }
        if (action === 'rebellion' || action === 'revolt') {
            return await actionMod.handleButton(interaction, action, args);
        }
        if (action === 'audit') {
            return await admin.handleAudit(interaction, action, args);
        }
        if (action === 'lb') {
            await interaction.deferUpdate();
            return await leaderboard.handleLeaderboard(interaction, args[0] || 'total');
        }
        if (action === 'traderoute') {
            return await trade.handleButton(interaction, action, args);
        }
        if (action === 'diplo') {
            return await diplomacy.handleButton(interaction, action, args);
        }
        if (action === 'treaty') {
            return await diplomacy.handleButton(interaction, action, args);
        }
        if (action.startsWith('war') || action === 'warbattle' || action === 'warsiege' || action === 'wardefcommit' || action === 'warraid') {
            return await warfare.handleButton(interaction, action, args);
        }
        if (action === 'raidwithdraw') {
            return await warfare.handleButton(interaction, action, args);
        }
    },

    async handleModal(interaction, action, args) {
        if (action === 'originsmodal') {
            return await character.handleModal(interaction, action, args);
        }
        if (action === 'townsettle') {
            return await town.handleModal(interaction, action, args);
        }
        if (action === 'townrename') {
            return await town.handleModal(interaction, action, args);
        }
        if (action === 'vitale') {
            return await economy.handleModal(interaction, action, args);
        }
        if (action === 'tmodalg' || action === 'tmodalr') {
            return await economy.handleModal(interaction, action, args);
        }
        if (action === 'empire') {
            return await economy.handleModal(interaction, action, args);
        }
        if (action === 'diplo') {
            return await diplomacy.handleModal(interaction, action, args);
        }
        if (action === 'warcomp') {
            return await warfare.handleBattleCompositionSubmit(interaction, args[0], args[1]);
        }
        if (action === 'wardefmodal') {
            return await warfare.handleBattleResolve(interaction, args[0], args[1], args[2]);
        }
        if (action === 'warbattlename') {
            return await warfare.handleBattleNameSubmit(interaction, args[0], args[1], args.slice(2));
        }
        if (action === 'warraid') {
            const townEnc = args.length > 2 ? args.slice(2).join('_') : null;
            return await warfare.handleRaidCompositionSubmit(interaction, args[0], args[1], townEnc);
        }
    },

    async handleSelect(interaction, action, args) {
        if (action === 'town') {
            return await town.handleSelect(interaction, action, args);
        }
        if (action === 'roll') {
            return await actionMod.handleSelect(interaction, action, args);
        }
        if (action === 'diplo') {
            return await diplomacy.handleSelect(interaction, action, args);
        }
    }
};
