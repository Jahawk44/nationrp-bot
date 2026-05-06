const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { EMOJIS, TERRAINS, BUILDINGS, ANCESTRIES, UPBRINGINGS, PROFESSIONS, STAT_MAPPING } = require('../data/constants');

// --- Helper Functions ---

async function handleTownBuild(interaction) {
    const db = interaction.client.db;
    const townId = interaction.options.getString('town'), type = interaction.options.getString('type').toUpperCase();
    const town = await db.get('SELECT * FROM towns WHERE id = ?', townId);
    const b = BUILDINGS[type];
    
    if (!town || !b) return interaction.editReply({ content: 'Invalid town or building type.' });
    if (b.tier !== 1) return interaction.editReply({ content: 'Use `/atlas town upgrade` for advanced structures.' });
    
    const embed = new EmbedBuilder().setTitle('🚧 CONSTRUCTION PERMIT').setColor(0xFFFF00)
        .setDescription(`**Town**: ${town.name}\n**Structure**: ${b.emoji} ${b.name}\n**Cost**: $${b.cost}\n**Plots**: ${b.plots}\n**Time**: 1 Hour\n\n*Establish this structure?*`);
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`buildconfirm_yes_${townId}_${type}`).setLabel('YES').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`buildconfirm_no`).setLabel('NO').setStyle(ButtonStyle.Secondary)
    );
    await interaction.editReply({ embeds: [embed], components: [row] });
}

async function handleTownUpgrade(interaction) {
    const db = interaction.client.db;
    const townId = interaction.options.getString('town'), type = interaction.options.getString('type').toUpperCase();
    const town = await db.get('SELECT * FROM towns WHERE id = ?', townId);
    const b = BUILDINGS[type];
    
    if (!town || !b) return interaction.editReply({ content: 'Invalid town or building type.' });
    if (!b.upgrade_from) return interaction.editReply({ content: 'This building cannot be upgraded to (use `/atlas town build` instead).' });
    
    const prev = await db.get('SELECT * FROM buildings WHERE town_id = ? AND type = ?', townId, b.upgrade_from);
    if (!prev) return interaction.editReply({ content: `You must have a **${BUILDINGS[b.upgrade_from].name}** first.` });

    const embed = new EmbedBuilder().setTitle('🏗️ UPGRADE PERMIT').setColor(0x00BFFF)
        .setDescription(`**Town**: ${town.name}\n**Upgrade**: ${BUILDINGS[b.upgrade_from].emoji} → ${b.emoji} ${b.name}\n**Cost**: $${b.cost}\n**Time**: 1 Hour\n**Additional Plots**: ${b.plots - BUILDINGS[b.upgrade_from].plots}\n\n*Execute upgrade?*`);
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`upgradeconfirm_yes_${townId}_${type}`).setLabel('YES').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`upgradeconfirm_no`).setLabel('NO').setStyle(ButtonStyle.Secondary)
    );
    await interaction.editReply({ embeds: [embed], components: [row] });
}

async function handleTownDemolish(interaction) {
    const db = interaction.client.db;
    const townId = interaction.options.getString('town'), type = interaction.options.getString('type').toUpperCase();
    const b = await db.get('SELECT * FROM buildings WHERE town_id = ? AND type = ?', townId, type);
    if (!b) return interaction.editReply({ content: 'No such structure in this town.' });
    
    const embed = new EmbedBuilder().setTitle('⚠️ DEMOLITION PROTOCOL').setColor(0xFF0000)
        .setDescription(`Are you certain you wish to dismantle the **${BUILDINGS[type].name}** in this settlement?\n\n*50% of the original cost will be refunded.*`);
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`demolishconfirm_yes_${townId}_${type}`).setLabel('YES (Dismantle)').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`demolishconfirm_no`).setLabel('NO (Abort)').setStyle(ButtonStyle.Secondary)
    );
    await interaction.editReply({ embeds: [embed], components: [row] });
}

