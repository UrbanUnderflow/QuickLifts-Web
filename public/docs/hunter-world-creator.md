# Hunter World: Creator Integration

## Overview
As the Hunter World ecosystem expands, we must establish a clear narrative and technological framework for our Creators. If the users are "Hunters" exploring the world, entering Gate Events, and battling through Dungeons (Rounds) — then the Creators are the ones designing those Dungeons. 

## The Narrative: "The Architects" (or "Forge Masters")
Creators sit above the standard ranking system in terms of their role, acting as the deities, architects, or dungeon masters of the Pulse world. 

While everyday Hunters earn points by completing workouts, **Architects** earn their prestige by providing the blueprints. They build the Dungeons (Custom Rounds) and orchestrate the Gate Events (Challenges).

When a Hunter looks at a Leaderboard or a Challenge, they should see "Designed by Architect [Creator Name]". 

### The Specialty Class: "Grand Architect"
Within the existing Specialty Class system (`SpecialtyClass.from(categoryPoints:)`), we introduce a new discipline: **Creator / Architect**. 

- **Title:** Grand Architect 
- **Icon:** 🏛️ (or a compass/blueprint icon)
- **Discipline Key:** `creator`
- **Color:** A unique, perhaps gold or glowing white gradient, separating them from the standard Red/Blue/Green training disciplines.

## Technological Implementation

To natively integrate Creators into the Hunter World scoring system, we do not need to rebuild the point system. We can leverage the existing `categoryPoints` structure.

1. **Earning `creator` Points:**
   Whenever a user completes a round built by a Creator, or joins a Challenge hosted by a Creator, the *Creator* receives passive `creator` points. 
   - *Example:* User A completes a 500 Pulse Point round built by Creator B. User A gets 500 `strength` points. Creator B gets 50 `creator` points (a 10% tithe or royalty).
   
2. **Class Assignment:**
   Because the Creator is constantly accumulating `creator` points from hundreds of users completing their programming daily, their `categoryPoints.creator` value will massively outscale their personal workout points. The system will naturally auto-assign them the **Grand Architect** class.

3. **Creator-Specific Leaderboards:**
   The Global Leaderboard will have a filter for "Top Architects," ranking Creators based solely on their `creator` Pulse Points derived from community engagement. This gamifies content creation—the more engaging their workouts, the higher they climb on the Architect Leaderboard.

## Summary
- **Role:** Architects (Dungeon Masters)
- **Class:** Grand Architect
- **Points Mechanism:** Earn passive `creator` points when other users complete their programming.
- **Leaderboard:** Compete to be the Top Architect based on community engagement.
