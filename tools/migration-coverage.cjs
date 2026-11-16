const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const root = path.resolve(__dirname, '..')
const normalize = value => value.trim().replace(/\s+/g, ' ')

// A deliberately small structural checker for this repository's Prisma-emitted
// SQL subset. It is NOT a SQL executor, migration planner, or PostgreSQL verifier.
function catalog(sql) {
  const tables = new Map(), indexes = new Map(), foreignKeys = new Map()
  const clean = sql.replace(/^\s*--.*$/gm, '')
  for (const match of clean.matchAll(/CREATE TABLE "([^"]+)"\s*\(([\s\S]*?)\);/g)) {
    const columns = new Map()
    for (const column of match[2].matchAll(/^\s*"([^"]+)"\s+([^\n]+)$/gm)) {
      columns.set(column[1], normalize(column[2].replace(/,\s*$/, '')))
    }
    tables.set(match[1], { columns, statement: match[0] })
  }
  for (const match of clean.matchAll(/ALTER TABLE "([^"]+)" ADD COLUMN "([^"]+)" ([^;]+);/g)) {
    if (!tables.has(match[1])) throw new Error(`Unknown table ${match[1]}`)
    tables.get(match[1]).columns.set(match[2], normalize(match[3]))
  }
  for (const match of clean.matchAll(/ALTER TABLE "([^"]+)" ALTER COLUMN "([^"]+)" SET DEFAULT ([^;]+);/g)) {
    const table = tables.get(match[1])
    if (!table?.columns.has(match[2])) throw new Error(`Unknown column ${match[1]}.${match[2]}`)
    const previous = table.columns.get(match[2]).replace(/ DEFAULT .+$/, '')
    table.columns.set(match[2], `${previous} DEFAULT ${normalize(match[3])}`)
  }
  for (const match of clean.matchAll(/CREATE (?:UNIQUE )?INDEX "([^"]+)" ON "([^"]+)"\([^;]+\)(?: NULLS NOT DISTINCT)?;/g)) {
    // Prisma 5 does not model PostgreSQL's stricter nullable-key uniqueness.
    // Structural parity covers columns/index keys, not this additional invariant.
    indexes.set(match[1], { table: match[2], statement: match[0].replace(/ NULLS NOT DISTINCT(?=;)/, '') })
  }
  for (const match of clean.matchAll(/ALTER TABLE "([^"]+)" ADD CONSTRAINT "([^"]+)" FOREIGN KEY [^;]+;/g)) {
    foreignKeys.set(match[2], { table: match[1], statement: match[0] })
  }
  return { tables, indexes, foreignKeys }
}

function compareCatalogs(actual, expected) {
  const gaps = []
  for (const [name, table] of expected.tables) {
    const found = actual.tables.get(name)
    if (!found) { gaps.push(`Missing table ${name}`); continue }
    for (const [column, declaration] of table.columns) {
      if (found.columns.get(column) !== declaration) gaps.push(`Column mismatch ${name}.${column}`)
    }
    for (const column of found.columns.keys()) if (!table.columns.has(column)) gaps.push(`Extra column ${name}.${column}`)
  }
  for (const name of actual.tables.keys()) if (!expected.tables.has(name)) gaps.push(`Extra table ${name}`)
  for (const kind of ['indexes', 'foreignKeys']) {
    for (const [name, entry] of expected[kind]) {
      if (normalize(actual[kind].get(name)?.statement || '') !== normalize(entry.statement)) gaps.push(`${kind} mismatch ${name}`)
    }
    for (const name of actual[kind].keys()) if (!expected[kind].has(name)) gaps.push(`Extra ${kind} ${name}`)
  }
  return gaps
}

function missingSql(baselineSql, targetSql, excluded = new Set(['order_requests'])) {
  const baseline = catalog(baselineSql), target = catalog(targetSql)
  const statements = []
  for (const [name, table] of target.tables) {
    if (excluded.has(name)) continue
    const previous = baseline.tables.get(name)
    if (!previous) { statements.push(table.statement); continue }
    for (const [column, declaration] of table.columns) {
      const before = previous.columns.get(column)
      if (!before) statements.push(`ALTER TABLE "${name}" ADD COLUMN "${column}" ${declaration};`)
      else if (before !== declaration) {
        const withoutDefault = value => value.replace(/ DEFAULT .+$/, '')
        if (withoutDefault(before) !== withoutDefault(declaration) || !declaration.includes(' DEFAULT ')) throw new Error(`Manual review required: ${name}.${column}`)
        statements.push(`ALTER TABLE "${name}" ALTER COLUMN "${column}" SET DEFAULT ${declaration.split(' DEFAULT ')[1]};`)
      }
    }
  }
  for (const kind of ['indexes', 'foreignKeys']) for (const [name, entry] of target[kind]) {
    if (!excluded.has(entry.table) && !baseline[kind].has(name)) statements.push(entry.statement)
  }
  return statements.join('\n\n') + '\n'
}

function expectedSql() {
  const cli = path.join(root, 'node_modules/prisma/build/index.js')
  const result = spawnSync(process.execPath, [cli, 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', path.join(root, 'prisma/schema.prisma'), '--script'], {
    cwd: root, encoding: 'utf8', timeout: 120000,
    env: { ...process.env, DATABASE_URL: 'postgresql://offline:offline@127.0.0.1:1/offline_schema' },
  })
  if (result.error || result.status !== 0) throw new Error(`Offline schema rendering failed: ${result.error?.message || result.stderr}`)
  if (!catalog(result.stdout).tables.size) throw new Error('No tables in rendered target schema')
  return result.stdout
}

function main() {
  const target = process.argv[3] ? fs.readFileSync(process.argv[3], 'utf8') : expectedSql()
  if (process.argv[2] === '--suggest') {
    process.stdout.write(missingSql(fs.readFileSync(path.join(root, 'prisma/migrations/0_init/migration.sql'), 'utf8'), target))
    return
  }
  const directory = path.join(root, 'prisma/migrations')
  const chain = fs.readdirSync(directory).sort().map(name => path.join(directory, name, 'migration.sql'))
    .filter(filename => fs.existsSync(filename)).map(filename => fs.readFileSync(filename, 'utf8')).join('\n')
  const gaps = compareCatalogs(catalog(chain), catalog(target))
  if (gaps.length) throw new Error(gaps.join('\n'))
  console.log('Migration SQL structurally covers the Prisma tables, columns, indexes and foreign keys. No database was contacted; SQL execution/data upgrades remain unverified.')
}

if (require.main === module) {
  try { main() } catch (error) { console.error(error.message); process.exitCode = 1 }
}
module.exports = { catalog, compareCatalogs, missingSql }