async function handleGMRoll(interaction) {
    const db = interaction.client.db;
    const OWNER_ID = '317883862258548737';
    const isWhitelisted = await db.get('SELECT 1 FROM gm_whitelist WHERE user_id = ?', interaction.user.id);
    
    if (interaction.user.id !== OWNER_ID && !isWhitelisted) {
        return interaction.editReply({ content: '⚠️ ACCESS VOID: You do not possess Game Master clearance.' });
    }

    const targetId = interaction.options.getString('user'), stat = interaction.options.getString('stat'), diceType = interaction.options.getString('type');
    
    if (diceType) {
        const sides = parseInt(diceType.replace('d', '')) || 20;
        const roll = Math.floor(Math.random() * sides) + 1;
        const embed = new EmbedBuilder().setTitle('🎲 ORACLE INVOCATION').setColor(0xFFFF00)
            .setDescription(`**Target**: <@${targetId}>\n**Roll Type**: ${diceType}\n**Result**: **${roll}**`);
        return await interaction.editReply({ embeds: [embed], components: [] });
    }

    const sD = STAT_MAPPING[stat];
    if (!sD) return interaction.editReply({ content: 'Stat required for skill check. Or use `type` for a generic dice roll.' });

    const embed = new EmbedBuilder().setTitle('🎲 ORACLE INVOCATION').setColor(0xFFFF00)
        .setDescription(`Invoke a sub-stat for <@${targetId}>'s **${sD.name}** check:`);
    const row = new ActionRowBuilder(); sD.sub.forEach(s => row.addComponents(new ButtonBuilder().setCustomId(`gmroll_${targetId}_${stat}_${s}`).setLabel(s).setStyle(ButtonStyle.Primary)));
    await interaction.editReply({ embeds: [embed], components: [row] });
}

async function handleGMResult(interaction, tid, stat, sub) {
    const db = interaction.client.db;
    const OWNER_ID = '317883862258548737';
    const isWhitelisted = await db.get('SELECT 1 FROM gm_whitelist WHERE user_id = ?', interaction.user.id);
    
    if (interaction.user.id !== OWNER_ID && !isWhitelisted) {
        return interaction.editReply({ content: '⚠️ ACCESS VOID: You do not possess Game Master clearance.' });
    }

    const user = await db.get('SELECT * FROM users WHERE id = ?', tid);
    const bonus = Math.floor(((user[`attr_${stat}`] || 10) - 10) / 2);
    const roll = Math.floor(Math.random() * 20) + 1;
    
    await interaction.editReply({ 
        embeds: [new EmbedBuilder().setTitle('🎲 ORACLE RESULT').setColor(0xFFFF00)
            .setDescription(`**Target**: <@${tid}>\n**Check**: ${sub} (${STAT_MAPPING[stat].name})\n**Roll**: 🎲 ${roll} + ${bonus} mod\n**Total**: **${roll + bonus}**`)
        ],
        components: []
    });
}

