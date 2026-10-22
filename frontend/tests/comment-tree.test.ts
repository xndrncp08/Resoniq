import { describe, expect, it } from "vitest";
import { buildTree } from "@/lib/comment-tree";

const c = (id: string, parentId: string | null, score = 0) => ({ id, parentId, score });

describe("buildTree", () => {
  const flat = [c("a", null, 1), c("b", null, 5), c("a1", "a", 0), c("a2", "a", 3), c("orphan", "hidden", 0)];
  it("nests replies and sorts by score for top", () => {
    const t = buildTree(flat, "top");
    expect(t.map((n) => n.id)).toEqual(["b", "a", "orphan"]);
    expect(t[1].children.map((n) => n.id)).toEqual(["a2", "a1"]);
  });
  it("puts new threads first but keeps replies chronological", () => {
    const t = buildTree(flat, "new");
    expect(t.map((n) => n.id)).toEqual(["orphan", "b", "a"]);
    expect(t[2].children.map((n) => n.id)).toEqual(["a1", "a2"]);
  });
});
