/**
 * Where a route sits in the app's hierarchy, so a navigation can say which
 * way it's going: deeper (into a song, a tone), shallower (back out), or
 * sideways (between top-level sections). Route transitions use this to
 * pick a direction for the depth move.
 */
export function routeDepth(pathname: string): number {
  if (pathname === "/") return 0;
  if (/^\/(analyze\/[^/]+|t\/[^/]+)/.test(pathname)) return 2;
  return 1;
}

export type NavDirection = "nav-deeper" | "nav-shallower" | "nav-sideways";

export function navDirection(from: string, to: string): NavDirection {
  const a = routeDepth(from);
  const b = routeDepth(to.split(/[?#]/)[0]);
  return b > a ? "nav-deeper" : b < a ? "nav-shallower" : "nav-sideways";
}

/** For `<Link transitionTypes>` / `router.push(..., { transitionTypes })`. */
export const transitionTypesFor = (from: string, to: string) => [navDirection(from, to)];