async function handleTownList(interaction, page) {
    const db = interaction.client.db;
    const towns = await db.all('SELECT * FROM towns WHERE user_id = ?', interaction.user.id);
    if (!towns.length) return interaction.editReply({ embeds: [new EmbedBuilder().setTitle('🏘️ EMPTY').setDescription('No settlements.').setColor(0xFF0000)], components: [] });
    if (page < 0) page = 0; if (page >= towns.length) page = towns.length - 1;
    const t = towns[page], terrain = TERRAINS[t.terrain_type?.toUpperCase()] || TERRAINS.PLAINS;
    const buildings = await db.all('SELECT type, level, ready_at FROM buildings WHERE town_id = ?', t.id);
    
    const bTextList = buildings.map(b => {
        const isBuilt = !b.ready_at || Date.now() >= b.ready_at;
        const icon = BUILDINGS[b.type.toUpperCase()]?.emoji || '🏗️';
        if (isBuilt) return `${icon} T${b.level}`;
        return `🚧 <t:${Math.floor(b.ready_at / 1000)}:R>`;
    });
    
    const bText = bTextList.length ? bTextList.join(' ') : '*None*';
    
    let plotsUsed = 0;
    for (const bt of buildings) { plotsUsed += BUILDINGS[bt.type.toUpperCase()]?.plots || 1; }
    const totalPlots = t.plots_total || terrain.plots || 10;
    
    const embed = new EmbedBuilder().setTitle(`🏘️ [${page + 1}/${towns.length}] ${t.name}`).setColor(terrain.color).setImage(terrain.img)
        .addFields(
            { name: '🌍 Terrain', value: t.terrain_type, inline: true }, 
            { name: '🗺️ Plots', value: `${plotsUsed} / ${totalPlots}`, inline: true }, 
            { name: '🏗️ Buildings', value: bText, inline: true }
        );
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`townlist_${page - 1}`).setLabel('⬅️').setStyle(ButtonStyle.Primary).setDisabled(page === 0), new ButtonBuilder().setCustomId(`townlist_${page + 1}`).setLabel('➡️').setStyle(ButtonStyle.Primary).setDisabled(page === towns.length - 1));
    await interaction.editReply({ embeds: [embed], components: [row] });
}

async function handleScout(interaction, type) {
    const db = interaction.client.db;
    const targetId = interaction.options.getString('user');
    const user = await db.get('SELECT * FROM users WHERE id = ?', interaction.user.id), targetData = await db.get('SELECT * FROM users WHERE id = ?', targetId);
    let dc = 10 + Math.floor(((targetData?.attr_wis || 10) - 10) / 2);
    if (type === 'town') { const town = await db.get('SELECT MAX(plots_total) as max_mil FROM towns WHERE user_id = ?', targetId); dc = 10 + (town?.max_mil || 0); }
    const roll = Math.floor(Math.random() * 20) + 1, bonus = Math.floor((user.attr_wis - 10) / 2);
    if (roll + bonus >= dc) {
        let resDesc = `**Infiltrated!**\n`; if (type === 'town') { const ts = await db.all('SELECT * FROM towns WHERE user_id = ?', targetId); resDesc += ts.map(t => `- ${t.name}`).join('\n'); } else resDesc += `Wealth: W${targetData?.wealth || 0}`;
        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('📡 INTEL ACQUIRED').setColor(0x00FFBB).setDescription(resDesc)] });
    } else await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('❌ ALERT').setDescription(`Spies captured.`).setColor(0xFF0000)] });
}

async function handleRelation(interaction) {
    const db = interaction.client.db;
    const rels = await db.all('SELECT * FROM relations WHERE user_id = ?', interaction.user.id);
    const getBar = (s) => { const ch = ['🟫', '🟥', '🟧', '🟩', '🟦']; let idx = 2; if (s <= -60) idx = 0; else if (s < -20) idx = 1; else if (s > 60) idx = 4; else if (s > 20) idx = 3; let b = ''; for (let i = 0; i < 5; i++) b += (i === idx) ? ch[i] : '⬛'; return `\`${b.padEnd(12)}\` **${s}**`; };
    let desc = `\`Faction                Standing Bar           Score\`\n\`--------------------------------------------------\`\n`;
    desc += rels.length ? rels.map(r => `\`${r.faction_name.padEnd(20)}\` ${getBar(r.score)}`).join('\n') : '*No records.*';
    await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('🤝 DIPLOMATIC LEDGER').setColor(0xFF8800).setDescription(desc)] });
}

