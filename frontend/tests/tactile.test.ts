import { describe, expect, it } from "vitest";
import { elasticValue, nearestDetent, projectRelease, rubberBand, VelocityTracker, WEIGHTS } from "@/components/ui/tactile/physics";

describe("tactile physics", () => {
  it("rubber-bands past the ends: always moves, never past the limit", () => {
    const limit = 6;
    const a = rubberBand(5, limit);
    const b = rubberBand(50, limit);
    const c = rubberBand(5000, limit);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
    expect(c).toBeLessThan(limit);
    expect(rubberBand(-50, limit)).toBeCloseTo(-b, 10);
    expect(rubberBand(0, limit)).toBe(0);
  });

  it("only displays elastic travel outside the range", () => {
    const p = WEIGHTS.medium;
    expect(elasticValue(42, p)).toBe(42);
    expect(elasticValue(130, p)).toBeGreaterThan(100);
    expect(elasticValue(130, p)).toBeLessThan(100 + p.rubber);
    expect(elasticValue(-30, p)).toBeLessThan(0);
  });

  it("heavier controls need more travel, stop sooner and resist harder at the ends", () => {
    const { heavy, medium, light } = WEIGHTS;
    expect(heavy.travelPx).toBeGreaterThan(medium.travelPx);
    expect(medium.travelPx).toBeGreaterThan(light.travelPx);
    expect(heavy.power).toBeLessThan(light.power);
    expect(heavy.rubber).toBeLessThan(light.rubber);
    expect(heavy.flickThreshold).toBeGreaterThan(light.flickThreshold);
  });

  it("estimates release velocity from recent samples only", () => {
    const t = new VelocityTracker(100);
    t.add(0, 0);
    t.add(5, 400); // stale by the time we release
    t.add(10, 450);
    t.add(20, 500);
    expect(t.velocity(500)).toBeCloseTo(((20 - 5) / 100) * 1000, 5);
    expect(t.velocity(2000)).toBe(0); // nothing recent: the hand had stopped
  });

  it("a slow release stays put; a flick carries, heavier controls carry less, and nothing leaves the range", () => {
    expect(projectRelease(50, 10, WEIGHTS.medium)).toBe(50);
    const heavy = projectRelease(50, 200, WEIGHTS.heavy);
    const light = projectRelease(50, 200, WEIGHTS.light);
    expect(heavy).toBeGreaterThan(50);
    expect(light).toBeGreaterThan(heavy);
    expect(projectRelease(95, 5000, WEIGHTS.light)).toBe(100);
    expect(projectRelease(3, -5000, WEIGHTS.light)).toBe(0);
  });

  it("snaps to the nearest detent", () => {
    const detents = [-60, -30, 0, 30, 60];
    expect(nearestDetent(-44, detents)).toBe(1);
    expect(nearestDetent(14, detents)).toBe(2);
    expect(nearestDetent(16, detents)).toBe(3);
    expect(nearestDetent(500, detents)).toBe(4);
  });
});
