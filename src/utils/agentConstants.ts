/**
 * ─── Agent Constants (Single Source of Truth) ──────────────
 * All agent metadata lives here. Import from this file
 * instead of hardcoding roles/emojis in individual components.
 */

export const AGENT_ROLES: Record<string, string> = {
    antigravity: 'Co-CEO · Strategy & Architecture',
    nora: 'Director of System Ops',
    scout: 'Influencer Research Analyst',
    solara: 'Brand Voice',
    sage: 'Health Intelligence Researcher',
};

export const AGENT_EMOJIS: Record<string, string> = {
    antigravity: '🌌',
    nora: '⚡',
    scout: '🕵️',
    solara: '❤️‍🔥',
    sage: '⚡',
};