async function handleEmpire(interaction) {
    const db = interaction.client.db;
    const settings = await db.all('SELECT * FROM global_settings');
    const getS = (k) => settings.find(s => s.key === k)?.value || 'Unknown';
    
    const embed = new EmbedBuilder()
        .setTitle('🏛️ IMPERIAL STATUS: THE STYX THRONE')
        .setColor(0xFFD700)
        .setDescription('The sovereign heart of the Ares Heiliga League.')
        .setThumbnail('https://images.unsplash.com/photo-1548013146-72479768bbaa?auto=format&fit=crop&w=1000&q=80')
        .addFields(
            { name: '👑 Current Ruler', value: `\`${getS('empire_ruler')}\``, inline: true },
            { name: '⏳ Current Turn', value: `\`Cycle ${getS('current_turn')}\``, inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
            { name: '📊 Statistics', value: 'Total Lineages: 12\nActive Settlements: 24\nEconomic Index: Stable', inline: false }
        );
    await interaction.editReply({ embeds: [embed] });
}

async function handleProfile(interaction) { 
    const db = interaction.client.db;
    const targetId = interaction.options.getString('user') || interaction.user.id;
    let targetUser; try { targetUser = await interaction.client.users.fetch(targetId); } catch(e) { targetUser = interaction.user; }
    const u = await db.get('SELECT * FROM users WHERE id = ?', targetId); 
    if (!u) return interaction.editReply({ content: 'Unknown lineage.' }); 

    const towns = await db.all('SELECT name FROM towns WHERE user_id = ?', targetId);
    const townList = towns.length > 0 ? towns.map(t => t.name).join(', ') : 'None';
    const ancData = ANCESTRIES[u.ancestry?.toUpperCase()] || { color: 0x0099FF };
    
    const getMod = (val) => Math.floor((val - 10) / 2);

    const embed = new EmbedBuilder()
        .setTitle(`👤 ${u.username} [${u.ancestry?.toUpperCase() || 'UNKNOWN'} ${u.profession?.toUpperCase() || 'UNKNOWN'}]`)
        .setColor(ancData.color)
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
            { name: '🏛️ Nation', value: `\`${u.nation_name || 'Unclaimed'}\``, inline: true },
            { name: '🏘️ Settlements', value: `\`${townList}\``, inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
            
            { name: '🧬 Ancestry', value: `\`${u.ancestry?.toUpperCase() || 'None'}\``, inline: true },
            { name: '📜 Upbringing', value: `\`${u.upbringing?.toUpperCase() || 'None'}\``, inline: true },
            { name: '⚒️ Profession', value: `\`${u.profession?.toUpperCase() || 'None'}\``, inline: true },
            
            { name: '⚔️ Physical Attributes', value: 
                `**Strength**: \`${u.attr_str}\` (${getMod(u.attr_str) >= 0 ? '+' : ''}${getMod(u.attr_str)})\n` +
                `**Motoric**: \`${u.attr_mot}\` (${getMod(u.attr_mot) >= 0 ? '+' : ''}${getMod(u.attr_mot)})\n` +
                `**Menace**: \`${u.attr_men}\` (${getMod(u.attr_men) >= 0 ? '+' : ''}${getMod(u.attr_men)})`, 
                inline: true 
            },
            { name: '🧠 Mental Attributes', value: 
                `**Intelligence**: \`${u.attr_int}\` (${getMod(u.attr_int) >= 0 ? '+' : ''}${getMod(u.attr_int)})\n` +
                `**Wisdom**: \`${u.attr_wis}\` (${getMod(u.attr_wis) >= 0 ? '+' : ''}${getMod(u.attr_wis)})\n` +
                `**Charisma**: \`${u.attr_cha}\` (${getMod(u.attr_cha) >= 0 ? '+' : ''}${getMod(u.attr_cha)})`, 
                inline: true 
            },
            { name: '\u200B', value: '\u200B', inline: true },

            { name: '💰 Assets & Wealth', value: `**Wealth**: \`W${u.wealth}\` | **Balance**: \`$${u.balance}\``, inline: false }
        );

    await interaction.editReply({ embeds: [embed] }); 
}

async function handleTax(interaction) { 
    const db = interaction.client.db;
    const user = await db.get('SELECT * FROM users WHERE id = ?', interaction.user.id);
    const now = Date.now(), lastTime = user.last_daily || 0, DAY_MS = 86400000;
    
    if (now - lastTime < DAY_MS) {
        const hrs = Math.ceil((DAY_MS - (now - lastTime)) / 3600000);
        return interaction.editReply({ embeds: [new EmbedBuilder().setTitle('⏳ COOLDOWN').setDescription(`Taxes can be collected again in **${hrs}h**.`).setColor(0xFF0000)] });
    }
    
    await db.run('UPDATE users SET balance = balance + 50, last_daily = ? WHERE id = ?', now, user.id);
    await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('💰 TAX COLLECTED').setDescription('Imperial stipend granted: **+$50**. Cash secured.').setColor(0x00FFBB)] }); 
}

