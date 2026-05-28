const {
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ModalBuilder, TextInputBuilder, TextInputStyle, StringSelectMenuBuilder
} = require('discord.js');
const { TERRAIN_MULTIPLIERS, BUILDINGS, ANCESTRIES } = require('../../data/constants');
const {
    calcStabMultiplier, getCharBonuses, calcNobleState, formatWarningBanner,
    getPlayerRank, isVitaleFree, getNotificationChannel, calcMaintenance,
    resolveAtlasHQ, GREAT_HOUSES, sendToPlayer, getActivePlayers, safeReply, ephemeralReply
} = require('../../utils/helpers');

/**
 * Base exchange rates: units of recvRes received per 1 unit of giveRes at zero demand
 * and neutral relations. Rates degrade as weekly volume fills the pool, and are
 * modified by the player's standing with that faction.
 *
 * Design axioms
 * ─────────────
 * 1. ore→metallurgy rates must stay BELOW building efficiency to preserve building value:
 *      Furnace  : 50 ore → 10 met  (0.20 met/ore)
 *      Smeltery : 80 ore → 20 met  (0.25 met/ore; 0.375 with Caossa ancestry)
 *    Hard cap: 0.16 met/ore (Caossa, best trade; Styx 0.12, Sciatic 0.14)
 *
 * 2. food→wealth rates must stay below Farm/Livestock efficiency:
 *    Farm: same cost, same plots → gives BOTH +10⚖️ AND +100🥩/day. Trade alone ≠ substitute.
 *
 * 3. Within-faction no-arb: (wealth→X rate) × (X→wealth rate) < 1.0
 *    Cross-faction arbitrage is bounded by the weekly pool system.
 *
 * Intrinsic value reference (⚖️ wealth-equivalents, derived from building costs/output):
 *   🥩 food       ≈  0.10 ⚖️   (Farm: 100g / 100 food/day)
 *   ⚒️ ore        ≈  1.50 ⚖️   (Mine: 500g / 30 ore/day vs Farm baseline)
 *   🔩 metallurgy ≈  8.00 ⚖️   (5-ore conversion + Furnace overhead)
 *   🍷 exotic     ≈ 50.00 ⚖️   (Workshop: 800g / 2 exotic/day)
 *   💧 vitale     ≈ 40.00 ⚖️   (tax resource; scarcity inflates effective demand)
 *   🔗 servus     ≈  6.00 ⚖️
 */
const FACTION_BASE_RATES = {

    // ── STYX ─────────────────────────────────────────────────────────────────
    // "The majestic synthesis of sword and silk."
    // Mountain strongholds → ore & metallurgy surplus.
    // Silk Road access     → exotic surplus; best exotic sell-rate in game.
    // Vast legions         → strong food & servus demand.
    // Sole vitale broker   → only faction that accepts exotics/metallurgy for vitale.
    styx: {
        wealth: {
            vitale:     0.025,  //  40.0 ⚖️ → 1 💧  (fair; no other faction brokers vitale)
            metallurgy: 0.13,   //   7.7 ⚖️ → 1 🔩  (armory surplus; second-cheapest met)
            ores:       0.65,   //   1.5 ⚖️ → 1 ⚒️  (mountain surplus; cheapest ore buy)
            exotics:    0.022,  //  45.0 ⚖️ → 1 🍷  (silk-trade surplus)
            food:       8.0,    //   0.13⚖️ → 1 🥩  (military supply stores, moderate access)
        },
        ores: {
            metallurgy: 0.12,   //  8.3 ⚒️ → 1 🔩  (BELOW Furnace 0.20 — trade ≠ building substitute)
            wealth:     1.10,   //  1.1 ⚖️ per ore — Styx has own surplus; modest buy-back only
        },
        metallurgy: {
            vitale:     0.18,   //  5.6 🔩 → 1 💧
            wealth:     6.50,   //  armory surplus → pays below intrinsic (8.0)
        },
        food: {
            wealth:     0.09,   //  11 🥩 → 1 ⚖️  (army premium; roughly fair)
            ores:       0.06,   //  17 🥩 → 1 ⚒️  (soldiers trade rations for raw ore)
        },
        exotics: {
            vitale:     1.15,   //   1 🍷 → 1.1 💧  (silk buys imperial access above par)
            wealth:     45.0,   //  slight below intrinsic (50); Styx silk surplus
        },
        servus: {
            wealth:     8.0,    //  best servus price in game - imperial labour demand
            ores:       3.5,    //  empire trades mountain ore for workers
        },
    },

    // ── SCIATIC ───────────────────────────────────────────────────────────────
    // "Navigators of the great oceanic trade routes."
    // Coastal networks → food & servus in abundance; exotics arrive from distant ports.
    // Shipbuilding imperative → highest ores & metallurgy purchase prices in game.
    // Best faction for selling ore/met; best for buying food/exotics.
    sciatic: {
        wealth: {
            food:       14.0,   //  0.07⚖️ → 1 🥩  (coastal abundance — cheapest food)
            exotics:    0.024,  //  41.5⚖️ → 1 🍷  (sea-route variety)
            servus:     0.18,   //   5.6⚖️ → 1 🔗  (port-town labour surplus)
            ores:       0.45,   //   2.2⚖️ → 1 ⚒️  (Sciatic hoards ore; expensive to buy here)
        },
        ores: {
            wealth:     2.10,   //  2.1 ⚖️ per ore — 40% premium; ships need iron
            food:       20.0,   //  1 ⚒️ → 20 🥩  (trade raw ore for coastal provisions)
            metallurgy: 0.14,   //  7.1 ⚒️ → 1 🔩  (BELOW Furnace; best ore→met trade rate)
        },
        metallurgy: {
            wealth:     11.0,   //  best metallurgy purchase price — hull fittings & rigging
            food:       95.0,   //  1 🔩 → 95 🥩  (metal for a coastal feast)
            ores:       5.0,    //  1 🔩 → 5 ⚒️  back-conversion to keep raw ore supply
        },
        food: {
            wealth:     0.06,   //  16.5 🥩 → 1 ⚖️  (surplus; below-fair sell rate)
            ores:       0.04,   //   25 🥩 → 1 ⚒️  (Sciatic trades food for craved ores)
        },
        exotics: {
            wealth:     50.0,   //  fair price (≈intrinsic); Sciatic moves exotics efficiently
            food:       520.0,  //  1 🍷 → 520 🥩  (exotic rarity meets food abundance)
        },
        servus: {
            food:       65.0,   //  port labour traded for abundant coastal food
            ores:       4.5,    //  servus for the shipbuilding ore Sciatic craves
        },
    },

    // ── CAOSSA ───────────────────────────────────────────────────────────────
    // "Masters of commerce and guild trade."
    // Smeltery ancestry bonus (+10 met/cycle → 30 vs standard 20).
    // Insatiable ore appetite to feed the most efficient smelteries on the continent.
    // Best ore-purchase rate & best ore→met conversion in game (still below own Smeltery).
    // Metallurgy surplus undersold to move volume; guild exotics prized above all.
    caossa: {
        wealth: {
            metallurgy: 0.15,   //   6.7⚖️ → 1 🔩  (guild surplus — cheapest met in game)
            exotics:    0.025,  //  40.0⚖️ → 1 🍷  (guild luxury — best exotic buy rate)
            ores:       0.40,   //   2.5⚖️ → 1 ⚒️  (hoarding ores; buying here is expensive)
        },
        ores: {
            metallurgy: 0.16,   //  6.25⚒️ → 1 🔩  (best ore→met trade; still BELOW Furnace 0.20)
            wealth:     2.20,   //   2.2⚖️ per ore — highest purchase price; guild hunger
            exotics:    0.030,  //   33 ⚒️ → 1 🍷  (raw ore for guild luxury goods)
        },
        metallurgy: {
            wealth:     5.50,   //  guild surplus → undersells to move volume (lowest met sell-rate)
            ores:       4.50,   //  1 🔩 → 4.5 ⚒️  (back-loop: refined metal traded for raw ore)
            exotics:    0.16,   //  6.25🔩 → 1 🍷  (refined metal for guild luxury)
        },
        food: {
            wealth:     0.10,   //  10 🥩 → 1 ⚖️  (factory workers fed at fair rate)
            ores:       0.07,   //  14 🥩 → 1 ⚒️  (food-rich players feed the foundry)
        },
        exotics: {
            wealth:     60.0,   //  guild connoisseurs - best exotic sell price in game
            metallurgy: 7.5,    //  1 🍷 → 7.5 🔩  (luxury for refined metal stockpile)
            ores:       35.0,   //  1 🍷 → 35 ⚒️  (exotic rarity for bulk ore haul)
        },
        servus: {
            wealth:     6.0,    //  fair guild rate (≈intrinsic)
            metallurgy: 0.85,   //  1 🔗 → 0.85🔩  (labour for refined metal)
            ores:       5.0,    //  1 🔗 → 5 ⚒️   (foundry's preferred servus trade)
        },
    },
};

/**
 * Maximum give-resource units a faction absorbs per week at full supply.
 * Trades beyond this are filled at a very degraded floor rate.
 */
const FACTION_WEEKLY_POOLS = {
    styx:    5000,
    sciatic: 6000,
    caossa:  4000,
};

/**
 * How aggressively demand degrades the marginal rate as volume fills the pool.
 * Higher = steeper curve. Rate at pool-full = baseRate / (1 + sensitivity).
 */
const FACTION_DEMAND_SENSITIVITY = {
    styx:    4.0,
    sciatic: 2.5,
    caossa:  3.5,
};

/**
 * Relation-to-multiplier curve.
 *   +10 → ×1.30  (30% bonus)
 *     0 → ×1.00  (neutral)
 *    −9 → ×0.73  (27% penalty — still tradeable)
 * Floor of ×0.50 prevents relation penalty from being completely disabling.
 */
function relationMultiplier(relScore) {
    const clamped = Math.max(-9, Math.min(10, relScore || 0));
    return Math.max(0.50, 1 + (clamped / 10) * 0.30);
}

// Friendly display names
const RESOURCE_LABELS = {
    balance:    '🪙 Balance',  wealth:     '⚖️ Wealth',
    food:       '🥩 Food',     ores:       '⚒️ Ores',
    metallurgy: '🔩 Metallurgy', vitale:   '💧 Vitale',
    exotics:    '🍷 Exotics',  servus:     '🔗 Servus',
};
const FACTION_DISPLAY_NAMES = { styx: 'Styx Empire', sciatic: 'Sciatic League', caossa: 'Caossa' };
const FACTION_DB_NAMES      = { styx: 'Tyrannite',   sciatic: 'Sciatic League', caossa: 'Caossa' };

