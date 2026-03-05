import { createClient } from '@supabase/supabase-js'
import pg from 'pg'

const { Client } = pg

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const databaseUrl = process.env.DATABASE_URL

if (!supabaseUrl || !serviceRoleKey || !databaseUrl) {
  console.error('Missing env: set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL')
  console.error('Run with: node --env-file=.env.local scripts/seed-admin.mjs')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const dbClient = new Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false }
})

async function getOrCreateUser(email, password) {
  const { data: list } = await supabase.auth.admin.listUsers()
  const existing = list?.users?.find(u => u.email === email)
  if (existing) {
    // Update password in case it changed
    await supabase.auth.admin.updateUserById(existing.id, { password, email_confirm: true })
    console.log(`  Updated: ${email} → ${existing.id}`)
    return existing.id
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email, password, email_confirm: true
  })
  if (error) throw new Error(`createUser failed: ${error.message}`)
  console.log(`  Created: ${email} → ${data.user.id}`)
  return data.user.id
}

async function run() {
  await dbClient.connect()
  console.log('Connected\n')

  console.log('Auth users...')
  await getOrCreateUser('mariokrstevski@hotmail.com', 'smajli')
  const owner1Id = await getOrCreateUser('demo-barber@termino.test', 'Demo1234!')
  const owner2Id = await getOrCreateUser('demo-nails@termino.test', 'Demo1234!')
  console.log()

  // Profiles (trigger should have created them, but ensure they exist)
  await dbClient.query(`
    INSERT INTO profiles (id, email, role) VALUES ($1, $2, 'owner'), ($3, $4, 'owner')
    ON CONFLICT (id) DO NOTHING
  `, [owner1Id, 'demo-barber@termino.test', owner2Id, 'demo-nails@termino.test'])

  const hours = (open, close) => JSON.stringify({
    mon: { open, close }, tue: { open, close }, wed: { open, close },
    thu: { open, close }, fri: { open, close }, sat: { open, close }, sun: null
  })

  console.log('Businesses...')
  const b1r = await dbClient.query(`
    INSERT INTO businesses (owner_id, name, slug, address, business_type, working_hours_json, sub_status, plan)
    VALUES ($1,'Kings Cut Barbershop','kings-cut','12 Main Street, Dublin','barber',$2,'active','starter')
    ON CONFLICT (slug) DO UPDATE SET owner_id = EXCLUDED.owner_id RETURNING id
  `, [owner1Id, hours('09:00','18:00')])
  const b1 = b1r.rows[0].id

  const b2r = await dbClient.query(`
    INSERT INTO businesses (owner_id, name, slug, address, business_type, working_hours_json, sub_status, plan)
    VALUES ($1,'Glamour Nails & Beauty','glamour-nails','45 High Street, Dublin','nail',$2,'trial','free')
    ON CONFLICT (slug) DO UPDATE SET owner_id = EXCLUDED.owner_id RETURNING id
  `, [owner2Id, hours('10:00','19:00')])
  const b2 = b2r.rows[0].id
  console.log(`  kings-cut: ${b1}`)
  console.log(`  glamour-nails: ${b2}\n`)

  console.log('Staff...')
  await dbClient.query(`DELETE FROM staff WHERE business_id IN ($1,$2)`, [b1, b2])
  const s1r = await dbClient.query(`
    INSERT INTO staff (business_id, name, active) VALUES ($1,'Marco',true),($1,'Jake',true),($1,'Danny',true) RETURNING id, name
  `, [b1])
  const s2r = await dbClient.query(`
    INSERT INTO staff (business_id, name, active) VALUES ($1,'Sofia',true),($1,'Elena',true) RETURNING id, name
  `, [b2])
  const [marco, jake, danny] = s1r.rows
  console.log(`  B1: ${s1r.rows.map(r=>r.name).join(', ')}`)
  console.log(`  B2: ${s2r.rows.map(r=>r.name).join(', ')}\n`)

  console.log('Services...')
  await dbClient.query(`DELETE FROM services WHERE business_id IN ($1,$2)`, [b1, b2])
  const sv1r = await dbClient.query(`
    INSERT INTO services (business_id, name, duration_minutes, price, buffer_minutes, active) VALUES
    ($1,'Haircut',30,25,5,true),($1,'Haircut + Beard',45,35,5,true),($1,'Beard Trim',20,15,5,true),($1,'Kids Cut',20,15,5,true)
    RETURNING id, name
  `, [b1])
  await dbClient.query(`
    INSERT INTO services (business_id, name, duration_minutes, price, buffer_minutes, active) VALUES
    ($1,'Gel Manicure',45,35,10,true),($1,'Pedicure',60,40,10,true),($1,'Acrylic Set',90,60,15,true),($1,'Nail Art',10,5,0,true)
  `, [b2])
  const [haircut, haircutBeard, beardTrim] = sv1r.rows
  console.log(`  B1: ${sv1r.rows.map(r=>r.name).join(', ')}\n`)

  console.log('Customers...')
  await dbClient.query(`DELETE FROM customers WHERE business_id IN ($1,$2)`, [b1, b2])
  const c1r = await dbClient.query(`
    INSERT INTO customers (business_id, phone_number, name, total_visits) VALUES
    ($1,'+35387001001','Liam Murphy',8),($1,'+35387001002','Connor Walsh',3),
    ($1,'+35387001003','Sean O''Brien',12),($1,'+35387001004','Patrick Kelly',1)
    RETURNING id, name
  `, [b1])
  await dbClient.query(`
    INSERT INTO customers (business_id, phone_number, name, total_visits) VALUES
    ($1,'+35387002001','Aoife Ryan',5),($1,'+35387002002','Niamh Collins',2),($1,'+35387002003','Sarah Byrne',9)
  `, [b2])
  const [liam, connor, sean, patrick] = c1r.rows
  console.log(`  B1: ${c1r.rows.map(r=>r.name).join(', ')}\n`)

  console.log('Appointments + payments...')
  await dbClient.query(`DELETE FROM appointments WHERE business_id IN ($1,$2)`, [b1, b2])

  const today = new Date(); today.setHours(0,0,0,0)
  const ts = (dOffset, h, m=0) => { const d=new Date(today); d.setDate(d.getDate()+dOffset); d.setHours(h,m,0,0); return d.toISOString() }

  // Today
  await dbClient.query(`
    INSERT INTO appointments (business_id,service_id,staff_id,customer_id,start_time,end_time,status,source) VALUES
    ($1,$2,$3,$4,$7,$8,'completed','web'),
    ($1,$2,$5,$6,$9,$10,'booked','web')
  `, [b1, haircut.id, marco.id, liam.id, jake.id, connor.id,
      ts(0,9), ts(0,9,30), ts(0,11), ts(0,11,30)])

  // Tomorrow
  await dbClient.query(`
    INSERT INTO appointments (business_id,service_id,staff_id,customer_id,start_time,end_time,status,source) VALUES
    ($1,$2,$3,$4,$7,$8,'booked','manual'),
    ($1,$5,$3,$6,$9,$10,'booked','web')
  `, [b1, haircutBeard.id, jake.id, sean.id, haircut.id, patrick.id,
      ts(1,10), ts(1,10,45), ts(1,13), ts(1,13,30)])

  // Past (for revenue)
  const pastR = await dbClient.query(`
    INSERT INTO appointments (business_id,service_id,staff_id,customer_id,start_time,end_time,status,source) VALUES
    ($1,$2,$3,$4,$11,$12,'completed','web'),
    ($1,$2,$5,$6,$13,$14,'completed','web'),
    ($1,$7,$3,$8,$15,$16,'completed','web'),
    ($1,$9,$5,$10,$17,$18,'no_show','web')
    RETURNING id
  `, [b1, haircut.id, marco.id, liam.id,
      jake.id, connor.id, beardTrim.id, sean.id, haircutBeard.id, patrick.id,
      ts(-1,10), ts(-1,10,30), ts(-1,14), ts(-1,14,30),
      ts(-2,11), ts(-2,11,20), ts(-2,15), ts(-2,15,45)])

  const [p1,p2,p3] = pastR.rows
  await dbClient.query(`
    INSERT INTO payments (business_id,appointment_id,amount,tip,payment_method) VALUES
    ($1,$2,25,5,'cash'),($1,$3,25,0,'card'),($1,$4,15,2,'cash')
  `, [b1, p1.id, p2.id, p3.id])

  await dbClient.end()
  console.log()
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('Seed complete!')
  console.log('Demo logins:')
  console.log('  demo-barber@termino.test / Demo1234!')
  console.log('  demo-nails@termino.test  / Demo1234!')
  console.log('Booking pages: /book/kings-cut  /book/glamour-nails')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

run().catch(e => { console.error(e.message); process.exit(1) })
