import { ViewTransition, type ReactNode } from "react";

const DIRECTIONS = {
  "nav-deeper": "route-deeper",
  "nav-shallower": "route-shallower",
  "nav-sideways": "route-sideways",
  // Untyped transitions (browser back/forward, router.refresh, Suspense
  // reveals) don't move the page: a refresh after saving shouldn't fly it.
  default: "none",
};

/**
 * Wraps a page's content so navigations move it through depth instead of
 * cutting (CSS in globals.css, eased on a sampled spring curve). It goes in
 * each page, not the layout: layouts persist across navigations, so enter
 * and exit would never fire there. Direction comes from the transition type
 * the link or router.push adds (lib/route-depth.ts).
 */
export default function RouteStage({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter={DIRECTIONS} exit={DIRECTIONS} default="none">
      {children}
    </ViewTransition>
  );
}
