/**
 * Dev-only auth bypass.
 *
 * Returns true ONLY when BOTH conditions hold:
 *   1. The build is not production (NODE_ENV !== 'production'), and
 *   2. The explicit NEXT_PUBLIC_DEV_AUTH_BYPASS flag is set to 'true'.
 *
 * The NODE_ENV gate is the real safety net: a production `next build` always
 * sets NODE_ENV to 'production', so this returns false in any deployed build
 * even if the flag accidentally leaks into a production environment.
 *
 * To use locally: set NEXT_PUBLIC_DEV_AUTH_BYPASS=true in .env.local, then run
 * the dev server. Auth guards that call this (e.g. AdminRouteGuard) will render
 * their children without requiring a signed-in admin.
 *
 * NEVER set NEXT_PUBLIC_DEV_AUTH_BYPASS in a production environment.
 */
export const isDevAuthBypassEnabled = (): boolean =>
  process.env.NODE_ENV !== 'production' &&
  process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === 'true';