// ── Rate query (for preview / display) ────────────────────────────────────────
async function getFactionExchangeRate(db, faction, giveRes, recvRes, relScore = 0) {
    const baseRate = FACTION_BASE_RATES[faction]?.[giveRes]?.[recvRes];
    if (!baseRate) return null;

    // ── Pool size ──────────────────────────────────────────────────────────────
    // Vitale pool is dynamic (player-count-scaled); everything else uses the
    // static weekly pool table.
    let pool = 0;
    if (recvRes === 'vitale') {
        const playerCount   = (await db.get('SELECT COUNT(*) as cnt FROM users WHERE status = "active"'))?.cnt || 1;
        const vitaleBaseRow = await db.get("SELECT value FROM global_settings WHERE key = 'vitale_base'");
        const vitaleBase    = parseInt(vitaleBaseRow?.value) || 15;
        pool = vitaleBase + (10 * playerCount);
    } else {
        pool = FACTION_WEEKLY_POOLS[faction] || 5000;
    }

    const sensitivity = FACTION_DEMAND_SENSITIVITY[faction] || 3.0;
    const demandKey   = `demand_${faction}_${recvRes}`;

    const demandRow    = await db.get('SELECT value FROM global_settings WHERE key=?', demandKey);
    const weeklyVolume = parseInt(demandRow?.value || 0);

    const relMult      = relationMultiplier(relScore);
    const demandRatio  = weeklyVolume / Math.max(1, pool);
    const marginalRate = (baseRate * relMult) / (1 + demandRatio * sensitivity);

    return { baseRate, marginalRate, weeklyVolume, pool, demandRatio, demandKey,
             relMult, relScore, faction, sensitivity };
}

// ── Integral-based execution (for actual trades & scheduled route ticks) ───────
async function executeFactionTrade(db, faction, giveRes, recvRes, giveAmt, relScore = 0) {
    const baseRate = FACTION_BASE_RATES[faction]?.[giveRes]?.[recvRes];
    if (!baseRate) {
        const err = new Error(`${FACTION_DISPLAY_NAMES[faction] || faction} does not trade ${giveRes} → ${recvRes}`);
        err.code  = 'UNSUPPORTED_PAIR';
        throw err;
    }

    const pool        = FACTION_WEEKLY_POOLS[faction]      || 5000;
    const sensitivity = FACTION_DEMAND_SENSITIVITY[faction] || 3.0;
    const demandKey   = `demand_${faction}_${recvRes}`;

    const demandRow  = await db.get('SELECT value FROM global_settings WHERE key=?', demandKey);
    const currentVol = parseInt(demandRow?.value || 0);

    // Hard cap: single transaction cannot exceed 3× weekly pool
    const maxTrade = pool * 3;
    if (giveAmt > maxTrade) {
        const err = new Error(`Single transaction exceeds the market cap of ${maxTrade.toLocaleString('en-US')}.`);
        err.code  = 'TRADE_TOO_LARGE';
        err.max   = maxTrade;
        throw err;
    }

    const relMult    = relationMultiplier(relScore);
    const withinPool = Math.max(0, Math.min(giveAmt, pool - currentVol));
    const overflow   = Math.max(0, giveAmt - withinPool);
    let   recv       = 0;

    // Integral for within-pool portion
    if (withinPool > 0) {
        const v0 = currentVol;
        const S  = sensitivity;
        const P  = pool;
        recv += baseRate * relMult * (P / S) *
                Math.log((P + (v0 + withinPool) * S) / Math.max(1e-9, P + v0 * S));
    }

    // Floor rate for overflow (pool fully saturated)
    if (overflow > 0) {
        recv += overflow * baseRate * relMult * 0.05;
    }

    const recvAmount = Math.floor(recv);
    const avgRate    = giveAmt > 0 ? recvAmount / giveAmt : 0;

    // Atomically persist updated demand
    await db.run(`
        INSERT INTO global_settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = CAST(value AS INTEGER) + ?
    `, demandKey, giveAmt, giveAmt);

    return {
        recvAmount,
        breakdown: {
            baseRate, relMult, relScore, avgRate,
            withinPool, overflow,
            weeklyVolumeBefore: currentVol,
            pool, demandRatioBefore: currentVol / pool,
        },
    };
}

/**
 * Called by the weekly scheduler to process one tick of a standing faction route.
 * Recalculates rate from live S&D and current player relations each tick.
 *
 * Usage in scheduler:
 *   const rel       = await db.get('SELECT score FROM relations WHERE user_id=? AND faction_name=?', route.initiator_id, FACTION_DB_NAMES[route.partner_type]);
 *   const relScore  = rel?.score ?? 0;
 *   if (relScore <= -10) { // skip tick — relations too strained
 *       await db.run("UPDATE trade_routes SET status='paused' WHERE id=?", route.id);
 *       return;
 *   }
 *   const { recvAmount } = await calculateFactionRouteReturn(db, route, relScore);
 *   // deduct route.give_resource, credit route.receive_resource, decrement turns_remaining
 */
async function calculateFactionRouteReturn(db, route, relScore = 0) {
    return executeFactionTrade(db, route.partner_type, route.give_resource, route.receive_resource, route.give_amount, relScore);
}

// ── UI helpers ─────────────────────────────────────────────────────────────────
function buildDemandBar(demandRatio) {
    const pct    = Math.min(1, demandRatio);
    const filled = Math.round(pct * 10);
    const bar    = '█'.repeat(filled) + '░'.repeat(10 - filled);
    const color  = pct >= 0.8 ? '🔴' : pct >= 0.5 ? '🟡' : '🟢';
    return `${color} \`${bar}\` ${Math.round(pct * 100)}% supply used`;
}

function relScoreLabel(score) {
    if (score >= 8)  return `💚 Revered (+${score})`;
    if (score >= 4)  return `🟢 Friendly (+${score})`;
    if (score >= 1)  return `🔵 Cordial (+${score})`;
    if (score === 0) return `⚪ Neutral (0)`;
    if (score >= -3) return `🟡 Strained (${score})`;
    if (score >= -7) return `🟠 Cold (${score})`;
    return                  `🔴 Hostile (${score})`;
}

function buildRatePreviewLines(rateInfo, giveLabel, recvLabel) {
    const { baseRate, marginalRate, demandRatio, weeklyVolume, pool, relMult, relScore } = rateInfo;
    const relPct    = ((relMult - 1) * 100).toFixed(0);
    const relSign   = relMult >= 1 ? `+${relPct}%` : `${relPct}%`;
    const demPct    = (100 - (marginalRate / baseRate) * 100).toFixed(1);
    const examples  = [50, 250, 1000].map(n => {
        // approximate integral for display (exact on zero-overflow inputs)
        const v0  = weeklyVolume;
        const S   = FACTION_DEMAND_SENSITIVITY[rateInfo._faction] || 3.0;
        const P   = pool;
        const within = Math.min(n, Math.max(0, P - v0));
        const ovflow = Math.max(0, n - within);
        let   approx = 0;
        if (within > 0) approx += baseRate * relMult * (P / S) * Math.log((P + (v0 + within) * S) / Math.max(1e-9, P + v0 * S));
        if (ovflow > 0) approx += ovflow * baseRate * relMult * 0.05;
        return `  ${n.toLocaleString('en-US')} ${giveLabel} → **${Math.floor(approx).toLocaleString('en-US')} ${recvLabel}**`;
    });
    return [
        `**Relation standing:** ${relScoreLabel(relScore)} (rate modifier: ${relSign})`,
        `**Demand penalty:** −${demPct}% below base`,
        `**Weekly supply:** ${buildDemandBar(demandRatio)}`,
        `Used: ${weeklyVolume.toLocaleString('en-US')} / ${pool.toLocaleString('en-US')} (resets Monday)`,
        '',
        `**Rate estimate at current supply:**`,
        ...examples,
        '',
        `*Large trades consume supply progressively — the first units trade better than the last.*`,
    ];
}

