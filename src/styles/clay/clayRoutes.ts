// Routes that render in Clay, PulseCheck's only visual style. Fit With Pulse
// and QuickLifts routes stay on their own styles.
const CLAY_ADMIN_ROUTES = new Set([
  '/admin/systemOverview',
  '/admin/noraGuard',
  '/admin/adaptationFramingLayer',
  '/admin/sportsIntelligenceReports',
  '/admin/screenDemo',
]);

export function isClayRoute(pathname: string): boolean {
  if (/^\/(PulseCheck|coach|coach-report-demo)(\/|$)/.test(pathname)) return true;
  if (/^\/admin\/pulse[cC]heck/.test(pathname)) return true;
  return CLAY_ADMIN_ROUTES.has(pathname);
}
