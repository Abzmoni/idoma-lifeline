const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('./db');

// Demo coordinator account. Surfaced on the login screen so judges can sign in.
const ADMIN = {
  name: 'Chief Coordinator',
  phone: '+2348012345678',
  password: '123456',
  role: 'admin'
};

// 10 verified resources across all six types. Real Idoma place names per spec section 13 --
// "Resource 1 / Resource 2" placeholders undercut the pitch.
const RESOURCES = [
  { type: 'shelter', name: 'St. Mary\'s Church Hall', description: 'Safe shelter with capacity for 200 people. Clean water available.', lat: 7.1950, lng: 8.1250, status: 'verified', capacity: 200, contact_phone: '+2348022221111', source: 'admin' },
  { type: 'shelter', name: 'Methodist Primary School', description: 'Emergency housing in classrooms. Red Cross station on site.', lat: 7.1880, lng: 8.1420, status: 'verified', capacity: 150, contact_phone: '+2348033332222', source: 'admin' },
  { type: 'water', name: 'Borehole Rd 3', description: 'Solar powered borehole. Working 24/7. Queue forms early.', lat: 7.1930, lng: 8.1380, status: 'verified', capacity: null, contact_phone: '', source: 'app' },
  { type: 'water', name: 'Adoka Community Borehole', description: 'Hand pump working well. Good water quality.', lat: 7.1610, lng: 7.9300, status: 'verified', capacity: null, contact_phone: '+2348044445555', source: 'sms' },
  { type: 'medical', name: 'General Hospital Otukpo', description: 'Full emergency services. Trauma care unit open.', lat: 7.1820, lng: 8.1300, status: 'verified', capacity: 100, contact_phone: '+2348055556666', source: 'admin' },
  { type: 'medical', name: 'Ugbokolo Health Post', description: 'First aid and basic medical treatment. Volunteer doctor present.', lat: 6.9850, lng: 7.9800, status: 'verified', capacity: 30, contact_phone: '+2348066667777', source: 'app' },
  { type: 'food', name: 'Town Hall Distribution Point', description: 'NGO food distribution daily from 9 AM to 3 PM.', lat: 7.1900, lng: 8.1350, status: 'verified', capacity: null, contact_phone: '+2348077778888', source: 'admin' },
  { type: 'food', name: 'Apa Relief Depot', description: 'Grain bags and canned foods. Bring ID for collection.', lat: 7.5833, lng: 7.8333, status: 'verified', capacity: null, contact_phone: '+2348088889999', source: 'sms' },
  { type: 'safe_zone', name: 'Agatu Peace Zone', description: 'Community protected space. Local guards and police stationed.', lat: 7.8856, lng: 7.9136, status: 'verified', capacity: null, contact_phone: '', source: 'admin' },
  // Sits between Otukpo (7.19) and Apa (7.58) so the safe-route demo visibly detours around it.
  { type: 'hazard', name: 'Otukpo-Apa Highway Insecurity Zone', description: 'ACTIVE HAZARD: Regular attacks reported. Vehicles advised to reroute.', lat: 7.3500, lng: 8.0500, status: 'verified', capacity: null, contact_phone: '', source: 'admin' }
];

// Pending reports so the verification flow can be demonstrated live.
const REPORTS = [
  { type: 'shelter', name: 'Central School Classrooms', description: 'Opening 5 rooms for displaced families from Agatu.', lat: 7.1945, lng: 8.1310, reporter_contact: '+2348122223333', source: 'app' },
  { type: 'water', name: 'New Solar Pump Otukpo', description: 'Brand new solar borehole installed near the church.', lat: 7.1925, lng: 8.1280, reporter_contact: '+2348133334444', source: 'sms' },
  { type: 'medical', name: 'Red Cross First Aid Stand', description: 'Set up temporary tent for wounded arrivals.', lat: 7.1890, lng: 8.1360, reporter_contact: '+2348144445555', source: 'app' },
  { type: 'hazard', name: 'Road Blockage / Herder Sightings', description: 'Reports of armed groups along Otukpo-Apa highway. Avoid transit.', lat: 7.3500, lng: 8.0500, reporter_contact: '+2348155556666', source: 'sms' }
];

async function insertResource(resource, adminId) {
  if (db.isPostgres) {
    return db.query(
      `INSERT INTO resources (type, name, description, location, status, capacity, contact_phone, source, verified_by, verified_at)
       VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, $6, $7, $8, $9, $10, now())`,
      [resource.type, resource.name, resource.description, resource.lng, resource.lat, resource.status, resource.capacity, resource.contact_phone, resource.source, adminId]
    );
  }

  return db.query(
    `INSERT INTO resources (id, type, name, description, lat, lng, status, capacity, contact_phone, source, verified_by, verified_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, datetime('now'))`,
    [crypto.randomUUID(), resource.type, resource.name, resource.description, resource.lat, resource.lng, resource.status, resource.capacity, resource.contact_phone, resource.source, adminId]
  );
}

async function ensureAdmin() {
  const users = await db.getUsers();
  if (users.length > 0) return users[0];

  const passwordHash = await bcrypt.hash(ADMIN.password, 10);
  const user = await db.createUser({
    name: ADMIN.name,
    phone: ADMIN.phone,
    role: ADMIN.role,
    password_hash: passwordHash
  });
  console.log(`Seeded coordinator account ${ADMIN.phone} with access code ${ADMIN.password}`);
  return user;
}

// Child rows first: reports.resource_id and sms_messages.related_report_id are real FKs on Postgres.
async function clearDemoData() {
  await db.query('DELETE FROM sms_messages');
  await db.query('DELETE FROM reports');
  await db.query('DELETE FROM resources');
}

/**
 * Brings the database up to a known-good demo state.
 * Runs on every boot (idempotent) and behind the admin "Re-seed Data" button with reset: true,
 * which wipes resources/reports/SMS logs back to the rehearsed starting point.
 */
async function seedDatabase({ reset = false } = {}) {
  const admin = await ensureAdmin();

  if (reset) {
    await clearDemoData();
    console.log('Cleared existing demo data for a full re-seed');
  }

  const existingResources = await db.getResources({ status: 'all' });
  if (existingResources.length === 0) {
    for (const resource of RESOURCES) {
      await insertResource(resource, admin.id);
    }
    console.log(`Seeded ${RESOURCES.length} verified resources`);
  }

  const existingReports = await db.getReports();
  if (existingReports.length === 0) {
    for (const report of REPORTS) {
      await db.createReport(report);
    }
    console.log(`Seeded ${REPORTS.length} pending reports`);
  }

  return {
    resources: (await db.getResources({ status: 'all' })).length,
    pending_reports: (await db.getReports('pending')).length,
    credentials: { phone: ADMIN.phone, password: ADMIN.password }
  };
}

module.exports = { seedDatabase, ADMIN };