async function handleSettle(interaction) { 
    const db = interaction.client.db;
    const name = interaction.options.getString('name'); 
    const existing = await db.get('SELECT id FROM towns WHERE user_id = ? AND name = ?', interaction.user.id, name);
    if (existing) return interaction.editReply({ content: 'A town with that name already exists under your rule.' });

    const terrainKeys = Object.keys(TERRAINS), chosenType = terrainKeys[Math.floor(Math.random() * terrainKeys.length)], terrainData = TERRAINS[chosenType];
    const plots = terrainData.plots + Math.floor(Math.random() * 3) - 1, fertility = 40 + Math.floor(Math.random() * 60);

    await db.run('INSERT INTO towns (user_id, name, terrain_type, plots_total, fertility) VALUES (?, ?, ?, ?, ?)', interaction.user.id, name, chosenType, plots, fertility); 
    
    const embed = new EmbedBuilder().setTitle(`🏕️ Settled ${name}`).setColor(terrainData.color).setImage(terrainData.img)
        .addFields({ name: '🌍 Terrain', value: terrainData.name, inline: true }, { name: '🌱 Fertility', value: `${fertility}%`, inline: true }, { name: '🗺️ Plots', value: `${plots} available`, inline: true })
        .setDescription(`You have established a settlement in the **${terrainData.name}** region!\n**Bonus:** ${terrainData.bonus}`);
    
    await interaction.editReply({ embeds: [embed] }); 
}

async function handleOriginsIntro(interaction) {
    const rows = []; const keys = Object.keys(ANCESTRIES); 
    for (let i = 0; i < keys.length; i += 5) { 
        const row = new ActionRowBuilder(); 
        keys.slice(i, i + 5).forEach(k => row.addComponents(new ButtonBuilder().setCustomId(`origins_ancestrypick_${k}`).setLabel(ANCESTRIES[k].name).setEmoji(ANCESTRIES[k].emoji).setStyle(ANCESTRIES[k].style))); 
        rows.push(row); 
    }
    await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('🏛️ ADOPTION').setDescription('Choose Bloodline.').setThumbnail(interaction.user.displayAvatarURL()).setColor(0xFF0000)], components: rows });
}

