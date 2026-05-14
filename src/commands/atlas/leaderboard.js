const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { BUILDINGS } = require('../../data/constants');

async function handleLeaderboard(interaction, categoryOverride) {
    // categoryOverride comes from lb_* button args; options only exist on slash commands
    const category = categoryOverride
        || (interaction.isChatInputCommand?.() ? interaction.options.getString('category') : null)
        || 'total';
    const db = interaction.client.db;

    const users = await db.all('SELECT * FROM users WHERE status = "active"');
    const rankings = [];
    for (const u of users) {
        const score = await calculateNationScore(db, u.id);
        rankings.push({ user: u, score });
    }
    rankings.sort((a, b) => (b.score[category] || 0) - (a.score[category] || 0));

    const CAT_LABELS = {
        total: '🏆 IMPERIAL TOTAL', economy: '💰 ECONOMY', defense: '🛡️ DEFENSE',
        stability: '⚖️ STABILITY', offense: '⚔️ OFFENSE'
    };
    const CAT_COLORS = {
        total: 0xFFD700, economy: 0x00FF88, defense: 0x4488FF,
        stability: 0xFFAA00, offense: 0xFF4444
    };

    const MEDALS = ['🥇','🥈','🥉'];
    const lines = rankings.slice(0, 10).map((r, i) => {
        const pos   = MEDALS[i] || `**${i + 1}.**`;
        const name  = r.user.nation ? `**${r.user.nation}**` : `*(${r.user.ruler_name || r.user.username || 'Unknown'})*`;
        const econ  = `💰${r.score.economy}`;
        const def   = `🛡️${r.score.defense}`;
        const stab  = `⚖️${r.score.stability}`;
        const off   = `⚔️${r.score.offense}`;
        const total = `**${r.score.total}pts**`;
        return `${pos} ${name} — ${total}\n\u200b\u2003${econ} · ${def} · ${stab} · ${off}`;
    }).join('\n') || '*No players ranked yet.*';

    const embed = new EmbedBuilder()
        .setTitle(CAT_LABELS[category] || '🏆 IMPERIAL RANKINGS')
        .setColor(CAT_COLORS[category] || 0xFFD700)
        .setDescription(lines)
        .setFooter({ text: `Sorted by: ${category} score` })
        .setTimestamp();

    const active = (cat) => cat === category ? ButtonStyle.Primary : ButtonStyle.Secondary;
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('lb_total').setLabel('Total').setStyle(active('total')),
        new ButtonBuilder().setCustomId('lb_economy').setLabel('Economy').setStyle(active('economy')),
        new ButtonBuilder().setCustomId('lb_defense').setLabel('Defense').setStyle(active('defense')),
        new ButtonBuilder().setCustomId('lb_stability').setLabel('Stability').setStyle(active('stability')),
        new ButtonBuilder().setCustomId('lb_offense').setLabel('Offense').setStyle(active('offense'))
    );

    return interaction.editReply({ embeds: [embed], components: [row] });
}

async function calculateNationScore(db, userId) {
    const towns = await db.all('SELECT id FROM towns WHERE user_id = ?', userId);
    let scores = { economy: 0, defense: 0, stability: 0, prestige: 0, offense: 0, total: 0 };

    for (const t of towns) {
        const bldgs = await db.all('SELECT type FROM buildings WHERE town_id = ? AND (ready_at IS NULL OR ready_at <= ?)', t.id, Date.now());
        for (const b of bldgs) {
            const bt = b.type.toUpperCase();
            // Economy
            if (bt === 'FARM') scores.economy += 1;
            if (bt === 'LIVESTOCK') scores.economy += 2;
            if (bt === 'MARKET') scores.economy += 3;
            // Defense
            if (bt === 'PALISADE') scores.defense += 1;
            if (bt === 'BASIC_WALL') scores.defense += 2;
            if (bt === 'ADVANCED_WALL') scores.defense += 3;
            if (bt === 'CASTLE') scores.defense += 5;
            // Stability
            if (bt === 'TAVERN') scores.stability += 1;
            if (bt === 'CASTLE') scores.stability += 5;
            if (bt === 'PALACE') scores.stability += 15;
            // Prestige
            if (bt === 'MOTHERS_GUILD') scores.prestige += 3;
            if (bt === 'IMPERIAL_ACADEMY') scores.prestige += 8;
            // Offense
            if (bt === 'BARRACKS') scores.offense += 1;
            if (bt === 'CASTLE') scores.offense += 2;
            if (bt === 'PALACE') scores.offense += 3;
        }
    }
    scores.total = scores.economy + scores.defense + scores.stability + scores.prestige + scores.offense;
    return scores;
}

module.exports = { handleLeaderboard, calculateNationScore };