async function handleTax(interaction) {
    const db = interaction.client.db;
    const userId = interaction.user.id;
    const user = await db.get('SELECT * FROM users WHERE id = ?', userId);
    const now  = Date.now();

    if (user.last_tax && now < user.last_tax) {
        const remaining = user.last_tax - now;
        const hrs  = Math.floor(remaining / 3600000);
        const mins = Math.floor((remaining % 3600000) / 60000);
        return interaction.editReply({ content: `⏳ Taxes reset daily at 12 AM GMT. You can collect again in **${hrs}h ${mins}m**.` });
    }

    const nextReset = new Date();
    nextReset.setUTCHours(24, 0, 0, 0);
    const nextTaxTimestamp = nextReset.getTime();

    const towns = await db.all('SELECT * FROM towns WHERE user_id = ?', userId);
    let totalWealth = 0, totalFoodProd = 0, totalFoodCost = 0, totalOresProd = 0;
    let totalOreConsume = 0, totalMetProd = 0, totalExoticProd = 0;
    let totalStabBonus = 0, totalWealthMultBonus = 0;

    for (const t of towns) {
        const mult  = TERRAIN_MULTIPLIERS[t.terrain_type] || { food: 1.0, wealth: 1.0, ore: 1.0 };
        const bldgs = await db.all(
            'SELECT type FROM buildings WHERE town_id = ? AND (ready_at IS NULL OR ready_at <= ?)',
            t.id, now
        );
        for (const b of bldgs) {
            const bd = BUILDINGS[b.type.toUpperCase()];
            if (!bd) continue;
            totalWealth          += (bd.income_wealth      || 0) * mult.wealth;
            totalFoodProd        += (bd.food_prod          || 0) * mult.food;
            totalFoodCost        += (bd.food_cost          || 0);
            totalOresProd        += (bd.ore_prod           || 0) * mult.ore;
            totalOreConsume      += (bd.ore_consumption    || 0);
            totalMetProd         += (bd.metallurgy_prod    || 0);
            totalExoticProd      += (bd.exotic_prod        || 0);
            totalStabBonus       += (bd.stab_bonus         || 0);
            totalWealthMultBonus += (bd.wealth_mult_bonus  || 0);
        }
    }

    const ancestryKey  = (user.ancestry || '').toUpperCase();
    const ancestryData = ANCESTRIES[ancestryKey];
    if (ancestryData?.house === 'CAOSSA') {
        totalMetProd  = Math.floor(totalMetProd  * 1.3);
        totalOresProd = Math.floor(totalOresProd * 1.2);
    }

    const charBonuses = getCharBonuses(user);
    const stabMult    = calcStabMultiplier(user.rate_stab);
    const servusMult  = 1 + ((user.servus || 0) * 0.02);
    const wealthMult  = 1 + totalWealthMultBonus;

    const finalWealth  = Math.floor(totalWealth * servusMult * stabMult * charBonuses.wealthBonus * wealthMult);
    const finalFoodNet = Math.floor((totalFoodProd * charBonuses.foodBonus) - totalFoodCost);
    const finalOres    = totalOresProd - totalOreConsume;
    const finalMet     = Math.floor(totalMetProd * stabMult);
    const finalExotics = totalExoticProd;
    const stabDrain    = Math.floor((user.servus || 0) / 5);

    const mothersRel = await db.get(
        'SELECT score FROM relations WHERE user_id=? AND faction_name=?', userId, 'The Mothers'
    );

    const rank    = getPlayerRank(user);
    const vFree   = isVitaleFree(user.ancestry);
    const { nobles, vitaleNeeded: rawVitaleNeeded, inGracePeriod } = calcNobleState(user);
    let vitaleNeeded = rawVitaleNeeded;
    if (mothersRel?.score >= 10 && rank === 'SOVEREIGN') vitaleNeeded = Math.ceil(vitaleNeeded / 2);

    let vitaleStabPenalty = 0, vitaleDeducted = 0, vitaleText = '';
    if (vFree || rank !== 'SOVEREIGN') {
        vitaleText = nobles > 0
            ? `${nobles} nobles (${vitaleNeeded} 💧/tick — subsidized by Imperial Academy)`
            : `No nobles yet (population below 200)`;
    } else if (inGracePeriod) {
        vitaleText = `${vitaleNeeded} 💧 — grace period (${3 - (user.tax_count || 0)} ticks left)`;
    } else if ((user.vitale || 0) >= vitaleNeeded && nobles > 0) {
        vitaleDeducted = vitaleNeeded;
        vitaleText = `${vitaleNeeded} 💧 paid ✅`;
    } else if (nobles > 0) {
        vitaleStabPenalty = -2;
        vitaleText = `${vitaleNeeded} 💧 ⚠️ DEFICIT (−2 Stability)`;
    }

    const netStab   = totalStabBonus - stabDrain + vitaleStabPenalty;
    const channelId = interaction.channelId;

    await db.run(`
        UPDATE users SET
            balance      = balance + 100,
            wealth       = COALESCE(wealth,0) + ?,
            food         = COALESCE(food,0) + ?,
            ores         = MAX(0, COALESCE(ores,0) + ?),
            metallurgy   = COALESCE(metallurgy,0) + ?,
            exotics      = COALESCE(exotics,0) + ?,
            vitale       = COALESCE(vitale,0) - ?,
            rate_stab    = MAX(-10, MIN(10, rate_stab + ?)),
            last_tax     = ?,
            tax_count    = COALESCE(tax_count,0) + 1,
            last_tax_channel = ?,
            tax_notified = 0
        WHERE id = ?`,
        finalWealth, finalFoodNet, finalOres, finalMet, finalExotics,
        vitaleDeducted, netStab, nextTaxTimestamp, channelId, userId
    );

    if (rank === 'SOVEREIGN' && !vFree && !inGracePeriod && nobles > 0) {
        const prestChange = vitaleDeducted > 0 ? +2 : -3;
        await db.run('UPDATE users SET rate_prest = MAX(-10, MIN(10, rate_prest + ?)) WHERE id = ?', prestChange, userId);
    }

    const ag = await db.get('SELECT score FROM relations WHERE user_id=? AND faction_name=?', userId, 'Atomic Guild');
    if (ag?.score <= -20) {
        const r = Math.random();
        let gmAlert = null;
        if      (r < 0.005) gmAlert = `☠️ ASSASSINATION PLOT detected — Atomic Guild targeting ${interaction.user.username}. Review and decide.`;
        else if (r < 0.025) gmAlert = `🔗 SERVUS UPRISING RISK — Atomic Guild influence on ${interaction.user.username}. Review.`;
        else if (r < 0.075) gmAlert = `⚠️ REBEL ACTIVITY — Atomic Guild. Targeting ${interaction.user.username}.`;
        if (gmAlert) {
            await resolveAtlasHQ(interaction.client,
                new EmbedBuilder().setTitle('🔮 ATOMIC GUILD ALERT').setDescription(gmAlert).setColor(0x333333)
            );
        }
    }

    const updatedUser = await db.get('SELECT rate_stab, rate_prest FROM users WHERE id=?', userId);
    const warnBanner  = formatWarningBanner(updatedUser.rate_stab, updatedUser.rate_prest);
    const warnColor   = warnBanner?.startsWith('🔴') ? 0xFF4444 : warnBanner ? 0xFFCC00 : null;
    const houseData   = ancestryData ? GREAT_HOUSES[ancestryData.house] : null;
    const houseStr    = houseData ? `${houseData.emoji} ${houseData.name}` : 'Independent';
    const armyMaint   = calcMaintenance(user);
    const servusWarn  = stabDrain > 0 && (user.rate_stab - stabDrain) <= -3
        ? '\n⚠️ **SERVUS UNREST RISING** — Rebellion may fire at −5 Stability.' : '';

    const econDesc = [
        `**Taxes Collected:** +100 🪙`,
        `**Polity Wealth:** +${finalWealth.toLocaleString('en-US')} ⚖️`,
        ``,
        `**Resources Generated:**`,
        `🥩 Food: ${finalFoodNet >= 0 ? '+' : ''}${finalFoodNet.toLocaleString('en-US')}`,
        `⚒️ Ores: ${finalOres >= 0 ? '+' : ''}${finalOres.toLocaleString('en-US')}${finalOres < 0 ? ' ⚠️ Furnace consuming more than mines produce!' : ''}`,
        finalMet     > 0 ? `🔩 Metallurgy: +${finalMet.toLocaleString('en-US')}` : null,
        finalExotics > 0 ? `🍷 Exotics: +${finalExotics.toLocaleString('en-US')}` : null,
        ``,
        `*Multipliers: Stability(×${stabMult.toFixed(2)}) · Servus(×${servusMult.toFixed(2)}) · INT(×${charBonuses.wealthBonus.toFixed(2)}) · WIS(×${charBonuses.foodBonus.toFixed(2)})*`,
        `Army upkeep: ${armyMaint.toLocaleString('en-US')} 🥩/day (charged by daily scheduler)`,
        servusWarn || null,
        warnBanner  || null,
    ].filter(Boolean).join('\n');

    const popDesc = [
        `**Rank:** ${rank} | **House:** ${houseStr}`,
        `**Commoners:** ${user.pop_commoners.toLocaleString('en-US') || 0}`,
        `⚒️ Militia ${user.mil_militia?.toLocaleString('en-US') || 0} | ⚔️ Infantry: ${user.mil_infantry?.toLocaleString('en-US') || 0} | 🐎 Cavalry: ${user.mil_cavalry?.toLocaleString('en-US') || 0} | 🏹 Ranged: ${user.mil_ranged?.toLocaleString('en-US') || 0} | 🪨 Siege: ${user.mil_siege?.toLocaleString('en-US') || 0}`,
        `**Nobles:** ${vitaleText}`,
        `**Servus drain:** ${stabDrain > 0 ? `−${stabDrain.toLocaleString('en-US')} Stability` : 'None'}`,
        `**Stability:** ${updatedUser.rate_stab.toLocaleString('en-US')}/10 | **Prestige:** ${updatedUser.rate_prest.toLocaleString('en-US')}/10`,
        warnBanner || null,
    ].filter(Boolean).join('\n');

    const econEmbed = new EmbedBuilder().setTitle('📊 ECONOMIC REPORT').setColor(warnColor || 0x00FF88).setDescription(econDesc);
    const popEmbed  = new EmbedBuilder().setTitle('👥 POPULATION REPORT').setColor(warnColor || 0x00BFFF).setDescription(popDesc);
    return interaction.editReply({ embeds: [econEmbed, popEmbed] });
}

async function handlePopulation(interaction) {
    const db   = interaction.client.db;
    const user = await db.get('SELECT * FROM users WHERE id = ?', interaction.user.id);

    const { nobles, vitaleNeeded: rawVitaleNeeded, inGracePeriod } = calcNobleState(user);
    const commoners    = user.pop_commoners ?? 100;
    const famineActive = (user.food ?? 0) <= 0;
    const stabDrain    = Math.floor((user.servus || 0) / 5);
    const rank         = getPlayerRank(user);
    const ancestryData = ANCESTRIES[(user.ancestry || '').toUpperCase()];
    const houseData    = ancestryData ? GREAT_HOUSES[ancestryData.house] : null;
    const houseStr     = houseData ? `${houseData.emoji} ${houseData.name}` : 'Independent';
    const armyMaint    = calcMaintenance(user);

    const mothersRel = await db.get(
        'SELECT score FROM relations WHERE user_id=? AND faction_name=?', interaction.user.id, 'The Mothers'
    );
    let vitaleNeeded = rawVitaleNeeded;
    if (mothersRel?.score >= 10 && rank === 'SOVEREIGN') vitaleNeeded = Math.ceil(vitaleNeeded / 2);

    const isSubsidized    = !user.nation;
    const hasEnoughVitale = isSubsidized || (user.vitale ?? 0) >= vitaleNeeded;
    let vitaleStr;
    if (isSubsidized || rank !== 'SOVEREIGN' || isVitaleFree(user.ancestry)) {
        vitaleStr = nobles > 0 ? `${nobles} (${vitaleNeeded.toLocaleString('en-US')} 💧 subsidized)` : `None (pop below 200)`;
    } else if (inGracePeriod) {
        vitaleStr = `${nobles} (${vitaleNeeded.toLocaleString('en-US')} 💧 grace)`;
    } else if (!hasEnoughVitale) {
        vitaleStr = `${nobles} (${vitaleNeeded.toLocaleString('en-US')} 💧 ⚠️ DEFICIT)`;
    } else {
        vitaleStr = `${nobles} (${vitaleNeeded.toLocaleString('en-US')} 💧 ✅)`;
    }

    const servusWarn = (user.servus || 0) > 0 && (user.rate_stab ?? 0) - stabDrain <= -3 ? ` ⚠️ Rebellion risk` : '';
    const warnBanner = formatWarningBanner(user.rate_stab, user.rate_prest);
    const desc = [
        `**Rank:** ${rank} | **House:** ${houseStr}`,
        `**Commoners:** ${commoners.toLocaleString('en-US')}`,
        `⚒️ Mil ${user.mil_militia?.toLocaleString('en-US') || 0} | ⚔️ Inf: ${user.mil_infantry?.toLocaleString('en-US') || 0} | 🐎 Cav: ${user.mil_cavalry?.toLocaleString('en-US') || 0} | 🏹 Rng: ${user.mil_ranged?.toLocaleString('en-US') || 0} | 🪨 Sie: ${user.mil_siege?.toLocaleString('en-US') || 0}`,
        (user.mercs_temp || 0) > 0 ? `🗡️ Mercs: ${user.mercs_temp.toLocaleString('en-US')} *(disband at turn end)*` : null,
        `Army upkeep: ${armyMaint.toLocaleString('en-US')} 🥩/day`,
        ``,
        `Food: ${famineActive ? '🔴 FAMINE — −1%/day!' : '✅'}`,
        `Nobles: ${vitaleStr}`,
        `Servus: ${user.servus || 0}${servusWarn}${stabDrain > 0 ? ` (−${stabDrain.toLocaleString('en-US')} Stab)` : ''}`,
        warnBanner ? `\n${warnBanner}` : null,
    ].filter(Boolean).join('\n');

    const embed = new EmbedBuilder().setTitle('👥 CENSUS REPORT')
        .setColor(warnBanner ? (warnBanner.startsWith('🔴') ? 0xFF4444 : 0xFFCC00) : 0x00BFFF)
        .setDescription(desc);
    return interaction.editReply({ embeds: [embed] });
}

