// Run only when introducing a NEW version/file. Never overwrite an applied snapshot migration.
import { writeFile } from 'node:fs/promises'
import { getTemplate } from '../lib/domain/templates.ts'
const rows = ['electrical','plumbing','roofing'].map(trade => {
  const t = getTemplate(trade)
  const sql = value => "'" + value.replaceAll("'", "''") + "'"
  return `(${sql(t.id)},${sql(t.trade)},${sql(t.version)},${sql(JSON.stringify(t))}::jsonb)`
})
await writeFile('supabase/migrations/20260911000300_template_v1.sql',
  '-- Generated from lib/domain/templates.ts; frozen questions, pending qualified review.\nBEGIN;\nINSERT INTO public.ts_templates(id,trade,version,snapshot) VALUES\n' + rows.join(',\n') + ';\nCOMMIT;\n', { flag: 'wx' })
