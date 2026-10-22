/** Builds a reply tree from a flat, chronological comment list. Replies whose parent is hidden attach at the top level. */
export type TreeNode<T> = T & { children: TreeNode<T>[] };

export function buildTree<T extends { id: string; parentId: string | null; score: number }>(items: T[], sort: "top" | "new" = "top"): TreeNode<T>[] {
  const nodes = new Map<string, TreeNode<T>>(items.map((i) => [i.id, { ...i, children: [] }]));
  const roots: TreeNode<T>[] = [];
  for (const n of nodes.values()) (n.parentId && nodes.get(n.parentId) ? nodes.get(n.parentId)!.children : roots).push(n);
  // "top": best first at every level. "new": newest threads first, replies oldest-first so they read as a conversation.
  const byScore = (list: TreeNode<T>[]): TreeNode<T>[] => list.sort((a, b) => b.score - a.score).map((n) => ({ ...n, children: byScore(n.children) }));
  return sort === "top" ? byScore(roots) : roots.reverse();
}
