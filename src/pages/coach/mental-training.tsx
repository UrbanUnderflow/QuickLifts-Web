/**
 * Coach Mental Training Route Alias
 *
 * We keep `/coach/mental-training` as the canonical, lowercase URL.
 * This file re-exports the current implementation from `mentalGames.tsx`
 * to avoid "Page not found" issues when navigating via client-side tabs.
 */

export { default } from './mentalGames';