async function handleOriginsLogic(interaction, args) {
    const db = interaction.client.db, client = interaction.client, [step, ...params] = args;
    
    if (step === 'ancestrypick') {
        const k = params[0], a = ANCESTRIES[k.toUpperCase()];
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`origins_ancestryconfirm_${k}`).setLabel('YES').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId('origins_back_intro').setLabel('BACK').setStyle(ButtonStyle.Secondary));
        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('🩸 BLOODLINE').setDescription(a.desc).setColor(a.color).addFields({ name: 'Bonuses', value: Object.entries(a.bonuses).map(([s,v]) => `${EMOJIS[s.split('_')[1]]} +${v}`).join(', ') })], components: [row] });
    }
    else if (step === 'ancestryconfirm') {
        const anc = params[0], rows = []; const keys = Object.keys(UPBRINGINGS);
        const row = new ActionRowBuilder(); keys.forEach(k => row.addComponents(new ButtonBuilder().setCustomId(`origins_upbringingpick_${k}_${anc}`).setLabel(UPBRINGINGS[k].name).setStyle(ButtonStyle.Secondary)));
        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('📜 THE YOUTH').setDescription('Choose your upbringing.').setColor(0x00FFBB)], components: [row] });
    }
    else if (step === 'upbringingpick') {
        const [ub, anc] = params, u = UPBRINGINGS[ub.toUpperCase()];
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`origins_upbringingconfirm_${ub}_${anc}`).setLabel('YES').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId(`origins_ancestryconfirm_${anc}`).setLabel('BACK').setStyle(ButtonStyle.Secondary));
        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('📜 UPBRINGING').setDescription(u.desc).setColor(0x00FFBB).addFields({ name: 'Bonuses', value: Object.entries(u.bonuses).map(([s,v]) => `${EMOJIS[s.split('_')[1]]} +${v}`).join(', ') })], components: [row] });
    }
    else if (step === 'upbringingconfirm') {
        const [ub, anc] = params, keys = Object.keys(PROFESSIONS), rows = [];
        for (let i = 0; i < keys.length; i += 5) {
            const row = new ActionRowBuilder();
            keys.slice(i, i + 5).forEach(k => row.addComponents(new ButtonBuilder().setCustomId(`origins_professionpick_${k}_${anc}_${ub}`).setLabel(PROFESSIONS[k].name).setStyle(ButtonStyle.Secondary)));
            rows.push(row);
        }
        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('⚒️ THE CALLING').setDescription('Choose your profession.').setColor(0xFFFF00)], components: rows });
    }
    else if (step === 'professionpick') {
        const [prof, anc, ub] = params, p = PROFESSIONS[prof.toUpperCase()];
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`origins_final_${prof}_${anc}_${ub}`).setLabel('FINALIZED').setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId(`origins_upbringingconfirm_${ub}_${anc}`).setLabel('BACK').setStyle(ButtonStyle.Secondary));
        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('⚒️ PROFESSION').setDescription(p.desc).setColor(0xFFFF00)], components: [row] });
    }
    else if (step === 'final') {
        const [prof, anc, ub] = params;
        await interaction.editReply({ content: 'Lineage submitted for Imperial Audit.', embeds: [], components: [] });
        await db.run('INSERT OR IGNORE INTO users (id, username, status) VALUES (?, ?, "pending")', interaction.user.id, interaction.user.username);
        await db.run('UPDATE users SET ancestry = ?, upbringing = ?, profession = ?, status = "pending" WHERE id = ?', anc, ub, prof, interaction.user.id);
        
        const adminChanId = process.env.ADMIN_CHANNEL_ID || '1483005224376467599';
        let chan; try { chan = await client.channels.fetch(adminChanId); } catch(e) {}
        if (!chan) chan = interaction.guild.channels.cache.find(c => c.name.toLowerCase() === 'atlas-hq');
        if (chan) {
            const auditEmbed = new EmbedBuilder().setTitle('⚖️ IMPERIAL AUDIT').setColor(0xFFD700).setThumbnail(interaction.user.displayAvatarURL()).setDescription(`Applicant: <@${interaction.user.id}>\n**Ancestry**: ${anc}\n**Upbringing**: ${ub}\n**Profession**: ${prof}`);
            const auditRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`approve_${interaction.user.id}`).setLabel('APPROVE').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId(`decline_${interaction.user.id}`).setLabel('DECLINE').setStyle(ButtonStyle.Danger));
            await chan.send({ embeds: [auditEmbed], components: [auditRow] });
        }
    }
    else if (step === 'back') {
        if (params[0] === 'intro') return await handleOriginsIntro(interaction);
    }
}

