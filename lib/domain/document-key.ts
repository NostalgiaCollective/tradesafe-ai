// JSONB does not preserve object-key order. Compare persisted content, not wire ordering.
export function documentKey(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(documentKey).join(',') + ']'
  if (value !== null && typeof value === 'object') {
    return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => JSON.stringify(key) + ':' + documentKey(item)).join(',') + '}'
  }
  return JSON.stringify(value) ?? 'null'
}
