/**
 * Seed script — creates demo businesses with staff, services, customers, appointments
 * Uses Supabase Admin API to create auth users, then seeds related data via direct DB connection.
 * Requires: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL
 * Run with: node --env-file=.env.local scripts/seed.mjs
 */
import pg from 'pg'

const { Client } = pg

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DATABASE_URL = process.env.DATABASE_URL

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !DATABASE_URL) {
  console.error('Missing env: set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL')
  console.error('Run with: node --env-file=.env.local scripts/seed.mjs')
  process.exit(1)
}

const client = new Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

async function createAuthUser(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Auth user creation failed: ${JSON.stringify(data)}`)
  // Support both response shapes
  const id = data.id ?? data.user?.id
  if (!id) throw new Error(`No id in response: ${JSON.stringify(data)}`)
  return id
}

async function getOrCreateAuthUser(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, {
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
    },
  })
  const data = await res.json()
  const users = data.users ?? data
  const existing = Array.isArray(users) ? users.find(u => u.email === email) : null
  if (existing) {
    console.log(`  Auth user exists: ${email} (${existing.id})`)
    return existing.id
  }
  const id = await createAuthUser(email, password)
  console.log(`  Created auth user: ${email} (${id})`)
  return id
}

async function run() {
  await client.connect()
  console.log('Connected to Supabase DB\n')

  // ── Create demo owner users ──────────────────────────────────────────
  console.log('Creating auth users...')
  const owner1Id = await getOrCreateAuthUser('demo-barber@termino.test', 'Demo1234!')
  const owner2Id = await getOrCreateAuthUser('demo-nails@termino.test', 'Demo1234!')

  // ── Profiles (auto-created by trigger, but ensure they exist) ────────
  await client.query(`
    INSERT INTO profiles (id, email, role) VALUES
      ($1, 'demo-barber@termino.test', 'owner'),
      ($2, 'demo-nails@termino.test', 'owner')
    ON CONFLICT (id) DO NOTHING
  `, [owner1Id, owner2Id])
  console.log('Profiles ready\n')

  // ── Businesses ───────────────────────────────────────────────────────
  console.log('Creating businesses...')

  const hours = (open, close) => JSON.stringify({
    mon: { open, close }, tue: { open, close }, wed: { open, close },
    thu: { open, close }, fri: { open, close }, sat: { open, close }, sun: null
  })

  const b1Res = await client.query(`
    INSERT INTO businesses (owner_id, name, slug, address, business_type, working_hours_json, sub_status, plan)
    VALUES ($1, 'Kings Cut Barbershop', 'kings-cut', '12 Main Street, Dublin', 'barber', $2, 'active', 'starter')
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `, [owner1Id, hours('09:00', '18:00')])
  const b1 = b1Res.rows[0].id

  const b2Res = await client.query(`
    INSERT INTO businesses (owner_id, name, slug, address, business_type, working_hours_json, sub_status, plan)
    VALUES ($1, 'Glamour Nails & Beauty', 'glamour-nails', '45 High Street, Dublin', 'nail', $2, 'trial', 'free')
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `, [owner2Id, hours('10:00', '19:00')])
  const b2 = b2Res.rows[0].id

  console.log(`  B1 (kings-cut): ${b1}`)
  console.log(`  B2 (glamour-nails): ${b2}\n`)

  // ── Staff ────────────────────────────────────────────────────────────
  console.log('Creating staff...')
  await client.query(`DELETE FROM staff WHERE business_id IN ($1, $2)`, [b1, b2])

  const s1 = await client.query(`
    INSERT INTO staff (business_id, name, active) VALUES
      ($1, 'Marco', true), ($1, 'Jake', true), ($1, 'Danny', true)
    RETURNING id, name
  `, [b1])
  const [marco, jake, danny] = s1.rows

  const s2 = await client.query(`
    INSERT INTO staff (business_id, name, active) VALUES
      ($1, 'Sofia', true), ($1, 'Elena', true)
    RETURNING id, name
  `, [b2])
  const [sofia, elena] = s2.rows
  console.log(`  B1 staff: ${s1.rows.map(r => r.name).join(', ')}`)
  console.log(`  B2 staff: ${s2.rows.map(r => r.name).join(', ')}\n`)

  // ── Services ─────────────────────────────────────────────────────────
  console.log('Creating services...')
  await client.query(`DELETE FROM services WHERE business_id IN ($1, $2)`, [b1, b2])

  const sv1 = await client.query(`
    INSERT INTO services (business_id, name, duration_minutes, price, buffer_minutes, active) VALUES
      ($1, 'Haircut',           30, 25.00, 5, true),
      ($1, 'Haircut + Beard',   45, 35.00, 5, true),
      ($1, 'Beard Trim',        20, 15.00, 5, true),
      ($1, 'Kids Cut',          20, 15.00, 5, true)
    RETURNING id, name
  `, [b1])
  const [haircut, haircutBeard, beardTrim] = sv1.rows

  const sv2 = await client.query(`
    INSERT INTO services (business_id, name, duration_minutes, price, buffer_minutes, active) VALUES
      ($1, 'Gel Manicure',      45, 35.00, 10, true),
      ($1, 'Pedicure',          60, 40.00, 10, true),
      ($1, 'Acrylic Set',       90, 60.00, 15, true),
      ($1, 'Nail Art (per nail)',10,  5.00,  0, true)
    RETURNING id, name
  `, [b2])
  console.log(`  B1 services: ${sv1.rows.map(r => r.name).join(', ')}`)
  console.log(`  B2 services: ${sv2.rows.map(r => r.name).join(', ')}\n`)

  // ── Customers ────────────────────────────────────────────────────────
  console.log('Creating customers...')
  await client.query(`DELETE FROM customers WHERE business_id IN ($1, $2)`, [b1, b2])

  const c1 = await client.query(`
    INSERT INTO customers (business_id, phone_number, name, total_visits) VALUES
      ($1, '+35387001001', 'Liam Murphy',   8),
      ($1, '+35387001002', 'Connor Walsh',  3),
      ($1, '+35387001003', 'Sean O''Brien', 12),
      ($1, '+35387001004', 'Patrick Kelly', 1)
    RETURNING id, name
  `, [b1])
  const [liam, connor, sean, patrick] = c1.rows

  const c2 = await client.query(`
    INSERT INTO customers (business_id, phone_number, name, total_visits) VALUES
      ($1, '+35387002001', 'Aoife Ryan',    5),
      ($1, '+35387002002', 'Niamh Collins', 2),
      ($1, '+35387002003', 'Sarah Byrne',   9)
    RETURNING id, name
  `, [b2])
  console.log(`  B1 customers: ${c1.rows.map(r => r.name).join(', ')}`)
  console.log(`  B2 customers: ${c2.rows.map(r => r.name).join(', ')}\n`)

  // ── Appointments ─────────────────────────────────────────────────────
  console.log('Creating appointments...')
  await client.query(`DELETE FROM appointments WHERE business_id IN ($1, $2)`, [b1, b2])

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = (base, daysOffset, h, m = 0) => {
    const t = new Date(base); t.setDate(t.getDate() + daysOffset); t.setHours(h, m, 0, 0)
    return t.toISOString()
  }
  const dEnd = (base, daysOffset, h, m, mins) => {
    const t = new Date(base); t.setDate(t.getDate() + daysOffset); t.setHours(h, m + mins, 0, 0)
    return t.toISOString()
  }

  // Today — mixed statuses
  await client.query(`
    INSERT INTO appointments (business_id, service_id, staff_id, customer_id, start_time, end_time, status, source)
    VALUES
      ($1, $2, $3, $4, $13, $14, 'completed', 'web'),
      ($1, $2, $5, $6, $15, $16, 'booked',    'web'),
      ($1, $7, $5, $8, $17, $18, 'booked',    'web')
  `, [
    b1, haircut.id, marco.id, liam.id,
    jake.id, connor.id, danny.id, sean.id,
    d(today,0,9,0),  dEnd(today,0,9,0,30),
    d(today,0,11,0), dEnd(today,0,11,0,30),
    d(today,0,14,0), dEnd(today,0,14,0,20),
  ])

  // Tomorrow
  await client.query(`
    INSERT INTO appointments (business_id, service_id, staff_id, customer_id, start_time, end_time, status, source)
    VALUES
      ($1, $2, $3, $4, $9, $10, 'booked', 'manual'),
      ($1, $5, $6, $7, $11, $12, 'booked', 'web')
  `, [
    b1, haircutBeard.id, jake.id, sean.id,
    haircut.id, danny.id, patrick.id,
    d(today,1,10,0), dEnd(today,1,10,0,45),
    d(today,1,13,0), dEnd(today,1,13,0,30),
  ])

  // Past (for revenue)
  const pastApts = await client.query(`
    INSERT INTO appointments (business_id, service_id, staff_id, customer_id, start_time, end_time, status, source)
    VALUES
      ($1, $2, $3, $4, $11, $12, 'completed', 'web'),
      ($1, $2, $5, $6, $13, $14, 'completed', 'web'),
      ($1, $7, $3, $8, $15, $16, 'completed', 'web'),
      ($1, $9, $5, $10, $17, $18, 'no_show',  'web')
    RETURNING id
  `, [
    b1,
    haircut.id, marco.id, liam.id,
    jake.id, connor.id,
    beardTrim.id, sean.id,
    haircutBeard.id, patrick.id,
    d(today,-1,10,0), dEnd(today,-1,10,0,30),
    d(today,-1,14,0), dEnd(today,-1,14,0,30),
    d(today,-2,11,0), dEnd(today,-2,11,0,20),
    d(today,-2,15,0), dEnd(today,-2,15,0,45),
  ])
  console.log(`  Created ${pastApts.rowCount + 5} appointments\n`)

  // ── Payments (revenue data) ───────────────────────────────────────────
  console.log('Creating payments...')
  const [p1, p2, p3] = pastApts.rows
  await client.query(`
    INSERT INTO payments (business_id, appointment_id, amount, tip, payment_method) VALUES
      ($1, $2, 25.00, 5.00, 'cash'),
      ($1, $3, 25.00, 0.00, 'card'),
      ($1, $4, 15.00, 2.00, 'cash')
  `, [b1, p1.id, p2.id, p3.id])
  console.log('  Payments created\n')

  await client.end()

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Seed complete!')
  console.log('')
  console.log('Demo accounts:')
  console.log('  Barber:  demo-barber@termino.test / Demo1234!')
  console.log('  Nails:   demo-nails@termino.test  / Demo1234!')
  console.log('')
  console.log('Booking URLs:')
  console.log('  /book/kings-cut')
  console.log('  /book/glamour-nails')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

run().catch(err => { console.error(err.message); process.exit(1) })
