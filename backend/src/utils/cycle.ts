/**
 * Detect if adding blockedBy to taskId would create a cycle.
 * @param taskId - The task being updated
 * @param blockedBy - Proposed blockedBy IDs
 * @param graph - Map of taskId -> blockedBy IDs (all existing dependencies)
 */
export function hasCycleInGraph(taskId: string, blockedBy: string[], graph: Map<string, string[]>): boolean {
  const withUpdate = new Map(graph);
  withUpdate.set(taskId, blockedBy);

  const visited = new Set<string>();
  const queue = [...blockedBy];
  while (queue.length) {
    const id = queue.shift()!;
    if (id === taskId) return true;
    if (visited.has(id)) continue;
    visited.add(id);
    const deps = withUpdate.get(id);
    if (deps) queue.push(...deps);
  }
  return false;
}
