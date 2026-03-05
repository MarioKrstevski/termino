import pg from 'pg'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const { Client } = pg

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('Missing env: set DATABASE_URL. Run with: node --env-file=.env.local scripts/run-migrations.mjs')
  process.exit(1)
}

const client = new Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false }
})

const migrations = [
  '01_tables.sql',
  '02_rls.sql',
  '03_views_and_rpc.sql',
  '04_sms_logs_appointment_id.sql',
  '05_increment_customer_visits.sql',
  '06_business_total_revenue.sql',
]

async function run() {
  await client.connect()
  console.log('Connected to Supabase')

  for (const file of migrations) {
    const sql = readFileSync(join(__dirname, '../supabase/migrations', file), 'utf8')
    console.log(`\nRunning ${file}...`)
    try {
      await client.query(sql)
      console.log(`✓ ${file} done`)
    } catch (err) {
      console.error(`✗ ${file} failed:`, err.message)
      await client.end()
      process.exit(1)
    }
  }

  await client.end()
  console.log('\nAll migrations completed.')
}

run()