async function handleBalance(interaction) {
    const db        = interaction.client.db;
    const user      = await db.get('SELECT * FROM users WHERE id = ?', interaction.user.id);
    const servusCount = user.servus || 0;
    const stabDrain   = Math.floor(servusCount / 5);
    const armyMaint   = calcMaintenance(user);

    let servusLine = `🔗 Servus: ${servusCount}`;
    if (servusCount > 0) {
        servusLine += ` *(−${stabDrain} Stability/tick)*`;
        if ((user.rate_stab ?? 0) - stabDrain <= -3) servusLine += ` ⚠️ Rebellion risk`;
    }

    const embed = new EmbedBuilder().setTitle('💰 TREASURY').setColor(0xFFD700)
        .setDescription([
            `🪙 Balance: ${user.balance?.toLocaleString('en-US') || 0}  |  ⚖️ Wealth: ${user.wealth?.toLocaleString('en-US') || 0}`,
            ``,
            `🥩 Food: ${user.food?.toLocaleString('en-US') || 0}  |  ⚒️ Ores: ${user.ores?.toLocaleString('en-US') || 0}`,
            `🔩 Metallurgy: ${user.metallurgy?.toLocaleString('en-US') || 0}  |  💧 Vitale: ${user.vitale?.toLocaleString('en-US') || 0}`,
            `🍷 Exotics: ${user.exotics?.toLocaleString('en-US') || 0}`,
            servusLine,
            ``,
            `⚒️ Mil ${user.mil_militia?.toLocaleString('en-US') || 0}  ⚔️ Inf: ${user.mil_infantry?.toLocaleString('en-US') || 0}  🐎 Cav: ${user.mil_cavalry?.toLocaleString('en-US') || 0}  🏹 Rng: ${user.mil_ranged?.toLocaleString('en-US') || 0}  🪨 Sie: ${user.mil_siege?.toLocaleString('en-US') || 0}`,
            `🗡️ Mercs: ${user.mercs_temp?.toLocaleString('en-US') || 0}  |  Upkeep: ${armyMaint?.toLocaleString('en-US')} 🥩/day`,
        ].join('\n'));
    return interaction.editReply({ embeds: [embed] });
}

async function handleDonate(interaction) {
    const db     = interaction.client.db;
    const amount = interaction.options.getInteger('amount');
    const user   = await db.get('SELECT balance FROM users WHERE id = ?', interaction.user.id);
    const cost   = amount * 1000;
    if ((user.balance || 0) < cost)
        return interaction.editReply({ content: `⚠️ Insufficient Balance. You need **${cost.toLocaleString()} 🪙** to convert **${amount} ⚖️**.` });
    await db.run('UPDATE users SET balance = balance - ?, wealth = COALESCE(wealth, 0) + ? WHERE id = ?', cost, amount, interaction.user.id);
    return interaction.editReply({ content: `✅ Converted **${cost.toLocaleString()} 🪙** → **${amount} ⚖️** Polity Wealth.` });
}

async function handleGift(interaction) {
    const db       = interaction.client.db;
    const targetId = interaction.options.getString('target');
    const res      = interaction.options.getString('resource');
    const amount   = interaction.options.getInteger('amount');
    if (isNaN(amount) || amount <= 0) return interaction.editReply({ content: '⚠️ Invalid input.' });
    if (targetId === interaction.user.id) return interaction.editReply({ content: '⚠️ You cannot gift resources to yourself.' });
    const target = await db.get('SELECT id FROM users WHERE id = ?', targetId);
    if (!target) return interaction.editReply({ content: '⚠️ Target lineage not found.' });
    const user = await db.get('SELECT * FROM users WHERE id = ?', interaction.user.id);
    if ((user[res] || 0) < amount) return interaction.editReply({ content: `⚠️ Insufficient ${res}. You have **${user[res] || 0}**.` });
    await db.run(`UPDATE users SET ${res} = ${res} - ? WHERE id = ?`, amount, interaction.user.id);
    await db.run(`UPDATE users SET ${res} = COALESCE(${res}, 0) + ? WHERE id = ?`, amount, targetId);
    return interaction.editReply({ content: `🎁 Gifted **${amount.toLocaleString('en-US')} ${res.toUpperCase()}** to <@${targetId}>.` });
}

async function handleTrade(interaction) {
    const db     = interaction.client.db;
    const userId = interaction.user.id;

    const routes = await db.all("SELECT * FROM trade_routes WHERE initiator_id=? AND status NOT IN ('completed','broken')", userId);
    const routeList = routes.length > 0
        ? routes.map(r => {
            const dur = r.turns_remaining !== null ? `${r.turns_remaining} turns left` : `indefinite`;
            return `**#${r.id}**: ${r.give_amount.toLocaleString('en-US')} ${r.give_resource} → ${r.partner_type === 'player' ? `<@${r.partner_id}>` : (FACTION_DISPLAY_NAMES[r.partner_type] || r.partner_type)} | ${dur}`;
        }).join('\n')
        : 'No active trade routes.';

    const emb = new EmbedBuilder()
        .setTitle('🤝 TRADE CENTER').setColor(0x00BFFF)
        .setDescription([
            '**1. One-Time Trade** — exchange resources immediately with a player.',
            '**2. Trade Routes** — recurring exchanges with factions or players.',
            '',
            `**Active Routes (${routes.length}):**`,
            routeList,
        ].join('\n'));

    const players     = await getActivePlayers(db, userId);
    const oneTimeMenu = new StringSelectMenuBuilder()
        .setCustomId(`trade_onedone_${userId}`)
        .setPlaceholder('1️⃣ One-Time Trade — select a player...')
        .addOptions(players.length > 0 ? players.slice(0, 25).map(p => ({
            label: `${p.ruler_name || p.username}${p.nation ? ' of ' + p.nation : ''}`, value: p.id
        })) : [{ label: 'No players available', value: 'none' }]);

    const routeMenu = new StringSelectMenuBuilder()
        .setCustomId(`trade_route_${userId}`)
        .setPlaceholder('2️⃣ Trade Routes — manage...')
        .addOptions([
            { label: 'View My Routes',        value: 'list',      description: 'Show all active trade routes' },
            { label: 'New Route (Faction)',   value: 'new',       description: 'Recurring route with Styx/Sciatic/Caossa' },
            { label: 'New Route (Player)',    value: 'newplayer', description: 'Recurring route with another player' },
        ]);

    if (routes.length > 0) {
        routeMenu.addOptions(routes.slice(0, 23).map(r => ({
            label: `Cancel #${r.id}: ${r.give_resource}→${r.partner_type}`,
            value: `cancel_${r.id}`,
            description: `${r.give_amount} ${r.give_resource} per turn`,
        })));
    }

    return interaction.editReply({ embeds: [emb], components: [
        new ActionRowBuilder().addComponents(oneTimeMenu),
        new ActionRowBuilder().addComponents(routeMenu),
    ]});
}

async function handleEmpire(interaction) {
    const db     = interaction.client.db;
    const userId = interaction.user.id;
    const emb    = await renderEmpireEmbed(db);
    const rel    = await db.get('SELECT score FROM relations WHERE user_id=? AND faction_name=?', userId, 'Tyrannite');
    if (rel && rel.score <= -20) emb.setFooter({ text: 'Embargoed — seek Vitale through player trade.' });
    return interaction.editReply({ embeds: [emb], components: [] });
}

async function renderEmpireEmbed(db) {
    // vitalePool, vitaleSold, demandRatio derived below via getFactionExchangeRate

    // Use the shared S&D function so the display is always consistent with what
    // executeFactionTrade would charge. relScore=0 → neutral display price.
    const rateInfo     = await getFactionExchangeRate(db, 'styx', 'wealth', 'vitale', 0);
    const vitalePool   = rateInfo.pool;
    const vitaleSold   = rateInfo.weeklyVolume;
    const demandRatio  = rateInfo.demandRatio;
    // ceil: displayed price is always ≥ 1 ⚖️ and never under-charges
    const vitalePrice  = Math.ceil(1 / rateInfo.marginalRate);
    const basePriceStr = Math.ceil(1 / rateInfo.baseRate).toLocaleString('en-US'); // "40" at zero demand

    // Vassal census
    const STYX_HOUSES  = ['TYRANNITE', 'RHAGAIA', 'SELLESELA', 'GAIUS', 'CAOSSA'];
    const styxPlayers  = await db.all(
        "SELECT id, mil_militia, mil_spearmen, mil_swordsman, mil_shield, mil_cavalry, mil_ranged, mil_siege, nation, ruler_name, username FROM users WHERE status='active'"
    );
    const { ANCESTRIES } = require('../../data/constants');
    let vassalCount = 0, totalStyxMil = 0;
    const vassalNames = [];
    for (const p of styxPlayers) {
        const ancRow = await db.get('SELECT ancestry FROM users WHERE id=?', p.id || '');
        const house  = ANCESTRIES[(ancRow?.ancestry || '').toUpperCase()]?.house;
        if (house && STYX_HOUSES.includes(house)) {
            vassalCount++;
            totalStyxMil += (p.mil_militia||0)+(p.mil_spearmen||0)+(p.mil_swordsman||0)+
                            (p.mil_shield||0)+(p.mil_cavalry||0)+(p.mil_ranged||0)+(p.mil_siege||0);
            const name = p.ruler_name || p.username || 'Unknown';
            vassalNames.push(p.nation ? `${name} of ${p.nation}` : name);
        }
    }
    const vassalStr = vassalCount > 0
        ? `${vassalCount} vassal(s) | ⚔️ ${totalStyxMil.toLocaleString('en-US')} total military`
        : 'No vassals sworn';

    return new EmbedBuilder()
        .setTitle('🏛️ STYX EMPIRE DASHBOARD')
        .setColor(0x6A0DAD)
        .setDescription([
            `**Vitale Market**`,
            `Pool: ${vitalePool} 💧 | Sold this week: ${vitaleSold.toLocaleString('en-US')} 💧`,
            `Demand: ${buildDemandBar(demandRatio)}`,
            `Current price: **${vitalePrice.toLocaleString('en-US')} ⚖️** per unit`,
            `*(base price at zero demand: ${basePriceStr} ⚖️ — rises as supply is consumed)*`,
            ``,
            `**Styx Empire Status**`,
            `${vassalStr}`,
            vassalNames.length > 0 ? `Nations: ${vassalNames.join(', ')}` : null,
            ``,
            `*Market resets each Monday. Route trades are priced via the integral S&D model.*`,
        ].filter(Boolean).join('\n'));
}

