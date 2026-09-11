// Display only what was stored. Never fill historical gaps from today's template.
export function legacyAnswers(value: unknown): { label: string; status: string; notes: string }[] {
  const row = (label: string, value: unknown) => {
    const a = value && typeof value === 'object' ? value as Record<string, unknown> : {}
    return { label, status: typeof a.status === 'string' ? a.status : 'unknown', notes: typeof a.notes === 'string' ? a.notes : '' }
  }
  if (Array.isArray(value)) return value.flatMap((item, index) => {
    if (item && Array.isArray(item.items)) return item.items.map((a: Record<string, unknown>, n: number) => row(String(a?.label || a?.item || `${item.category || 'Historical section'} item ${n + 1}`), a))
    return [row(String(item?.label || item?.item || `Historical item ${index + 1}`), item)]
  })
  if (value && typeof value === 'object') return Object.entries(value).map(([label, a]) => row(label.replace('__', ': '), a))
  return []
}
