export function applyUpdates(doc: any, updates: Record<string, any>, allowed: string[]) {
  for (const key of allowed) {
    if (updates[key] !== undefined) doc[key] = updates[key];
  }
}