async function handleButton(interaction, action, args) {
    const db = interaction.client.db;

    if (action === 'tmodalg') {
        const modal = new ModalBuilder().setCustomId(`tmodalg_${args[0]}`).setTitle('🎁 Set What You Give');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('res').setLabel('Resource (wealth, food, etc)').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('wealth')),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('amt').setLabel('Amount').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('100'))
        );
        return interaction.showModal(modal);
    }

    if (action === 'tmodalr') {
        const modal = new ModalBuilder().setCustomId(`tmodalr_${args[0]}`).setTitle('🤝 Set What You Request');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('res').setLabel('Resource (wealth, food, etc)').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('food')),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('amt').setLabel('Amount').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('50'))
        );
        return interaction.showModal(modal);
    }

    // ── Vitale buy: show integral-priced modal ─────────────────────────────────
    // Player enters how much WEALTH to spend; they receive vitale calculated via
    // executeFactionTrade (wealth→vitale, Styx, integral S&D model).
    if (action === 'vitale' && args[0] === 'buy') {
        const rel = await db.get('SELECT score FROM relations WHERE user_id=? AND faction_name=?', interaction.user.id, 'Tyrannite');
        if (rel && rel.score <= -20) return ephemeralReply(interaction, '🚫 Embargoed by Styx Empire.');
        const relScore = rel?.score ?? 0;

        // Live rate so the modal label always reflects current supply
        const rateInfo    = await getFactionExchangeRate(db, 'styx', 'wealth', 'vitale', relScore);
        const approxPrice = Math.ceil(1 / rateInfo.marginalRate); // ⚖️ per 💧 at current margin
        const supplyPct   = Math.round(rateInfo.demandRatio * 100);
        const supplyNote  = rateInfo.demandRatio >= 0.8 ? '🔴 HIGH demand' :
                            rateInfo.demandRatio >= 0.5 ? '🟡 MODERATE demand' : '🟢 Fresh supply';

        const modal = new ModalBuilder()
            .setCustomId(`vitale_wealthmod_${relScore}`)
            .setTitle(`💧 Buy Vitale — ~${approxPrice}⚖️/unit`);
        modal.addComponents(new ActionRowBuilder().addComponents(
            new TextInputBuilder()
                .setCustomId('wealth_amt')
                .setLabel(`Wealth to spend  (${supplyNote}, ${supplyPct}% used)`)
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setPlaceholder(`e.g. ${approxPrice * 10} → ~10 vitale`)
        ));
        return interaction.showModal(modal);
    }

    if (action === 'empire' && args[0] === 'back') {
        await interaction.deferUpdate();
        return handleEmpire(interaction);
    }

    // ── One-time player trade: accept ─────────────────────────────────────────
    if (action === 'ta' && args[0] === 'accept') {
        const tradeId   = parseInt(args[1]);
        const trade     = await db.get("SELECT * FROM pending_trades WHERE id=? AND partner_id=? AND status='pending'", tradeId, interaction.user.id);
        if (!trade) return ephemeralReply(interaction, '⚠️ Trade no longer valid.');
        const initiator = await db.get('SELECT * FROM users WHERE id=?', trade.initiator_id);
        const partner   = await db.get('SELECT * FROM users WHERE id=?', trade.partner_id);
        if (!partner)   return ephemeralReply(interaction, '⚠️ Player not found.');
        if ((initiator[trade.give_resource] || 0) < trade.give_amount)
            return ephemeralReply(interaction, `⚠️ Initiator no longer has enough ${trade.give_resource}. Trade cancelled.`);
        if ((partner[trade.recv_resource] || 0) < trade.recv_amount)
            return ephemeralReply(interaction, `⚠️ You no longer have enough ${trade.recv_resource}. Trade cancelled.`);

        await db.run(`UPDATE users SET ${trade.give_resource}=${trade.give_resource}-?, ${trade.recv_resource}=COALESCE(${trade.recv_resource},0)+? WHERE id=?`, trade.give_amount, trade.recv_amount, trade.initiator_id);
        await db.run(`UPDATE users SET ${trade.recv_resource}=${trade.recv_resource}-?, ${trade.give_resource}=COALESCE(${trade.give_resource},0)+? WHERE id=?`, trade.recv_amount, trade.give_amount, trade.partner_id);
        await db.run("UPDATE pending_trades SET status='completed' WHERE id=?", tradeId);

        await interaction.update({ content: `✅ Trade accepted! You gave **${trade.recv_amount.toLocaleString('en-US')} ${RESOURCE_LABELS[trade.recv_resource] || trade.recv_resource}** and received **${trade.give_amount.toLocaleString('en-US')} ${RESOURCE_LABELS[trade.give_resource] || trade.give_resource}**.`, embeds: [], components: [] });
        const confirmMsg = { content: `✅ <@${trade.partner_id}> accepted your trade! You gave **${trade.give_amount.toLocaleString('en-US')} ${RESOURCE_LABELS[trade.give_resource] || trade.give_resource}**, received **${trade.recv_amount.toLocaleString('en-US')} ${RESOURCE_LABELS[trade.recv_resource] || trade.recv_resource}**.` };
        try { await (await (await interaction.client.users.fetch(trade.initiator_id)).createDM()).send(confirmMsg); }
        catch (_) { await sendToPlayer(interaction.client, interaction, trade.initiator_id, confirmMsg); }
        return;
    }

    // ── One-time player trade: decline ────────────────────────────────────────
    if (action === 'ta' && args[0] === 'decline') {
        const tradeId = parseInt(args[1]);
        const trade   = await db.get("SELECT * FROM pending_trades WHERE id=? AND partner_id=? AND status='pending'", tradeId, interaction.user.id);
        if (!trade) return ephemeralReply(interaction, '⚠️ Trade no longer valid.');
        await db.run("UPDATE pending_trades SET status='declined' WHERE id=?", tradeId);
        await interaction.update({ content: '❌ Trade declined.', embeds: [], components: [] });
        const declineMsg = { content: `❌ <@${trade.partner_id}> declined your trade offer.` };
        try { await (await (await interaction.client.users.fetch(trade.initiator_id)).createDM()).send(declineMsg); }
        catch (_) { await sendToPlayer(interaction.client, interaction, trade.initiator_id, declineMsg); }
        return;
    }

    // ── Faction trade route: "Enter Amount & Duration" button ─────────────────
    // customId: trade_facconfirm_{userId}_{faction}_{giveRes}_{recvRes}
    if (action === 'trade' && args[0] === 'facconfirm') {
        const [userId, faction, giveRes, recvRes] = args.slice(1);
        if (interaction.user.id !== userId) return ephemeralReply(interaction, '⚠️ Only the player who opened this may use it.');

        const giveLabel = RESOURCE_LABELS[giveRes] || giveRes;
        const recvLabel = RESOURCE_LABELS[recvRes] || recvRes;
        const modal     = new ModalBuilder()
            .setCustomId(`trade_facmod_${userId}_${faction}_${giveRes}_${recvRes}`)
            .setTitle(`Route: ${giveLabel} → ${recvLabel}`);
        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('give_amt')
                    .setLabel(`${giveLabel} to give per turn`)
                    .setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('e.g. 500')
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('duration')
                    .setLabel('Duration in turns (blank = indefinite)')
                    .setStyle(TextInputStyle.Short).setRequired(false)
                    .setPlaceholder('e.g. 5   — leave blank for ongoing')
            )
        );
        return interaction.showModal(modal);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

