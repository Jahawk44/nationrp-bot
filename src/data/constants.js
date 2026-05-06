const { ButtonStyle } = require('discord.js');

const EMOJIS = { 
    wealth: '💰', food: '🥩', ores: '⛓️', vitale: '💠', exotics: '💎', balance: '💵', 
    str: '💪', mot: '🏃', men: '💀', int: '🧠', wis: '🕯️', cha: '🎭' 
};

const TERRAINS = {
    PLAINS: { name: 'Plains', plots: 16, bonus: '+20% Food', color: 0x77DD77, img: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1000&q=80' },
    MOUNTAIN: { name: 'Mountain', plots: 6, bonus: '+50% Ores', color: 0x888888, img: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1000&q=80' },
    FOREST: { name: 'Forest', plots: 14, bonus: '+10 Defense', color: 0x228B22, img: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1000&q=80' },
    COASTAL: { name: 'Coastal', plots: 12, bonus: '+20% Wealth', color: 0x00BFFF, img: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?auto=format&fit=crop&w=1000&q=80' },
    HILLS: { name: 'Hills', plots: 10, bonus: '+10% Ores', color: 0xDAA520, img: 'https://images.unsplash.com/photo-1464638681273-0962e9b53566?auto=format&fit=crop&w=1000&q=80' },
    RIVERLANDS: { name: 'Riverlands', plots: 14, bonus: '+30% Food', color: 0x40E0D0, img: 'https://images.unsplash.com/photo-1437482078695-73f5ca6c96e2?auto=format&fit=crop&w=1000&q=80' },
    SWAMP: { name: 'Swamp', plots: 8, bonus: '-20% Economy', color: 0x2E8B57, img: 'https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=1000&q=80' }
};

const BUILDINGS = {
    // --- ECONOMY ---
    FARM: { name: 'Farm', category: 'ECONOMY', tier: 1, plots: 4, cost: 500, emoji: '🌾', desc: '+1 Stats, +10 Income, +100 Food.' },
    LIVESTOCK: { name: 'Livestock', category: 'ECONOMY', tier: 2, plots: 6, cost: 750, emoji: '🐄', desc: '+2 Stats, +20 Income, +300 Food.', upgrade_from: 'FARM' },
    MARKET: { name: 'Market', category: 'ECONOMY', tier: 3, plots: 8, cost: 1000, emoji: '⚖️', desc: '+3 Stats, +80 Income.', upgrade_from: 'LIVESTOCK' },

    // --- DEFENSE ---
    PALISADE: { name: 'Palisade', category: 'DEFENSE', tier: 1, plots: 2, cost: 300, emoji: '🪵', desc: '+1 Stats.' },
    BASIC_WALL: { name: 'Basic Wall', category: 'DEFENSE', tier: 2, plots: 4, cost: 600, emoji: '🧱', desc: '+2 Stats.', upgrade_from: 'PALISADE' },
    ADVANCED_WALL: { name: 'Advanced Wall', category: 'DEFENSE', tier: 3, plots: 6, cost: 900, emoji: '🏰', desc: '+3 Stats.', upgrade_from: 'BASIC_WALL' },

    // --- STABILITY ---
    CHURCH: { name: 'Church', category: 'STABILITY', tier: 1, plots: 2, cost: 300, emoji: '⛪', desc: '+1 Stats.' },
    MOTHERS_GUILD: { name: 'Mothers Guild', category: 'STABILITY', tier: 2, plots: 4, cost: 600, emoji: '🤱', desc: '+2 Stats.', upgrade_from: 'CHURCH' },
    IMPERIAL_ACADEMY: { name: 'Imperial Academy', category: 'STABILITY', tier: 3, plots: 8, cost: 1200, emoji: '🎓', desc: '+3 Stats.', upgrade_from: 'MOTHERS_GUILD' },

    // --- MILITARY ---
    BARRACKS: { name: 'Barracks', category: 'MILITARY', tier: 1, plots: 6, cost: 900, emoji: '🛡️', desc: '+1 Stats.' },
    CASTLE: { name: 'Castle', category: 'MILITARY', tier: 2, plots: 10, cost: 1500, emoji: '🏯', desc: '+2 Stats.', upgrade_from: 'BARRACKS' },
    PALACE: { name: 'Palace', category: 'MILITARY', tier: 3, plots: 12, cost: 2000, emoji: '👑', desc: '+3 Stats.', upgrade_from: 'CASTLE' },

    // --- SPECIAL ---
    TAVERN: { name: 'Tavern', category: 'UTILITY', tier: 1, plots: 3, cost: 450, emoji: '🍺', desc: '+1 Stats, Consumes 100 Food.' },
    GARDEN: { name: 'Garden', category: 'UTILITY', tier: 1, plots: 2, cost: 300, emoji: '🌹', desc: '+1 Stats.' }
};

const ANCESTRIES = {
    AKHA: { name: 'Akha', bonuses: { stat_wis: 2, stat_str: 1 }, desc: 'Children of the dunes and ancient monuments.', color: 0xFFDAB9, emoji: '🟠', style: ButtonStyle.Secondary },
    ALEXIANS: { name: 'Alexians', bonuses: { stat_int: 2, stat_men: 1 }, desc: 'Architects of law and empire.', color: 0xE0E0E0, emoji: '⚪', style: ButtonStyle.Secondary },
    DAXOS: { name: 'Daxos', bonuses: { stat_cha: 2, stat_int: 1 }, desc: 'Masters of commerce and guild trade.', color: 0xCC0000, emoji: '🔴', style: ButtonStyle.Danger },
    ELVISH: { name: 'Elvish', bonuses: { stat_mot: 2, stat_wis: 1 }, desc: 'Harmony of the multicultural tribes.', color: 0x1A7A40, emoji: '🟢', style: ButtonStyle.Success },
    INCANZIL: { name: 'Incanzil', bonuses: { stat_wis: 2, stat_int: 1 }, desc: 'Sages and philosopher-kings atop peaks.', color: 0xEDB2ED, emoji: '🟣', style: ButtonStyle.Primary },
    LINERIAN: { name: 'Linerian', bonuses: { stat_cha: 2, stat_mot: 1 }, desc: 'The adaptable and diplomatic lineage.', color: 0xADFF2F, emoji: '🟢', style: ButtonStyle.Success },
    POLYSIA: { name: 'Polysia', bonuses: { stat_mot: 2, stat_cha: 1 }, desc: 'Island tamers of beast and bloom.', color: 0x512E5F, emoji: '🟣', style: ButtonStyle.Primary },
    SCIATIC: { name: 'Sciatic', bonuses: { stat_int: 2, stat_mot: 1 }, desc: 'Navigators of the great oceanic trade routes.', color: 0x85C1E9, emoji: '🔵', style: ButtonStyle.Primary },
    SONG: { name: 'Song', bonuses: { stat_int: 2, stat_cha: 1 }, desc: 'Scholars of the great eastern bureaucracy.', color: 0xF9E79F, emoji: '🟡', style: ButtonStyle.Secondary },
    STYX: { name: 'Styx', bonuses: { stat_men: 2, stat_cha: 1 }, desc: 'The majestic synthesis of sword and silk.', color: 0xFF0000, emoji: '🔴', style: ButtonStyle.Danger },
    TOLKHAI: { name: 'Tolkhai', bonuses: { stat_str: 2, stat_mot: 1 }, desc: 'Lords of the endless steppe.', color: 0xC6EDB2, emoji: '🟢', style: ButtonStyle.Success }
};

const UPBRINGINGS = {
    YARD: { name: 'The Martial Yard', bonuses: { stat_str: 2, stat_men: 1 }, desc: 'Youth amidst steel.' },
    HALL: { name: 'The Scriptural Hall', bonuses: { stat_int: 2, stat_wis: 1 }, desc: 'Parchment and logic.' },
    STREETS: { name: 'The Market Streets', bonuses: { stat_cha: 2, stat_mot: 1 }, desc: 'The deal and shadows.' }
};

const PROFESSIONS = {
    COMMANDER: { name: 'Commander', bon: { stat_men: 2 }, desc: 'Legion Leader.' },
    MERCHANT: { name: 'Merchant', bon: { stat_cha: 2 }, desc: 'Master of trade.' },
    PRIEST: { name: 'Priest', bon: { stat_wis: 2 }, desc: 'Keeper of Flame.' },
    SCHOLAR: { name: 'Scholar', bon: { stat_int: 2 }, desc: 'Seeker of histories.' },
    OUTLAW: { name: 'Outlaw', bon: { stat_mot: 2 }, desc: 'The predator.' },
    SCION: { name: 'Scion', bon: { all: 1 }, desc: 'Balanced master.' }
};

const STAT_MAPPING = {
    str: { name: 'Strength', sub: ['Athletic', 'Survival', 'Immunity'] },
    mot: { name: 'Motoric', sub: ['Initiative', 'Coordination', 'Stealth'] },
    men: { name: 'Menace', sub: ['Intimidation', 'Influence', 'Authority'] },
    int: { name: 'Intelligence', sub: ['Encyclopedia', 'Medicine', 'Logic'] },
    wis: { name: 'Wisdom', sub: ['Insight', 'Inspiration', 'Intuition'] },
    cha: { name: 'Charisma', sub: ['Deception', 'Persuasion', 'Empathy'] }
};

const RESOURCES = {
    GOLD: { name: 'Gold ($)', emoji: '💵' },
    WEALTH: { name: 'Wealth (W)', emoji: '💰' },
    EXOTICS: { name: 'Exotics (E)', emoji: '💎' },
    FOOD: { name: 'Food (F)', emoji: '🥩' },
    ORES: { name: 'Ores (O)', emoji: '⛓️' },
    VITALE: { name: 'Vitale (V)', emoji: '💠' }
};

const FACTIONS = [
    'Atomic Guild', 'Gagoon', 'Gaius', 'Outer Being', 'Rhagaia', 
    'Sciatic League', 'Sellesela', 'The Fathers', 'The Mothers', 
    'The Sisters', 'The Warlocks', 'Tyrannite'
];

module.exports = {
    EMOJIS,
    TERRAINS,
    BUILDINGS,
    ANCESTRIES,
    UPBRINGINGS,
    PROFESSIONS,
    STAT_MAPPING,
    RESOURCES,
    FACTIONS
};
