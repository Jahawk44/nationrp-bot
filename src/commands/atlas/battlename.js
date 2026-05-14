const DESCRIPTORS = ['Iron', 'Ash', 'Cold', 'Grey', 'Stone', 'Dusk', 'Ember', 'Black', 'Silver', 'Hollow'];
const LANDSCAPES  = ['vale', 'ford', 'moor', 'fen', 'wood', 'marsh', 'ridge', 'crossing', 'field', 'pass'];

function classifyBattle(context) {
    const { hasTown, terrainType, isRaid } = context;
    if (isRaid) return 'RAID';
    if (hasTown) return 'SIEGE';
    return 'OPEN_BATTLE';
}

function generateBattleName(type, options) {
    const {
        townName, terrainType, attackerNation, defenderNation,
        attackerRulerName, isAmbush, isOutnumbered
    } = options || {};

    let name = '';

    if (type === 'SIEGE') {
        name = `Siege of ${townName || 'Unknown'}`;
    } else if (type === 'RAID') {
        if (townName) {
            name = `${attackerNation || attackerRulerName || 'Unknown'}'s Raid on ${townName}`;
        } else {
            name = `${attackerRulerName || attackerNation || 'Unknown'}'s Raid`;
        }
    } else {
        // OPEN_BATTLE: use location name or generate from word pairs
        const desc = DESCRIPTORS[Math.floor(Math.random() * DESCRIPTORS.length)];
        const land = LANDSCAPES[Math.floor(Math.random() * LANDSCAPES.length)];
        name = `Battle of ${desc}${land}`;
    }

    // Special prefixes (prepended in order — outer wraps inner)
    if (isAmbush)      name = `The Ambush at ${name}`;
    if (isOutnumbered) name = `The Desperate Stand at ${name}`;

    return name;
}

module.exports = { classifyBattle, generateBattleName };