async function handleModal(interaction, action, args) {
    const db = interaction.client.db;

    // ── One-time player trade: submit and DM partner ───────────────────────────
    if (action === 'trade' && args[0] === 'onedonemod') {
        const [,userId, partnerId, giveRes, recvRes] = args;
        const giveAmt = parseInt(interaction.fields.getTextInputValue('give_amt'));
        const recvAmt = parseInt(interaction.fields.getTextInputValue('recv_amt'));
        if (isNaN(giveAmt) || giveAmt <= 0 || isNaN(recvAmt) || recvAmt <= 0)
            return ephemeralReply(interaction, '⚠️ Invalid amounts.');

        const user    = await db.get('SELECT * FROM users WHERE id=?', userId);
        const partner = await db.get("SELECT * FROM users WHERE id=? AND status='active'", partnerId);
        if (!partner) return ephemeralReply(interaction, '⚠️ Partner not found or inactive.');
        if ((user[giveRes] || 0) < giveAmt)
            return ephemeralReply(interaction, `⚠️ Insufficient ${RESOURCE_LABELS[giveRes] || giveRes} (you have ${(user[giveRes] || 0).toLocaleString('en-US')}).`);

        const result  = await db.run(
            'INSERT INTO pending_trades (initiator_id, partner_id, give_resource, give_amount, recv_resource, recv_amount, status, created_at) VALUES (?,?,?,?,?,?,?,?)',
            userId, partnerId, giveRes, giveAmt, recvRes, recvAmt, 'pending', Date.now()
        );
        const tradeId = result.lastID;

        const propEmb = new EmbedBuilder().setTitle('🤝 TRADE PROPOSAL').setColor(0x00BFFF)
            .setDescription([
                `<@${userId}> proposes a trade:`,
                '',
                `**They give you:** ${giveAmt.toLocaleString('en-US')} ${RESOURCE_LABELS[giveRes] || giveRes}`,
                `**You give them:** ${recvAmt.toLocaleString('en-US')} ${RESOURCE_LABELS[recvRes] || recvRes}`,
                '',
                `*Nothing is transferred until you accept. Offer expires on bot restart.*`,
            ].join('\n'));
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`ta_accept_${tradeId}`).setLabel('✅ Accept').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`ta_decline_${tradeId}`).setLabel('❌ Decline').setStyle(ButtonStyle.Danger)
        );

        let deliveredViaDM = false;
        try {
            const pUser = await interaction.client.users.fetch(partnerId);
            await (await pUser.createDM()).send({ content: `<@${partnerId}> — you have a trade offer!`, embeds: [propEmb], components: [row] });
            deliveredViaDM = true;
        } catch (_) {
            await sendToPlayer(interaction.client, interaction, partnerId, { content: `<@${partnerId}> — you have a trade offer!`, embeds: [propEmb], components: [row] });
        }

        return ephemeralReply(interaction, deliveredViaDM
            ? `📨 Proposal sent to <@${partnerId}> via DM. Awaiting their response.`
            : `📨 Proposal sent to <@${partnerId}>'s notification channel (DMs disabled). Awaiting their response.`
        );
    }

    // ── Player trade route: amounts modal ─────────────────────────────────────
    if (action === 'trade' && args[0] === 'newplayer' && args[1] === 'mod') {
        const initiatorId = args[2];
        const partnerId   = args[3];
        if (initiatorId === partnerId) return ephemeralReply(interaction, '⚠️ Cannot trade with yourself.');
        const giveRes  = args[4];
        const recvRes  = args[5];
        const giveAmt  = parseInt(interaction.fields.getTextInputValue('give_amt'));
        const recvAmt  = parseInt(interaction.fields.getTextInputValue('recv_amt'));
        const duration = Math.min(10, Math.max(1, parseInt(interaction.fields.getTextInputValue('duration')) || 1));
        if (isNaN(giveAmt) || giveAmt <= 0 || isNaN(recvAmt) || recvAmt <= 0)
            return ephemeralReply(interaction, '⚠️ Invalid amounts.');

        const target = await db.get("SELECT id FROM users WHERE id=? AND status='active'", partnerId);
        if (!target) return ephemeralReply(interaction, '⚠️ Partner not found.');

        const result  = await db.run(
            'INSERT INTO trade_routes (initiator_id, partner_id, partner_type, give_resource, give_amount, receive_resource, receive_amount, duration_turns, turns_remaining, status) VALUES (?,?,?,?,?,?,?,?,?,?)',
            initiatorId, partnerId, 'player', giveRes, giveAmt, recvRes, recvAmt, duration, duration, 'pending'
        );
        const routeId = result.lastID;

        const propEmb = new EmbedBuilder().setTitle('🤝 TRADE ROUTE PROPOSAL').setColor(0x00BFFF)
            .setDescription([
                `<@${initiatorId}> proposes a recurring route:`,
                ``,
                `Give: **${giveAmt.toLocaleString('en-US')} ${RESOURCE_LABELS[giveRes] || giveRes}** per turn`,
                `Receive: **${recvAmt.toLocaleString('en-US')} ${RESOURCE_LABELS[recvRes] || recvRes}** per turn`,
                `Duration: **${duration} turn(s)**`,
            ].join('\n'));
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`traderoute_a_${routeId}`).setLabel('✅ Accept').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`traderoute_r_${routeId}`).setLabel('❌ Reject').setStyle(ButtonStyle.Danger)
        );

        try {
            const pUser = await interaction.client.users.fetch(partnerId);
            await (await pUser.createDM()).send({ content: `<@${partnerId}> — trade route proposal!`, embeds: [propEmb], components: [row] });
        } catch (_) {
            const chan = await getNotificationChannel(interaction.client, { id: partnerId, notification_channel: null, last_tax_channel: null });
            if (chan) { try { await chan.send({ content: `<@${partnerId}>`, embeds: [propEmb], components: [row] }); } catch (_2) {} }
        }
        return ephemeralReply(interaction, `📨 Route proposal sent to <@${partnerId}>. Awaiting their acceptance.`);
    }

    // ── Faction trade route: create with integral-priced receive_amount ────────
    // customId: trade_facmod_{userId}_{faction}_{giveRes}_{recvRes}
    if (action === 'trade' && args[0] === 'facmod') {
        const [, userId, faction, giveRes, recvRes] = args;
        const giveAmt      = parseInt(interaction.fields.getTextInputValue('give_amt'));
        const durationRaw  = interaction.fields.getTextInputValue('duration')?.trim();
        const durationTurns = durationRaw ? Math.max(1, parseInt(durationRaw) || 1) - 1 : null; // null = indefinite

        if (isNaN(giveAmt) || giveAmt <= 0)
            return ephemeralReply(interaction, '⚠️ Invalid amount.');

        const user = await db.get('SELECT * FROM users WHERE id=?', userId);
        if ((user[giveRes] || 0) < giveAmt)
            return ephemeralReply(interaction, `⚠️ Insufficient ${RESOURCE_LABELS[giveRes] || giveRes} — you have ${(user[giveRes] || 0).toLocaleString('en-US')}.`);

        // Embargo check
        const factionDbName = FACTION_DB_NAMES[faction];
        if (factionDbName) {
            const rel = await db.get('SELECT score FROM relations WHERE user_id=? AND faction_name=?', userId, factionDbName);
            if (rel && rel.score <= -10)
                return ephemeralReply(interaction, `🚫 **Embargoed** — relations with **${factionDbName}** are Hostile (${rel.score}).`);
        }

        // Validate the pair exists
        if (!FACTION_BASE_RATES[faction]?.[giveRes]?.[recvRes])
            return ephemeralReply(interaction, `⚠️ **${FACTION_DISPLAY_NAMES[faction] || faction}** does not trade ${RESOURCE_LABELS[giveRes] || giveRes} → ${RESOURCE_LABELS[recvRes] || recvRes}.`);

        // Cap check before any work
        const pool = FACTION_WEEKLY_POOLS[faction] || 5000;
        if (giveAmt > pool * 3) {
            return ephemeralReply(interaction, [
                `⚠️ **Transaction too large.** The per-trade cap for ${FACTION_DISPLAY_NAMES[faction] || faction} is **${(pool * 3).toLocaleString('en-US')} ${RESOURCE_LABELS[giveRes] || giveRes}**.`,
                `Split it across multiple turns — that's what trade routes are for.`,
            ].join('\n'));
        }

        // Fetch current relation for pricing
        const relRow   = await db.get('SELECT score FROM relations WHERE user_id=? AND faction_name=?', userId, factionDbName || '');
        const relScore = relRow?.score ?? 0;

        // Calculate first-tick receive amount to show the player; also used as the
        // stored receive_amount (scheduler will recalculate each subsequent tick).
        let recvAmount, breakdown;
        try {
            ({ recvAmount, breakdown } = await executeFactionTrade(db, faction, giveRes, recvRes, giveAmt, relScore));
        } catch (err) {
            if (err.code === 'TRADE_TOO_LARGE')
                return ephemeralReply(interaction, `⚠️ Single-turn cap is **${err.max.toLocaleString('en-US')}** for this faction. Try a smaller per-turn amount.`);
            return ephemeralReply(interaction, `⚠️ Trade failed: ${err.message}`);
        }

        if (recvAmount <= 0)
            return ephemeralReply(interaction, `⚠️ Market saturated — giving ${giveAmt.toLocaleString('en-US')} ${RESOURCE_LABELS[giveRes] || giveRes} yields < 1 ${RESOURCE_LABELS[recvRes] || recvRes} this week. Wait for the Monday reset.`);

        // Deduct first-tick resources immediately
        await db.run(
            `UPDATE users SET ${giveRes} = MAX(0, COALESCE(${giveRes}, 0) - ?), ${recvRes} = COALESCE(${recvRes}, 0) + ? WHERE id = ?`,
            giveAmt, recvAmount, userId
        );

        if (durationTurns > 0) {
            // Insert standing route for subsequent ticks (receive_amount will be
            // recalculated by the scheduler each tick; stored here as first-tick value for reference)
            await db.run(
                "INSERT INTO trade_routes (initiator_id, partner_id, partner_type, give_resource, give_amount, receive_resource, receive_amount, duration_turns, turns_remaining, status) VALUES (?,NULL,?,?,?,?,?,?,?,'active')",
                userId, faction, giveRes, giveAmt, recvRes, recvAmount, durationTurns, durationTurns
            );
        }

        // Build confirmation embed
        const avgRate   = (recvAmount / giveAmt).toFixed(4);
        const relPct    = ((breakdown.relMult - 1) * 100).toFixed(0);
        const relSign   = breakdown.relMult >= 1 ? `+${relPct}%` : `${relPct}%`;
        const durStr    = durationTurns !== null ? `${durationTurns} turn(s)` : `indefinite (until relations drop below −10 or you cancel)`;
        const overflowNote = breakdown.overflow > 0
            ? `\n⚠️ **${breakdown.overflow.toLocaleString('en-US')} units were traded at the floor rate** (supply pool exhausted). Smaller per-turn amounts get better rates.`
            : '';

        await interaction.deferUpdate();
        return interaction.editReply({ embeds: [
            new EmbedBuilder()
                .setTitle(`✅ Trade Route Established — ${FACTION_DISPLAY_NAMES[faction] || faction}`)
                .setColor(breakdown.overflow > 0 ? 0xFFCC00 : 0x00FF88)
                .setDescription([
                    `**First tick executed immediately:**`,
                    `  Gave: ${giveAmt.toLocaleString('en-US')} ${RESOURCE_LABELS[giveRes] || giveRes}`,
                    `  Received: ${recvAmount.toLocaleString('en-US')} ${RESOURCE_LABELS[recvRes] || recvRes}`,
                    `  Avg rate: ${avgRate} | Relation modifier: ${relSign}`,
                    overflowNote,
                    ``,
                    `**Standing route duration:** ${durStr}`,
                    `*The scheduler will re-execute this route each tick at live rates.*`,
                    `*Use \`/atlas trade\` → View My Routes to cancel.*`,
                ].filter(l => l !== null).join('\n'))
        ], components: [] });
    }

    if (action === 'tmodalg') {
        const res = interaction.fields.getTextInputValue('res')?.trim().toLowerCase();
        const amt = parseInt(interaction.fields.getTextInputValue('amt'));
        if (isNaN(amt) || amt <= 0) return ephemeralReply(interaction, '⚠️ Invalid input.');
        const user = await db.get('SELECT * FROM users WHERE id=?', interaction.user.id);
        if (user[res] < amt) return ephemeralReply(interaction, `⚠️ Insufficient ${res}.`);
        return ephemeralReply(interaction, `✅ You will give **${amt} ${res}**.\nClick **Set What You Request** to continue.`);
    }

    if (action === 'tmodalr') {
        const res = interaction.fields.getTextInputValue('res')?.trim().toLowerCase();
        const amt = parseInt(interaction.fields.getTextInputValue('amt'));
        if (isNaN(amt) || amt <= 0) return ephemeralReply(interaction, '⚠️ Invalid input.');
        return ephemeralReply(interaction, `✅ You will request **${amt} ${res}**.\nBoth sides set — use the trade embed to confirm or start over.`);
    }

    // ── Vitale purchase: spend wealth, receive vitale via integral S&D ─────────
    // customId: vitale_wealthmod_{relScore}
    // The relScore in args[1] is a snapshot shown in the modal label for UX context only.
    // We always re-fetch the live score before executing to prevent stale-value exploits.
    if (action === 'vitale' && args[0] === 'wealthmod') {
        const wealthAmt = parseInt(interaction.fields.getTextInputValue('wealth_amt')?.trim());
        if (isNaN(wealthAmt) || wealthAmt <= 0) return ephemeralReply(interaction, '⚠️ Invalid amount.');

        await interaction.deferUpdate();
        const userId = interaction.user.id;
        const user   = await db.get('SELECT wealth, nation FROM users WHERE id = ?', userId);

        if (!user.nation)
            return interaction.editReply({ content: '⚠️ You must found a nation to trade with the Styx Empire.', embeds: [], components: [] });
        if ((user.wealth || 0) < wealthAmt)
            return interaction.editReply({ content: `⚠️ Insufficient Wealth. You need **${wealthAmt.toLocaleString('en-US')} ⚖️** but only have **${(user.wealth || 0).toLocaleString('en-US')} ⚖️**.`, embeds: [], components: [] });

        // Re-fetch live relation — never trust the snapshot for pricing
        const rel = await db.get('SELECT score FROM relations WHERE user_id=? AND faction_name=?', userId, 'Tyrannite');
        if (rel && rel.score <= -20)
            return interaction.editReply({ content: '🚫 **Embargoed** — your relations with the Styx Empire are Hostile. Improve standing to resume trade.', embeds: [], components: [] });
        const relScore = rel?.score ?? 0;

        let recvAmount, breakdown;
        try {
            ({ recvAmount, breakdown } = await executeFactionTrade(db, 'styx', 'wealth', 'vitale', wealthAmt, relScore));
        } catch (err) {
            if (err.code === 'TRADE_TOO_LARGE')
                return interaction.editReply({ content: `⚠️ Single-purchase cap is **${err.max.toLocaleString('en-US')} ⚖️** for the Styx vitale market. Try a smaller amount.`, embeds: [], components: [] });
            return interaction.editReply({ content: `⚠️ Trade failed: ${err.message}`, embeds: [], components: [] });
        }

        if (recvAmount <= 0)
            return interaction.editReply({ content: `⚠️ Market saturated — **${wealthAmt.toLocaleString('en-US')} ⚖️** yields less than 1 💧 this week. Wait for the Monday reset or try a larger amount.`, embeds: [], components: [] });

        // executeFactionTrade already updated demand_styx_vitale; just move resources
        await db.run(
            'UPDATE users SET wealth = wealth - ?, vitale = COALESCE(vitale, 0) + ? WHERE id = ?',
            wealthAmt, recvAmount, userId
        );

        const avgPrice = (wealthAmt / recvAmount).toFixed(1);
        const relPct   = ((breakdown.relMult - 1) * 100).toFixed(0);
        const relSign  = breakdown.relMult >= 1 ? `+${relPct}%` : `${relPct}%`;
        const overNote = breakdown.overflow > 0
            ? `\n⚠️ **${breakdown.overflow.toLocaleString('en-US')} ⚖️ traded at floor rate** (weekly pool exhausted). Smaller purchases get better rates.`
            : '';

        const emb = await renderEmpireEmbed(db);
        return interaction.editReply({
            content: [
                `💧 **Transaction complete.**`,
                `Spent **${wealthAmt.toLocaleString('en-US')} ⚖️** → received **${recvAmount.toLocaleString('en-US')} 💧 Vitale**`,
                `Avg cost: **${avgPrice} ⚖️/unit** | Relation modifier: ${relSign}${overNote}`,
            ].join('\n'),
            embeds: [emb],
            components: [],
        });
    }
}

