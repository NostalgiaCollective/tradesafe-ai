// Restricted executable adapter for the task-owned GitHub Linux runner, never a hosted backup tool.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, readdirSync, renameSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { verifyRecoverySet, validateRestoreTarget } from '../../lib/operations/recovery-set.mjs'
import { localEnvironment, API_ORIGIN } from '../ci/local-environment.mjs'

export const ARCHIVE = '.ci-local/recovery-archive'
export const TARGET = 'tradesafe-recovery-target'
export const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const run = (file, args, input) => execFileSync(file, args, { input, stdio: 'pipe', timeout: 120000, maxBuffer: 32 * 1024 * 1024 })
const docker = (id, args, input) => run('docker', ['exec', '-i', id, ...args], input)
const sql = (id, statement) => docker(id, ['psql', '-X', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atc', statement]).toString().trim()
const json = (id, statement) => JSON.parse(sql(id, statement))
const good = result => { assert.equal(result.error, null, 'Local storage operation failed'); return result.data }
const client = status => {
  localEnvironment(status)
  return createClient(API_ORIGIN, status.SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
}
export function identity(project) {
  assert.equal(process.platform, 'linux'); assert.equal(process.env.GITHUB_ACTIONS, 'true')
  assert.equal(process.env.GITHUB_REPOSITORY, 'NostalgiaCollective/tradesafe-ai')
  assert.ok(['tradesafe-ci', TARGET].includes(project))
  const c = JSON.parse(run('docker', ['inspect', 'supabase_db_' + project]))[0]
  assert.equal(c.Name, '/supabase_db_' + project); assert.equal(c.State.Running, true)
  const volumes = c.Mounts.filter(m => m.Type === 'volume').map(m => m.Name).sort()
  assert.ok(volumes.length && volumes.every(v => v.endsWith('_' + project)))
  return { project, container: c.Id, volumes, image: c.Config.Image, imageId: c.Image, system: sql(c.Id, 'select system_identifier from pg_control_system()') }
}
export function assertIdentity(expected) { assert.deepEqual(identity(expected.project), expected) }
export function assertEmptyTarget(expected, source) {
  assertIdentity(expected); assert.equal(expected.project, TARGET)
  assert.notEqual(expected.container, source.container); assert.notEqual(expected.system, source.system)
  assert.ok(expected.volumes.every(v => !source.volumes.includes(v)))
  assert.equal(sql(expected.container, "select (select count(*) from auth.users)+(select count(*) from storage.objects)+(select count(*) from storage.buckets)+(select count(*) from pg_tables where schemaname='public')"), '0')
  validateRestoreTarget({ url: 'postgresql://127.0.0.1:54322/postgres', authorized: true,
    authorizationReference: 'Daniel: synthetic task-owned disposable local recovery rehearsal',
    isolated: true, emptyVerified: true, outboundIntegrationsDisabled: true, supabaseCompatible: true })
}
function inventory(id) {
  const tables = json(id, "select coalesce(json_agg(schemaname||'.'||tablename order by schemaname,tablename),'[]') from pg_tables where schemaname='public' or (schemaname='auth' and tablename in ('users','identities'))")
  const rows = tables.map(table => {
    assert.match(table, /^(public|auth)\.[a-z_]+$/)
    const values = sql(id, 'select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),\'[]\') from ' + table + ' t')
    return { table, rows: JSON.parse(values).length, sha256: sha(values) }
  })
  return { sha256: sha(JSON.stringify(rows)), tables: rows }
}
function protections(id) {
  const result = json(id, `select jsonb_build_object(
    'defaults',(select jsonb_agg(jsonb_build_array(pg_get_userbyid(d.defaclrole),d.defaclobjtype,d.defaclacl) order by pg_get_userbyid(d.defaclrole),d.defaclobjtype) from pg_default_acl d join pg_namespace n on n.oid=d.defaclnamespace where n.nspname='public'),
    'policies',(select jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname) from pg_policies p where schemaname='public' or (schemaname='storage' and tablename='objects')),
    'tables',(select jsonb_agg(jsonb_build_array(c.relname,c.relrowsecurity,coalesce(c.relacl,acldefault('r',c.relowner)),pg_get_userbyid(c.relowner),c.relforcerowsecurity) order by c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'),
    'functions',(select jsonb_agg(jsonb_build_array(p.proname,pg_get_function_identity_arguments(p.oid),p.prosecdef,p.proconfig,coalesce(p.proacl,acldefault('f',p.proowner)),pg_get_userbyid(p.proowner)) order by p.proname,pg_get_function_identity_arguments(p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'))`)
  // PostgreSQL ACL ordering has no authorization meaning and pg_restore may reorder it.
  for (const table of result.tables || []) table[2]?.sort()
  for (const fn of result.functions || []) fn[4]?.sort()
  for (const policy of result.policies || []) policy.roles?.sort()
  for (const defaults of result.defaults || []) defaults[2]?.sort()
  return result
}
function storageInventory(id) {
  return json(id, "select coalesce(json_agg(json_build_object('bucket',bucket_id,'name',name) order by bucket_id,name),'[]') from storage.objects")
}
export async function capture(source, status) {
  console.log('Recovery: capture public schema/data, password identities and private bytes')
  assertIdentity(source); assert.equal(source.project, 'tradesafe-ci')
  const started = performance.now(), storage = client(status)
  mkdirSync(ARCHIVE, { mode: 0o700 })
  const manifest = { version: 3, sourceKind: 'synthetic-local', sourceProject: source.project, sourceUrl: API_ORIGIN,
    schemaCoverage: ['public', 'auth'], grantsAndPoliciesIncluded: true, quietCaptureVerified: true,
    buckets: ['tradesafe-evidence', 'tradesafe-exports', 'tradesafe-packages'], artifacts: [], readyReferences: [], migrations: [],
    beforeInventory: inventory(source.container), beforeStorageInventory: storageInventory(source.container), protections: protections(source.container) }
  const add = (path, kind, bytes, extra = {}) => {
    writeFileSync(ARCHIVE + '/' + path, bytes, { mode: 0o600 })
    const a = { path, kind, bytes: bytes.length, sha256: sha(bytes), ...extra }; manifest.artifacts.push(a); return a
  }
  add('public.dump', 'database', docker(source.container, ['pg_dump', '-U', 'postgres', '-d', 'postgres', '-Fc', '--schema=public']))
  add('auth.dump', 'database', docker(source.container, ['pg_dump', '-U', 'postgres', '-d', 'postgres', '-Fc', '--data-only', '--table=auth.users', '--table=auth.identities']))
  add('storage-policy.dump', 'database', docker(source.container, ['pg_dump', '-U', 'postgres', '-d', 'postgres', '-Fc', '--schema-only', '--table=storage.objects']))
  // Migration ledger recovered separately; no historical migration is replayed on the target.
  add('migrations.dump', 'database', docker(source.container, ['pg_dump', '-U', 'postgres', '-d', 'postgres', '-Fc', '--schema=supabase_migrations']))
  for (const name of readdirSync('supabase/migrations').filter(n => n.endsWith('.sql')).sort()) {
    const bytes = readFileSync('supabase/migrations/' + name)
    add(name, 'migration', bytes); manifest.migrations.push({ name, sha256: sha(bytes) })
  }
  manifest.sourceMigrationVersions = json(source.container, "select coalesce(json_agg(version order by version),'[]') from supabase_migrations.schema_migrations")
  manifest.bucketConfiguration = good(await storage.storage.listBuckets()).map(b => ({ id: b.id, public: b.public, fileSizeLimit: b.file_size_limit, allowedMimeTypes: b.allowed_mime_types })).sort((a,b) => a.id.localeCompare(b.id))
  assert.deepEqual(manifest.bucketConfiguration.map(b => b.id), manifest.buckets)
  assert.ok(manifest.bucketConfiguration.every(b => b.public === false))
  const objects = manifest.beforeStorageInventory
  for (const [index, object] of objects.entries()) {
    assert.ok(manifest.buckets.includes(object.bucket))
    const blob = good(await storage.storage.from(object.bucket).download(object.name))
    add('object-' + index + '.bin', 'object', Buffer.from(await blob.arrayBuffer()), object)
  }
  const references = json(source.container, `select coalesce(json_agg(r),'[]') from (
    select 'tradesafe-evidence' as bucket,object_path,sha256,byte_size from public.ts_evidence where state='ready'
    union all select 'tradesafe-evidence',object_path,sha256,byte_size from public.ts_concern_photos where state='ready'
    union all select 'tradesafe-evidence',object_path,sha256,byte_size from public.ts_action_photos where state='ready'
    union all select 'tradesafe-exports',object_path,sha256,byte_size from public.ts_exports where state='ready'
    union all select 'tradesafe-packages',object_path,sha256,byte_size from public.ts_site_packages where state='ready') r`)
  assert.ok(references.length >= 2)
  for (const r of references) {
    const a = manifest.artifacts.find(a => a.kind === 'object' && a.bucket === r.bucket && a.name === r.object_path)
    assert.ok(a, 'Retained object missing at capture')
    manifest.readyReferences.push({ artifact: a.path, sha256: r.sha256, bytes: r.byte_size })
  }
  manifest.afterInventory = inventory(source.container)
  manifest.afterStorageInventory = storageInventory(source.container)
  assert.deepEqual(manifest.afterStorageInventory, objects)
  await verifyRecoverySet(ARCHIVE, manifest)
  writeFileSync(ARCHIVE + '/manifest.json', JSON.stringify(manifest), { mode: 0o600 })
  return { manifest, backupMs: Math.round(performance.now() - started) }
}
export async function negativeArchiveChecks(manifest) {
  const object = manifest.artifacts.find(a => a.kind === 'object' && !manifest.readyReferences.some(r => r.artifact === a.path))
  assert.ok(object, 'Synthetic interruption fixture must supply unreferenced storage bytes')
  const path = ARCHIVE + '/' + object.path
  const bytes = readFileSync(path)
  renameSync(path, path + '.missing')
  try { await assert.rejects(verifyRecoverySet(ARCHIVE, manifest)) } finally { renameSync(path + '.missing', path) }
  const corrupt = Buffer.from(bytes); corrupt[0] ^= 255
  writeFileSync(path, corrupt)
  try { await assert.rejects(verifyRecoverySet(ARCHIVE, manifest)) } finally { writeFileSync(path, bytes) }
  await assert.rejects(verifyRecoverySet(ARCHIVE, { ...manifest, artifacts: manifest.artifacts.filter(a => a.path !== object.path) }))
  await assert.rejects(verifyRecoverySet(ARCHIVE, { ...manifest, beforeStorageInventory: manifest.beforeStorageInventory.filter(a => a.bucket !== object.bucket || a.name !== object.name), afterStorageInventory: manifest.afterStorageInventory.filter(a => a.bucket !== object.bucket || a.name !== object.name) }))
  await assert.rejects(verifyRecoverySet(ARCHIVE, { ...manifest, beforeStorageInventory: [...manifest.beforeStorageInventory, {bucket:object.bucket,name:object.name}], afterStorageInventory: [...manifest.afterStorageInventory, {bucket:object.bucket,name:object.name}] }))
  await assert.rejects(verifyRecoverySet(ARCHIVE, { ...manifest, artifacts: manifest.artifacts.filter(a => a.path !== 'auth.dump') }))
  await assert.rejects(verifyRecoverySet(ARCHIVE, { ...manifest, artifacts: manifest.artifacts.filter(a => a.path !== manifest.migrations[0].name) }))
  await assert.rejects(verifyRecoverySet(ARCHIVE, { ...manifest, sourceMigrationVersions: manifest.sourceMigrationVersions.slice(1) }))
  const databasePath = ARCHIVE + '/public.dump', database = readFileSync(databasePath), damaged = Buffer.from(database)
  damaged[0] ^= 255; writeFileSync(databasePath, damaged)
  try { await assert.rejects(verifyRecoverySet(ARCHIVE, manifest)) } finally { writeFileSync(databasePath, database) }
  await verifyRecoverySet(ARCHIVE, manifest)
  return ['missing physical object rejected', 'same-length byte corruption rejected', 'missing unreferenced manifest object rejected', 'unlisted storage object rejected', 'duplicate storage inventory object rejected', 'omitted Auth archive rejected', 'corrupt database archive rejected', 'omitted migration source rejected', 'migration ledger mismatch rejected']
}
// Restore every captured object policy. A fixed name list can silently omit new guards.
export function storagePolicyArchiveEntry(line) {
  return /^\d+;\s+\d+\s+\d+\s+POLICY storage objects /.test(line)
}
// The disposable target probe deliberately adds a permissive rule inside a rollback-only
// transaction. Restrictive private guards must still deny both ordinary database roles.
export function privateStorageProbeSql() {
  return `BEGIN;
    CREATE POLICY ts_recovery_probe_permissive ON storage.objects FOR SELECT TO anon,authenticated USING(true);
    SET LOCAL ROLE authenticated;
    SELECT 'authenticated:'||count(*) FROM storage.objects WHERE bucket_id IN ('tradesafe-evidence','tradesafe-exports','tradesafe-packages');
    RESET ROLE;
    SET LOCAL ROLE anon;
    SELECT 'anon:'||count(*) FROM storage.objects WHERE bucket_id IN ('tradesafe-evidence','tradesafe-exports','tradesafe-packages');
    RESET ROLE;
    ROLLBACK;`
}
export async function restore(target, source, status, manifest) {
  const started = performance.now()
  await verifyRecoverySet(ARCHIVE, manifest); assertEmptyTarget(target, source)
  // A fresh Supabase schema already grants defaults to anon/authenticated/service_role.
  // pg_restore restores explicit archived ACLs but cannot subtract extra defaults that
  // were injected during CREATE. Remove only those defaults on this empty target;
  // archived DEFAULT ACL entries restore the source defaults after object creation.
  console.log('Recovery: neutralize empty-target public default grants before restoring exact ACLs')
  assertEmptyTarget(target, source)
  docker(target.container, ['psql', '-X', '-U', 'supabase_admin', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', `DO $$ DECLARE r record; BEGIN
    FOR r IN SELECT DISTINCT pg_get_userbyid(d.defaclrole) AS owner,
      CASE d.defaclobjtype WHEN 'r' THEN 'TABLES' WHEN 'S' THEN 'SEQUENCES' WHEN 'f' THEN 'FUNCTIONS' WHEN 'T' THEN 'TYPES' END AS kind,
      CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(x.grantee)) END AS grantee
      FROM pg_default_acl d JOIN pg_namespace n ON n.oid=d.defaclnamespace CROSS JOIN LATERAL aclexplode(d.defaclacl) x
      WHERE n.nspname='public' AND d.defaclobjtype IN ('r','S','f','T') AND x.grantee<>d.defaclrole
    LOOP EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL PRIVILEGES ON %s FROM %s',r.owner,r.kind,r.grantee); END LOOP;
  END $$;`])
  const restoreArchive = (name, filter) => {
    console.log('Recovery: restore ' + name)
    assertIdentity(target) // Re-check immutable Docker/volume/database identity before every restore write.
    // Supabase's postgres role is deliberately not a superuser. The existing local
    // restore administrator can recreate the archived ACLs/owners without granting
    // anything new to application roles or altering the source's permissions.
    assert.equal(docker(target.container, ['psql', '-X', '-U', 'supabase_admin', '-d', 'postgres', '-Atc', "select current_user||':'||rolsuper from pg_roles where rolname=current_user"]).toString().trim(), 'supabase_admin:true')
    const bytes = readFileSync(ARCHIVE + '/' + name), args = ['pg_restore', '-U', 'supabase_admin', '-d', 'postgres', '--exit-on-error', '--single-transaction']
    if (filter) {
      const list = docker(target.container, ['pg_restore', '--list'], bytes).toString().split('\n').filter(filter).join('\n')
      assert.ok(list.trim())
      const listPath = '.ci-local/restore-list.txt'; writeFileSync(listPath, list)
      run('docker', ['cp', listPath, target.container + ':/tmp/tradesafe-restore-list'])
      args.push('--use-list=/tmp/tradesafe-restore-list')
    }
    try { docker(target.container, args, bytes) } catch (error) {
      const stderr = error.stderr?.toString() || ''
      // Only fixed categories; never print SQL, COPY rows, provider errors or raw stderr.
      const categories = ['must be owner', 'permission denied', 'already exists', 'does not exist', 'violates foreign key', 'violates check constraint', 'duplicate key', 'could not read', 'could not find block', 'could not open', 'not a valid archive', 'unrecognized configuration parameter', 'cannot execute', 'not supported', 'input file does not appear', 'cannot be restored']
      console.error('Recovery restore failure categories: ' + (categories.filter(c => stderr.includes(c)).join(', ') || 'unclassified') + '; exit=' + (Number.isInteger(error.status) ? error.status : 'unknown'))
      throw error
    }
  }
  restoreArchive('auth.dump')
  // Supabase provides an empty public schema; skip only its CREATE SCHEMA entry.
  restoreArchive('public.dump', line => !/ SCHEMA - public /.test(line))
  restoreArchive('migrations.dump')
  restoreArchive('storage-policy.dump', storagePolicyArchiveEntry)
  const storage = client(status)
  console.log('Recovery: restore private buckets/objects and compare inventories/protections')
  for (const b of manifest.bucketConfiguration) {
    assertIdentity(target)
    good(await storage.storage.createBucket(b.id, { public: b.public, fileSizeLimit: b.fileSizeLimit, allowedMimeTypes: b.allowedMimeTypes }))
  }
  console.log('Recovery: bucket restrictions restored')
  for (const a of manifest.artifacts.filter(a => a.kind === 'object')) {
    assertIdentity(target)
    good(await storage.storage.from(a.bucket).upload(a.name, readFileSync(ARCHIVE + '/' + a.path), { upsert: false, contentType: { 'tradesafe-evidence': 'image/jpeg', 'tradesafe-exports': 'application/pdf', 'tradesafe-packages': 'application/zip' }[a.bucket] }))
    const blob = good(await storage.storage.from(a.bucket).download(a.name))
    const bytes = Buffer.from(await blob.arrayBuffer()); assert.equal(bytes.length, a.bytes); assert.equal(sha(bytes), a.sha256)
  }
  console.log('Recovery: object bytes and hashes verified')
  const restoredInventory = inventory(target.container)
  for (const t of manifest.beforeInventory.tables) {
    const restored = restoredInventory.tables.find(r => r.table === t.table)
    if (JSON.stringify(t) !== JSON.stringify(restored)) console.error('Recovery inventory mismatch: ' + t.table + '; rows=' + t.rows + '/' + restored?.rows)
  }
  assert.deepEqual(restoredInventory, manifest.beforeInventory)
  assert.deepEqual(json(target.container, "select coalesce(json_agg(version order by version),'[]') from supabase_migrations.schema_migrations"),manifest.sourceMigrationVersions,'Restored migration ledger differs')
  console.log('Recovery: database records verified')
  const restoredProtections = protections(target.container)
  for (const section of ['policies', 'tables', 'functions', 'defaults']) if (JSON.stringify(restoredProtections[section]) !== JSON.stringify(manifest.protections[section])) console.error('Recovery protection mismatch: ' + section)
  for (const table of manifest.protections.tables) {
    const restored = restoredProtections.tables.find(t => t[0] === table[0])
    // Schema names, RLS flags, owners and database-role ACLs only.
    // Never include row values, function bodies or provider errors in diagnostics.
    if (JSON.stringify(table) !== JSON.stringify(restored)) console.error('Recovery table permission metadata: ' + JSON.stringify({ source: table, target: restored }))
  }
  assert.deepEqual(restoredProtections, manifest.protections)
  assertIdentity(target)
  assert.ok(Number(sql(target.container, "select count(*) from storage.objects where bucket_id='tradesafe-packages'"))>0, 'Private-package recovery probe requires retained synthetic bytes')
  const probe = docker(target.container, ['psql','-X','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1','-Atc',privateStorageProbeSql()]).toString().trim().split('\n').filter(line => /^(authenticated|anon):/.test(line))
  assert.deepEqual(probe, ['authenticated:0','anon:0'], 'Restored restrictive private-storage policies failed')
  assert.deepEqual(protections(target.container), manifest.protections, 'Policy probe must leave no changes')
  console.log('Recovery: restored private storage denies authenticated and anonymous reads under a permissive-policy probe')
  console.log('Recovery: authorization catalog verified')
  const buckets = good(await storage.storage.listBuckets())
  assert.deepEqual(buckets.map(b => b.id).sort(), [...manifest.buckets].sort())
  assert.ok(buckets.every(b => !b.public))
  sql(target.container, "NOTIFY pgrst, 'reload schema'")
  return { restoreMs: Math.round(performance.now() - started), databaseInventory: 'all captured table row counts and digests equal before restored sign-in', protections: 'RLS, public and storage object policies, table grants, function grants/security/search paths match source', privateStorageProbe: 'Authenticated and anonymous reads denied for private evidence, PDFs and packages despite a temporary permissive policy; transaction rolled back', objects: manifest.artifacts.filter(a => a.kind === 'object').map(a => ({ bucket: a.bucket, bytes: a.bytes, sha256: a.sha256 })), versions: { postgres: sql(target.container, 'show server_version'), pgDump: docker(target.container, ['pg_dump', '--version']).toString().trim(), supabase: run('supabase', ['--version']).toString().trim(), node: process.version } }
}