async function handleBalance(interaction) {
    const db = interaction.client.db, u = await db.get('SELECT * FROM users WHERE id = ?', interaction.user.id);
    const embed = new EmbedBuilder().setTitle('⚖️ IMPERIAL BALANCE').setColor(0x00FFBB).addFields({ name: `${EMOJIS.wealth} National Wealth`, value: `W${u.wealth}`, inline: true }, { name: `${EMOJIS.balance} Personal Cash`, value: `$${u.balance}`, inline: true });
    await interaction.editReply({ embeds: [embed] });
}

// --- Module Export ---

module.exports = {
    data: new SlashCommandBuilder()
        .setName('atlas')
        .setDescription('Atlas AI: Imperial Interface')
        .addSubcommand(s => s.setName('begin').setDescription('Start your Imperial Origins.'))
        .addSubcommand(s => s.setName('tax').setDescription('Daily tax collection cycle.'))
        .addSubcommand(s => s.setName('balance').setDescription('View personal and national wealth.'))
        .addSubcommand(s => s.setName('profile').setDescription('Inspect player credentials.').addStringOption(o => o.setName('user').setDescription('Target Player').setAutocomplete(true)))
        .addSubcommand(s => s.setName('relation').setDescription('Diplomatic standings ledger.'))
        .addSubcommand(s => s.setName('empire').setDescription('Imperial status of the Styx Throne.'))
        .addSubcommandGroup(g => g.setName('town').setDescription('Settlement management.')
            .addSubcommand(s => s.setName('settle').setDescription('Found a new town.').addStringOption(o => o.setName('name').setDescription('Town Name').setRequired(true)))
            .addSubcommand(s => s.setName('list').setDescription('Browse your settlements.'))
            .addSubcommand(s => s.setName('scout').setDescription('Survey a target town.').addStringOption(o => o.setName('user').setDescription('Target Player').setRequired(true).setAutocomplete(true)))
            .addSubcommand(s => s.setName('build').setDescription('Purchase a structure.').addStringOption(o => o.setName('town').setDescription('Town').setRequired(true).setAutocomplete(true)).addStringOption(o => o.setName('type').setDescription('Structure').setRequired(true).setAutocomplete(true)))
            .addSubcommand(s => s.setName('upgrade').setDescription('Upgrade a structure.').addStringOption(o => o.setName('town').setDescription('Town').setRequired(true).setAutocomplete(true)).addStringOption(o => o.setName('type').setDescription('Structure').setRequired(true).setAutocomplete(true)))
            .addSubcommand(s => s.setName('demolish').setDescription('Dismantle a structure.').addStringOption(o => o.setName('town').setDescription('Town').setRequired(true).setAutocomplete(true)).addStringOption(o => o.setName('type').setDescription('Structure').setRequired(true).setAutocomplete(true)))
        )
        .addSubcommandGroup(g => g.setName('gm').setDescription('Oracle protocols.')
            .addSubcommand(s => s.setName('roll').setDescription('Trigger a skill check.')
                .addStringOption(o => o.setName('user').setDescription('Target Player').setRequired(true).setAutocomplete(true))
                .addStringOption(o => o.setName('stat').setDescription('Attribute').addChoices({ name: 'Strength', value: 'str' }, { name: 'Motoric', value: 'mot' }, { name: 'Menace', value: 'men' }, { name: 'Intelligence', value: 'int' }, { name: 'Wisdom', value: 'wis' }, { name: 'Charisma', value: 'cha' }))
                .addStringOption(o => o.setName('type').setDescription('Dice Type').addChoices({ name: 'd4', value: 'd4' }, { name: 'd6', value: 'd6' }, { name: 'd8', value: 'd8' }, { name: 'd10', value: 'd10' }, { name: 'd12', value: 'd12' }, { name: 'd20', value: 'd20' }, { name: 'd100', value: 'd100' })))
        ),
            
    async execute(interaction) {
        const db = interaction.client.db, group = interaction.options.getSubcommandGroup(false), sub = interaction.options.getSubcommand(false);
        if (sub === 'begin') await interaction.deferReply({ ephemeral: true }); else await interaction.deferReply();
        const user = await db.get('SELECT * FROM users WHERE id = ?', interaction.user.id);
        
        if (sub === 'begin') {
            if (user && user.status === 'active') return interaction.editReply({ content: '⚠️ Credentials already active.' });
            return await handleOriginsIntro(interaction);
        }
        if (!user) return await interaction.editReply({ content: '⚠️ Sovereignty required. Start with `/atlas begin`.' });

        if (sub === 'profile') return await handleProfile(interaction);
        if (sub === 'balance') return await handleBalance(interaction);
        if (sub === 'tax') return await handleTax(interaction);
        if (sub === 'relation') return await handleRelation(interaction);
        if (sub === 'empire') return await handleEmpire(interaction);
        if (group === 'town') {
            if (sub === 'settle') return await handleSettle(interaction);
            if (sub === 'list') return await handleTownList(interaction, 0);
            if (sub === 'scout') return await handleScout(interaction, 'town');
            if (sub === 'build') return await handleTownBuild(interaction);
            if (sub === 'upgrade') return await handleTownUpgrade(interaction);
            if (sub === 'demolish') return await handleTownDemolish(interaction);
        } else if (group === 'gm' && sub === 'roll') return await handleGMRoll(interaction);
    },
    
    async handleButton(interaction, action, args) {
        await interaction.deferUpdate();
        const db = interaction.client.db;
        if (action === 'origins') await handleOriginsLogic(interaction, args);
        if (action === 'approve') {
            await db.run('UPDATE users SET status = "active" WHERE id = ?', args[0]); 
            await interaction.editReply({ content: `✅ **AUTHORIZED**: Lineage of <@${args[0]}> has been verified by the Imperial High Command.`, embeds: [], components: [] }); 
        }
        if (action === 'decline') await interaction.editReply({ content: 'Lineage declined.', embeds: [], components: [] });
        if (action === 'townlist') await handleTownList(interaction, parseInt(args[0]));
        if (action === 'gmroll') await handleGMResult(interaction, args[0], args[1], args[2]);
        if (action === 'demolishconfirm') {
            const [status, townId, type] = args;
            if (status === 'yes') {
                await db.run('DELETE FROM buildings WHERE town_id = ? AND type = ?', townId, type);
                const bData = BUILDINGS[type.toUpperCase()];
                await db.run('UPDATE users SET balance = balance + ? WHERE id = ?', Math.floor(bData.cost * 0.5), interaction.user.id);
                await interaction.editReply({ content: `Demolished **${bData.name}**. Refund granted.`, embeds: [], components: [] });
            } else await interaction.editReply({ content: 'Protocol aborted.', embeds: [], components: [] });
        }
        if (action === 'upgradeconfirm' || action === 'buildconfirm') {
            const [status, townId, type] = args;
            if (status === 'yes') {
                const b = BUILDINGS[type.toUpperCase()];
                const u = await db.get('SELECT balance FROM users WHERE id = ?', interaction.user.id);
                if (u.balance < b.cost) return interaction.editReply({ content: `Insufficient funds. Need **$${b.cost}**.`, embeds: [], components: [] });
                if (action === 'upgradeconfirm') await db.run('DELETE FROM buildings WHERE town_id = ? AND type = ?', townId, b.upgrade_from);
                await db.run('UPDATE users SET balance = balance - ? WHERE id = ?', b.cost, interaction.user.id);
                const readyAt = Date.now() + 3600000; 
                await db.run('INSERT INTO buildings (town_id, type, ready_at) VALUES (?, ?, ?)', townId, type, readyAt);
                await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('🚧 CONSTRUCTION STARTED').setDescription(`**${b.name}** will complete in <t:${Math.floor(readyAt / 1000)}:R>.`).setColor(0xFFFF00)], components: [] });
            } else await interaction.editReply({ content: 'Protocol aborted.', embeds: [], components: [] });
        }
    }
};
