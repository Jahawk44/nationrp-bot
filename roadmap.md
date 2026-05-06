# 🚀 Atlas Bot Roadmap

This document outlines planned features and future improvements for the Atlas NationRP Bot.

## 🏆 Rank & Competition
- **Leaderboard Command**: Implement `/atlas ranking` to show top nations/users by:
  - Total Wealth
  - Combined Military Power
  - Number of Settlements
  - Strategic Assets (Exotics)

## 🧬 Character & Progression
- **Better Stats Modifier**: Overhaul the `handleOriginsLogic` stat distribution.
  - Current status: Many characters start with -1 modifiers across the board.
  - Planned: Introduce "Stat Pools" or fixed heritage bonuses to ensure at least 2-3 positive modifiers per build.
- **Stat Leveling**: Allow users to spend experience or gold to increase attributes during Age Transitions.

## 🏺 Dynamic Turn System
- **Event Engine**: Link the weekly turn update to random world events (e.g., Famine, Golden Age, Plague) that affect all players for that week.
- **Tax Scaling**: Scale tax revenue based on current turn number and town infrastructure tiers.

## 🏗️ Settlement Expansion
- **Regional Bonuses**: Add more terrain-specific buildings.
- **Town Defense**: Automated defense rolls when a town is "scouted" or attacked.
- **Resource Management**: Require specific resources (Ores, Vitale) for higher-tier buildings.