async function handleSelect(interaction, action, args) {
    const db = interaction.client.db;

    if (action === 'empire' && args[0] === 'factiontrade') {
        const userId  = args[1];
        const faction = interaction.values[0];
        if (interaction.user.id !== userId) return ephemeralReply(interaction, '⚠️ Only the player who opened this may use it.');
        const modal = new ModalBuilder()
            .setCustomId(`empire_factionmodal_${userId}_${faction}`)
            .setTitle(`🤝 Trade with ${FACTION_DISPLAY_NAMES[faction] || faction}`);
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('give_res').setLabel('Resource you give').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('wealth')),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('give_amt').setLabel('Amount you give').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('100')),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('recv_res').setLabel('Resource you want').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('vitale'))
        );
        return interaction.showModal(modal);
    }

    // ── One-time trade: player selected ───────────────────────────────────────
    if (action === 'trade' && args[0] === 'onedone') {
        const userId    = args[1];
        const partnerId = interaction.values[0];
        if (interaction.user.id !== userId) return ephemeralReply(interaction, '⚠️ Only the player who opened this may use it.');
        if (partnerId === 'none' || partnerId === userId) return ephemeralReply(interaction, '⚠️ Invalid selection.');
        await interaction.deferUpdate();
        const RESOURCE_OPTIONS = [
            { label: '💰 Balance (coins)', value: 'balance' }, { label: '⚖️ Wealth',    value: 'wealth' },
            { label: '🥩 Food',            value: 'food' },    { label: '⚒️ Ores',       value: 'ores' },
            { label: '🔩 Metallurgy',       value: 'metallurgy' }, { label: '💧 Vitale', value: 'vitale' },
            { label: '🍷 Exotics',          value: 'exotics' },
        ];
        const giveMenu = new StringSelectMenuBuilder()
            .setCustomId(`trade_odgive_${userId}_${partnerId}`)
            .setPlaceholder('What will YOU give?')
            .addOptions(RESOURCE_OPTIONS);
        return interaction.editReply({
            embeds: [new EmbedBuilder().setTitle('🤝 ONE-TIME TRADE').setColor(0x00BFFF)
                .setDescription(`Trading with <@${partnerId}>\n\n**Step 1:** What resource will you give?\n\n*The partner will receive a DM to approve or decline before anything transfers.*`)],
            components: [new ActionRowBuilder().addComponents(giveMenu)],
        });
    }

    if (action === 'trade' && args[0] === 'odgive') {
        const userId    = args[1];
        const partnerId = args[2];
        const giveRes   = interaction.values[0];
        if (interaction.user.id !== userId) return ephemeralReply(interaction, '⚠️ Only the player who opened this may use it.');
        await interaction.deferUpdate();
        const opts = [
            { label: '💰 Balance (coins)', value: 'balance' }, { label: '⚖️ Wealth',    value: 'wealth' },
            { label: '🥩 Food',            value: 'food' },    { label: '⚒️ Ores',       value: 'ores' },
            { label: '🔩 Metallurgy',       value: 'metallurgy' }, { label: '💧 Vitale', value: 'vitale' },
            { label: '🍷 Exotics',          value: 'exotics' },
        ].filter(o => o.value !== giveRes);
        const recvMenu = new StringSelectMenuBuilder().setCustomId(`trade_odrecv_${userId}_${partnerId}_${giveRes}`).setPlaceholder('What do you WANT in return?').addOptions(opts);
        return interaction.editReply({
            embeds: [new EmbedBuilder().setTitle('🤝 ONE-TIME TRADE').setColor(0x00BFFF)
                .setDescription(`Trading with <@${partnerId}>\nYou give: **${RESOURCE_LABELS[giveRes] || giveRes}**\n\n**Step 2:** What resource do you want?`)],
            components: [new ActionRowBuilder().addComponents(recvMenu)],
        });
    }

    if (action === 'trade' && args[0] === 'odrecv') {
        const userId    = args[1];
        const partnerId = args[2];
        const giveRes   = args[3];
        const recvRes   = interaction.values[0];
        if (interaction.user.id !== userId) return ephemeralReply(interaction, '⚠️ Only the player who opened this may use it.');
        const user  = await db.get('SELECT * FROM users WHERE id=?', userId);
        const modal = new ModalBuilder()
            .setCustomId(`trade_onedonemod_${userId}_${partnerId}_${giveRes}_${recvRes}`)
            .setTitle('🤝 Trade Amounts');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('give_amt').setLabel(`${RESOURCE_LABELS[giveRes] || giveRes} to give (have ${(user[giveRes] || 0).toLocaleString('en-US')})`).setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('100')),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('recv_amt').setLabel(`${RESOURCE_LABELS[recvRes] || recvRes} to request from them`).setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('50'))
        );
        return interaction.showModal(modal);
    }

    // ── Route management ──────────────────────────────────────────────────────
    if (action === 'trade' && args[0] === 'route') {
        const userId = args[1];
        const val    = interaction.values[0];
        if (interaction.user.id !== userId) return ephemeralReply(interaction, '⚠️ Only the player who opened this may use it.');
        if (val === 'list') {
            await interaction.deferUpdate();
            return require('./trade').handleTradeRouteList(interaction);
        }
        if (val === 'new') {
            await interaction.deferUpdate();
            const factionMenu = new StringSelectMenuBuilder().setCustomId(`trade_facsel_${userId}`)
                .setPlaceholder('Select faction...')
                .addOptions(
                    { label: '🏛️ Styx Empire',   value: 'styx',    description: 'Vitale, Metallurgy, Ores' },
                    { label: '⚙️ Sciatic League', value: 'sciatic', description: 'Food, Ores, Wealth' },
                    { label: '⚒️ Caossa',         value: 'caossa',  description: 'Metallurgy, Exotics, Ores' }
                );
            return interaction.editReply({
                embeds: [new EmbedBuilder().setTitle('🏛️ Faction Trade Route').setColor(0x00BFFF)
                    .setDescription('Select a faction. Rates shift with weekly supply & demand and your standing with them.\n\nYou will set a **per-turn give amount** and an optional **duration** (or leave blank for indefinite).')],
                components: [new ActionRowBuilder().addComponents(factionMenu)],
            });
        }
        if (val === 'newplayer') {
            const uid     = args[1];
            const players = await getActivePlayers(db, uid);
            if (!players.length) return ephemeralReply(interaction, 'No other active players.');
            const pMenu = new StringSelectMenuBuilder().setCustomId(`trade_newplayer_${uid}`).setPlaceholder('Select a player...')
                .addOptions(players.slice(0, 25).map(p => ({ label: `${p.ruler_name || p.username}${p.nation ? ' of ' + p.nation : ''}`, value: p.id })));
            await interaction.deferUpdate();
            return interaction.editReply({
                embeds: [new EmbedBuilder().setTitle('📨 New Player Route').setColor(0x00BFFF).setDescription('Select a player for a continuous trade route. They must approve via DM before it activates.')],
                components: [new ActionRowBuilder().addComponents(pMenu)]
            });
        }
        if (val.startsWith('cancel_')) {
            const routeId  = parseInt(val.split('_')[1]);
            await interaction.deferUpdate();
            const tradeMod = require('./trade');
            return await tradeMod.handleTradeRouteCancel(interaction, routeId);
        }
        return ephemeralReply(interaction, 'Select a specific route below to cancel it.');
    }

    // ── Player route: player selected → give dropdown ─────────────────────────
    if (action === 'trade' && args[0] === 'newplayer') {
        const initiatorId = args[1];
        const partnerId   = interaction.values[0];
        if (interaction.user.id !== initiatorId) return ephemeralReply(interaction, '⚠️ Only the player who opened this may use it.');
        await interaction.deferUpdate();
        const ROUTE_RESOURCES = [
            { label: '💰 Balance',   value: 'balance' }, { label: '⚖️ Wealth',      value: 'wealth' },
            { label: '🥩 Food',      value: 'food' },    { label: '⚒️ Ores',         value: 'ores' },
            { label: '🔩 Metallurgy', value: 'metallurgy' }, { label: '💧 Vitale',   value: 'vitale' },
            { label: '🍷 Exotics',   value: 'exotics' },
        ];
        const giveMenu = new StringSelectMenuBuilder()
            .setCustomId(`trade_plrgive_${initiatorId}_${partnerId}`)
            .setPlaceholder('What will you GIVE each turn?')
            .addOptions(ROUTE_RESOURCES);
        return interaction.editReply({
            embeds: [new EmbedBuilder().setTitle('📨 PLAYER TRADE ROUTE').setColor(0x00BFFF).setDescription(`Route with <@${partnerId}>\n\n**Step 1:** What resource will you give each turn?`)],
            components: [new ActionRowBuilder().addComponents(giveMenu)]
        });
    }

    // ── Player route: give selected → recv dropdown ───────────────────────────
    if (action === 'trade' && args[0] === 'plrgive') {
        const initiatorId = args[1];
        const partnerId   = args[2];
        const giveRes     = interaction.values[0];
        if (interaction.user.id !== initiatorId) return ephemeralReply(interaction, '⚠️ Only the player who opened this may use it.');
        await interaction.deferUpdate();
        const ROUTE_RESOURCES = [
            { label: '💰 Balance',   value: 'balance' }, { label: '⚖️ Wealth',      value: 'wealth' },
            { label: '🥩 Food',      value: 'food' },    { label: '⚒️ Ores',         value: 'ores' },
            { label: '🔩 Metallurgy', value: 'metallurgy' }, { label: '💧 Vitale',   value: 'vitale' },
            { label: '🍷 Exotics',   value: 'exotics' },
        ].filter(o => o.value !== giveRes);
        const recvMenu = new StringSelectMenuBuilder()
            .setCustomId(`trade_plrrecv_${initiatorId}_${partnerId}_${giveRes}`)
            .setPlaceholder('What will you RECEIVE each turn?')
            .addOptions(ROUTE_RESOURCES);
        return interaction.editReply({
            embeds: [new EmbedBuilder().setTitle('📨 PLAYER TRADE ROUTE').setColor(0x00BFFF).setDescription(`Route with <@${partnerId}>\nYou give: **${RESOURCE_LABELS[giveRes] || giveRes}**\n\n**Step 2:** What resource will you receive?`)],
            components: [new ActionRowBuilder().addComponents(recvMenu)]
        });
    }

    // ── Player route: recv selected → amounts modal ───────────────────────────
    if (action === 'trade' && args[0] === 'plrrecv') {
        const initiatorId = args[1];
        const partnerId   = args[2];
        const giveRes     = args[3];
        const recvRes     = interaction.values[0];
        if (interaction.user.id !== initiatorId) return ephemeralReply(interaction, '⚠️ Only the player who opened this may use it.');
        const modal = new ModalBuilder()
            .setCustomId(`trade_newplayer_mod_${initiatorId}_${partnerId}_${giveRes}_${recvRes}`)
            .setTitle('📨 Route Amounts');
        modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('give_amt').setLabel(`${RESOURCE_LABELS[giveRes] || giveRes} to give per turn`).setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('100')),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('recv_amt').setLabel(`${RESOURCE_LABELS[recvRes] || recvRes} to receive per turn`).setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('50')),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('duration').setLabel('Duration (1-10 turns)').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('3'))
        );
        return await interaction.showModal(modal);
    }

    // ── Faction trade: faction selected → embargo check + give dropdown ───────
    if (action === 'trade' && args[0] === 'facsel') {
        const userId  = args[1];
        const faction = interaction.values[0];
        if (interaction.user.id !== userId) return ephemeralReply(interaction, '⚠️ Only the player who opened this may use it.');
        await interaction.deferUpdate();

        const factionDbName = FACTION_DB_NAMES[faction];
        if (factionDbName) {
            const rel = await db.get('SELECT score FROM relations WHERE user_id=? AND faction_name=?', userId, factionDbName);
            if (rel && rel.score <= -10)
                return interaction.editReply({ content: `🚫 **Embargoed** — Your relations with **${factionDbName}** are Hostile (${rel.score}). Bribe or gift them above −10 to resume trading.`, embeds: [], components: [] });
        }

        // Build give options restricted to what this faction actually accepts
        const acceptedGive  = Object.keys(FACTION_BASE_RATES[faction] || {});
        const ALL_RESOURCES = [
            { label: '💰 Balance',    value: 'balance' },
            { label: '⚖️ Wealth',     value: 'wealth' },
            { label: '🥩 Food',       value: 'food' },
            { label: '⚒️ Ores',       value: 'ores' },
            { label: '🔩 Metallurgy',  value: 'metallurgy' },
            { label: '🍷 Exotics',     value: 'exotics' },
            { label: '🔗 Servus',      value: 'servus' },
        ].filter(o => acceptedGive.includes(o.value));

        const resMenu = new StringSelectMenuBuilder()
            .setCustomId(`trade_facgive_${userId}_${faction}`)
            .setPlaceholder('Select resource you GIVE...')
            .addOptions(ALL_RESOURCES);

        return interaction.editReply({
            embeds: [new EmbedBuilder()
                .setTitle(`🤝 Trade with ${FACTION_DISPLAY_NAMES[faction] || faction}`)
                .setColor(0x00BFFF)
                .setDescription(`**What will you give?**\n\nRates adjust weekly with supply & demand. Choose a resource ${FACTION_DISPLAY_NAMES[faction]} accepts.`)],
            components: [new ActionRowBuilder().addComponents(resMenu)]
        });
    }

    // ── Faction trade: give selected → recv dropdown ──────────────────────────
    if (action === 'trade' && args[0] === 'facgive') {
        const userId  = args[1];
        const faction = args[2];
        const giveRes = interaction.values[0];
        if (interaction.user.id !== userId) return ephemeralReply(interaction, '⚠️ Only the player who opened this may use it.');
        await interaction.deferUpdate();

        const acceptedRecv = Object.keys(FACTION_BASE_RATES[faction]?.[giveRes] || {});
        const ALL_RECV = [
            { label: '💰 Balance',    value: 'balance' },
            { label: '⚖️ Wealth',     value: 'wealth' },
            { label: '🥩 Food',       value: 'food' },
            { label: '⚒️ Ores',       value: 'ores' },
            { label: '🔩 Metallurgy',  value: 'metallurgy' },
            { label: '💧 Vitale',      value: 'vitale' },
            { label: '🍷 Exotics',     value: 'exotics' },
            { label: '🔗 Servus',      value: 'servus' },
        ].filter(o => acceptedRecv.includes(o.value));

        if (!ALL_RECV.length)
            return interaction.editReply({ content: `⚠️ ${FACTION_DISPLAY_NAMES[faction] || faction} has no available trades for **${RESOURCE_LABELS[giveRes] || giveRes}** this week.`, embeds: [], components: [] });

        const resMenu = new StringSelectMenuBuilder()
            .setCustomId(`trade_facrecv_${userId}_${faction}_${giveRes}`)
            .setPlaceholder('Select resource you WANT...')
            .addOptions(ALL_RECV);

        return interaction.editReply({
            embeds: [new EmbedBuilder()
                .setTitle(`🤝 Trade with ${FACTION_DISPLAY_NAMES[faction] || faction}`)
                .setColor(0x00BFFF)
                .setDescription(`You give: **${RESOURCE_LABELS[giveRes] || giveRes}**\n\n**What do you want in return?**`)],
            components: [new ActionRowBuilder().addComponents(resMenu)]
        });
    }

    // ── Faction trade: recv selected → live rate preview + confirm button ─────
    if (action === 'trade' && args[0] === 'facrecv') {
        const userId  = args[1];
        const faction = args[2];
        const giveRes = args[3];
        const recvRes = interaction.values[0];
        if (interaction.user.id !== userId) return ephemeralReply(interaction, '⚠️ Only the player who opened this may use it.');
        await interaction.deferUpdate();

        const rateInfo = await getFactionExchangeRate(db, faction, giveRes, recvRes);
        if (!rateInfo) {
            return interaction.editReply({ content: `⚠️ This trade pair is not available.`, embeds: [], components: [] });
        }

        const giveLabel = RESOURCE_LABELS[giveRes] || giveRes;
        const recvLabel = RESOURCE_LABELS[recvRes] || recvRes;
        const demandBarStr = buildDemandBar(rateInfo.demandRatio);

        // Compute some example amounts so players know what to expect
        const { baseRate, relMult, weeklyVolume: v0, pool: P, sensitivity: S } = rateInfo;
        const examples = [100, 500, 1000].map(n => {
            const within = Math.max(0, Math.min(n, P - v0));
            const over   = Math.max(0, n - within);
            let recv = 0;
            if (within > 0)
                recv += baseRate * relMult * (P / S) *
                        Math.log((P + (v0 + within) * S) / Math.max(1e-9, P + v0 * S));
            if (over > 0)
                recv += over * baseRate * relMult * 0.05;
            const tag = over > 0 ? ` *(pool overflow — split across turns for better rates)*` : '';
            return `  ${n.toLocaleString('en-US')} ${giveLabel} → **${Math.floor(recv).toLocaleString('en-US')} ${recvLabel}**${tag}`;
        });

        const degradationNote = rateInfo.demandRatio > 0
            ? `\n⚠️ Supply ${Math.round(rateInfo.demandRatio * 100)}% used — rate is ${((1 - rateInfo.marginalRate / rateInfo.baseRate) * 100).toFixed(1)}% below base.`
            : `\n✅ Supply fresh — you're getting the best available rate.`;

        const previewEmb = new EmbedBuilder()
            .setTitle(`💱 ${FACTION_DISPLAY_NAMES[faction] || faction} — Market Preview`)
            .setColor(rateInfo.demandRatio >= 0.8 ? 0xFF4444 : rateInfo.demandRatio >= 0.5 ? 0xFFCC00 : 0x00FF88)
            .setDescription([
                `**Exchange:** ${giveLabel} → ${recvLabel}`,
                `**Marginal rate:** ${rateInfo.marginalRate.toFixed(4)} ${recvRes} per 1 ${giveRes}`,
                `**Base rate (zero demand):** ${rateInfo.baseRate.toFixed(4)}`,
                '',
                `**Weekly supply:** ${demandBarStr}`,
                `Used: ${rateInfo.weeklyVolume.toLocaleString('en-US')} / ${rateInfo.pool.toLocaleString('en-US')}${degradationNote}`,
                '',
                `**Example trades at current rate:**`,
                ...examples,
                '',
                `*Click below to enter your amount. Resources transfer immediately upon confirmation.*`,
            ].join('\n'));

        const confirmBtn = new ButtonBuilder()
            .setCustomId(`trade_facconfirm_${userId}_${faction}_${giveRes}_${recvRes}`)
            .setLabel('📋 Enter Amount & Confirm →')
            .setStyle(ButtonStyle.Primary);

        return interaction.editReply({ embeds: [previewEmb], components: [new ActionRowBuilder().addComponents(confirmBtn)] });
    }
}

module.exports = {
    handleTax, handlePopulation, handleBalance, handleDonate, handleGift,
    handleTrade, handleEmpire, handleButton, handleModal, handleSelect,
    FACTION_BASE_RATES, FACTION_WEEKLY_POOLS, FACTION_DB_NAMES,
    getFactionExchangeRate,
    calculateFactionRouteReturn,
    executeFactionTrade,
};