const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const isPostgres = /^postgres(?:ql)?:\/\//.test(process.env.DATABASE_URL || '');
let pgPool = null;
let sqliteDb = null;

if (isPostgres) {
  console.log('Database config: Using PostgreSQL');
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
  });
} else {
  console.log('Database config: Using SQLite (Local fallback)');
  const dbPath = process.env.SQLITE_PATH || path.join(__dirname, 'idoma-lifeline.db');
  sqliteDb = new sqlite3.Database(dbPath);
}

// Helper to run query on Postgres or SQLite
function query(sql, params = []) {
  if (isPostgres) {
    return pgPool.query(sql, params).then(res => res.rows);
  } else {
    return new Promise((resolve, reject) => {
      // Map postgres parameter syntax ($1, $2) to sqlite (?, ?)
      let sqliteSql = sql;
      const paramMatches = sql.match(/\$\d+/g);
      if (paramMatches) {
        // Sort in descending order to avoid replacing $10 before $1
        const uniqueMatches = [...new Set(paramMatches)].sort((a, b) => {
          return parseInt(b.slice(1)) - parseInt(a.slice(1));
        });
        uniqueMatches.forEach((match) => {
          const index = parseInt(match.slice(1));
          // Replace all occurrences of this parameter
          sqliteSql = sqliteSql.replaceAll(match, '?');
        });
      }

      // SQLite uses different functions for geolocation. If we see ST_Y or ST_X, we replace them
      sqliteSql = sqliteSql
        .replace(/ST_Y\(location::geometry\)/gi, 'lat')
        .replace(/ST_X\(location::geometry\)/gi, 'lng')
        .replace(/ST_SetSRID\(ST_MakePoint\(\$(\d+),\s*\$(\d+)\),\s*4326\)::geography/gi, '?') // we'll handle parameter mapping manually below
        .replace(/ST_SetSRID\(ST_MakePoint\(\?,\s*\?\),\s*4326\)::geography/gi, '?')
        .replace(/location\s+GEOGRAPHY\(Point,\s*4326\)/gi, 'lat REAL, lng REAL')
        .replace(/gen_random_uuid\(\)/gi, 'lower(hex(randomblob(16)))')
        .replace(/TIMESTAMPTZ/gi, 'TEXT')
        .replace(/now\(\)/gi, "datetime('now')")
        .replace(/REFERENCES\s+\w+\(\w+\)/gi, '') // ignore foreign keys checks for simple sqlite
        .replace(/CHECK\s+\(direction\s+IN\s+\('inbound',\s*'outbound'\)\)/gi, '');

      // console.log(`Executing SQLite SQL: ${sqliteSql} with params:`, params);

      // Detect if we're doing a write operation or read operation
      const isWrite = /^\s*(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)/i.test(sqliteSql);

      if (isWrite) {
        sqliteDb.run(sqliteSql, params, function(err) {
          if (err) return reject(err);
          resolve({ lastID: this.lastID, changes: this.changes });
        });
      } else {
        sqliteDb.all(sqliteSql, params, (err, rows) => {
          if (err) return reject(err);
          resolve(rows);
        });
      }
    });
  }
}

// Convert spatial location insertion parameter
function formatLocationParam(lat, lng) {
  if (isPostgres) {
    return `ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography`;
  }
  return { lat, lng };
}

async function initDb() {
  if (isPostgres) {
    try {
      await pgPool.query('CREATE EXTENSION IF NOT EXISTS postgis;');
      
      // Create types
      await pgPool.query(`
        DO $$ BEGIN
          CREATE TYPE resource_type AS ENUM ('shelter', 'water', 'medical', 'food', 'safe_zone', 'hazard');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      `);
      await pgPool.query(`
        DO $$ BEGIN
          CREATE TYPE resource_status AS ENUM ('verified', 'pending', 'flagged', 'archived');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      `);
      await pgPool.query(`
        DO $$ BEGIN
          CREATE TYPE report_source AS ENUM ('app', 'sms', 'admin');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      `);
      await pgPool.query(`
        DO $$ BEGIN
          CREATE TYPE report_status AS ENUM ('pending', 'approved', 'rejected');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      `);
      await pgPool.query(`
        DO $$ BEGIN
          CREATE TYPE user_role AS ENUM ('admin', 'moderator');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      `);

      // Create users table
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          phone TEXT UNIQUE NOT NULL,
          role user_role NOT NULL DEFAULT 'moderator',
          password_hash TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);

      // Create resources table
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS resources (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          type resource_type NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          location GEOGRAPHY(Point, 4326) NOT NULL,
          status resource_status NOT NULL DEFAULT 'pending',
          capacity INTEGER,
          contact_phone TEXT,
          source report_source NOT NULL DEFAULT 'app',
          verified_by UUID REFERENCES users(id),
          verified_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);
      await pgPool.query(`CREATE INDEX IF NOT EXISTS resources_location_idx ON resources USING GIST (location);`);

      // Create reports table
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS reports (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          resource_id UUID REFERENCES resources(id),
          type resource_type NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          location GEOGRAPHY(Point, 4326) NOT NULL,
          reporter_contact TEXT,
          source report_source NOT NULL DEFAULT 'app',
          status report_status NOT NULL DEFAULT 'pending',
          reviewed_by UUID REFERENCES users(id),
          reviewed_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);

      // Create sms_messages table
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS sms_messages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
          phone TEXT NOT NULL,
          message_body TEXT NOT NULL,
          parsed_command TEXT,
          related_report_id UUID REFERENCES reports(id),
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);

      console.log('PostgreSQL database initialized successfully.');
    } catch (e) {
      console.error('Error initializing PostgreSQL:', e);
      throw e;
    }
  } else {
    // SQLite Tables initialization
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          phone TEXT UNIQUE NOT NULL,
          role TEXT NOT NULL DEFAULT 'moderator',
          password_hash TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS resources (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          lat REAL NOT NULL,
          lng REAL NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          capacity INTEGER,
          contact_phone TEXT,
          source TEXT NOT NULL DEFAULT 'app',
          verified_by TEXT,
          verified_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS reports (
          id TEXT PRIMARY KEY,
          resource_id TEXT,
          type TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          lat REAL NOT NULL,
          lng REAL NOT NULL,
          reporter_contact TEXT,
          source TEXT NOT NULL DEFAULT 'app',
          status TEXT NOT NULL DEFAULT 'pending',
          reviewed_by TEXT,
          reviewed_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS sms_messages (
          id TEXT PRIMARY KEY,
          direction TEXT NOT NULL,
          phone TEXT NOT NULL,
          message_body TEXT NOT NULL,
          parsed_command TEXT,
          related_report_id TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `);

      console.log('SQLite database initialized successfully.');
    } catch (e) {
      console.error('Error initializing SQLite:', e);
      throw e;
    }
  }
  // Additive migration for existing prototype databases.
  if (isPostgres) {
    await query('ALTER TABLE reports ADD COLUMN IF NOT EXISTS public_contact TEXT');
    await query('ALTER TABLE reports ADD COLUMN IF NOT EXISTS client_request_id TEXT');
  } else {
    const columns = await query('PRAGMA table_info(reports)');
    if (!columns.some(c => c.name === 'public_contact')) await query('ALTER TABLE reports ADD COLUMN public_contact TEXT');
    if (!columns.some(c => c.name === 'client_request_id')) await query('ALTER TABLE reports ADD COLUMN client_request_id TEXT');
  }
  await query('CREATE UNIQUE INDEX IF NOT EXISTS reports_client_request_idx ON reports(client_request_id)');
  // Remove only contacts copied by the old approval bug, preserving explicitly public contacts.
  await query(`UPDATE resources SET contact_phone = NULL WHERE EXISTS (
    SELECT 1 FROM reports r WHERE r.resource_id = resources.id
    AND r.reporter_contact = resources.contact_phone AND r.public_contact IS NULL
  )`);
}

// Distance helper (Haversine formula in JS)
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
    ;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

module.exports = {
  isPostgres,
  initDb,
  query,
  getDistance,
  
  // Custom API DB helpers
  async getUsers() {
    return query(`SELECT id, name, phone, role, password_hash, created_at FROM users`);
  },

  async getUserByPhone(phone) {
    const rows = await query(`SELECT id, name, phone, role, password_hash, created_at FROM users WHERE phone = $1`, [phone]);
    return rows[0] || null;
  },

  async createUser({ name, phone, role, password_hash }) {
    if (isPostgres) {
      const rows = await query(
        `INSERT INTO users (name, phone, role, password_hash) VALUES ($1, $2, $3, $4) RETURNING *`,
        [name, phone, role, password_hash]
      );
      return rows[0];
    } else {
      const id = require('crypto').randomUUID();
      await query(
        `INSERT INTO users (id, name, phone, role, password_hash) VALUES ($1, $2, $3, $4, $5)`,
        [id, name, phone, role, password_hash]
      );
      return { id, name, phone, role, password_hash };
    }
  },

  async getResources({ type, bbox, status }) {
    let sql = '';
    const params = [];
    let paramIndex = 1;

    if (isPostgres) {
      sql = `SELECT id, type, name, description, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng, status, capacity, contact_phone, source, verified_by, verified_at, created_at, updated_at FROM resources WHERE 1=1`;
    } else {
      sql = `SELECT id, type, name, description, lat, lng, status, capacity, contact_phone, source, verified_by, verified_at, created_at, updated_at FROM resources WHERE 1=1`;
    }

    if (type) {
      sql += ` AND type = $${paramIndex++}`;
      params.push(type);
    }

    if (status && status !== 'all') {
      sql += ` AND status = $${paramIndex++}`;
      params.push(status);
    } else if (!status) {
      sql += ` AND status = 'verified'`; // Default to verified for public
    }

    const rows = await query(sql, params);

    // Apply bounding box filter if present (minLng,minLat,maxLng,maxLat)
    if (bbox) {
      const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(Number);
      return rows.filter(r => r.lng >= minLng && r.lng <= maxLng && r.lat >= minLat && r.lat <= maxLat);
    }

    return rows;
  },

  async getResourceById(id) {
    let sql = '';
    if (isPostgres) {
      sql = `SELECT id, type, name, description, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng, status, capacity, contact_phone, source, verified_by, verified_at, created_at, updated_at FROM resources WHERE id = $1`;
    } else {
      sql = `SELECT id, type, name, description, lat, lng, status, capacity, contact_phone, source, verified_by, verified_at, created_at, updated_at FROM resources WHERE id = $1`;
    }
    const rows = await query(sql, [id]);
    return rows[0] || null;
  },

  async createReport({ type, name, description, lat, lng, reporter_contact, public_contact, source, client_request_id }) {
    const id = require('crypto').randomUUID();
    const params = [id, type, name, description || '', lat, lng, reporter_contact || '', public_contact || null, source || 'app', client_request_id || null];
    if (isPostgres) {
      await query(`INSERT INTO reports (id, type, name, description, location, reporter_contact, public_contact, source, client_request_id, status)
        VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($6, $5), 4326)::geography, $7, $8, $9, $10, 'pending')
        ON CONFLICT (client_request_id) DO NOTHING`, params);
    } else {
      await query(`INSERT INTO reports (id, type, name, description, lat, lng, reporter_contact, public_contact, source, client_request_id, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')
        ON CONFLICT (client_request_id) DO NOTHING`, params);
    }
    const rows = await query('SELECT id FROM reports WHERE ' + (client_request_id ? 'client_request_id = $1' : 'id = $1'), [client_request_id || id]);
    return this.getReportById(rows[0].id);
  },

  async getReports(status) {
    let sql = '';
    const params = [];
    if (isPostgres) {
      sql = `SELECT id, resource_id, type, name, description, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng, reporter_contact, public_contact, source, status, reviewed_by, reviewed_at, created_at FROM reports`;
    } else {
      sql = `SELECT id, resource_id, type, name, description, lat, lng, reporter_contact, public_contact, source, status, reviewed_by, reviewed_at, created_at FROM reports`;
    }

    if (status) {
      sql += ` WHERE status = $1`;
      params.push(status);
    }
    sql += ` ORDER BY created_at DESC`;

    return query(sql, params);
  },

  async getReportById(id) {
    let sql = '';
    if (isPostgres) {
      sql = `SELECT id, resource_id, type, name, description, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng, reporter_contact, public_contact, source, status, reviewed_by, reviewed_at, created_at FROM reports WHERE id = $1`;
    } else {
      sql = `SELECT id, resource_id, type, name, description, lat, lng, reporter_contact, public_contact, source, status, reviewed_by, reviewed_at, created_at FROM reports WHERE id = $1`;
    }
    const rows = await query(sql, [id]);
    return rows[0] || null;
  },

  async approveReport(id, userId) {
    // 1. Get the report
    const report = await this.getReportById(id);
    if (!report) throw new Error('Report not found');
    if (report.status === 'approved' && report.resource_id) return this.getResourceById(report.resource_id);

    const reviewedAt = new Date().toISOString();

    // 2. Mark report as approved
    await query(
      `UPDATE reports SET status = 'approved', reviewed_by = $1, reviewed_at = $2 WHERE id = $3`,
      [userId, reviewedAt, id]
    );

    // 3. Create or update linked resource
    // Check if resource already exists (in case it is an update)
    let resourceId = report.resource_id;
    if (resourceId) {
      // Update existing resource
      if (isPostgres) {
        await query(
          `UPDATE resources SET type = $1, name = $2, description = $3, location = ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, status = 'verified', contact_phone = $6, verified_by = $7, verified_at = $8, updated_at = now() WHERE id = $9`,
          [report.type, report.name, report.description, report.lng, report.lat, report.public_contact, userId, reviewedAt, resourceId]
        );
      } else {
        await query(
          `UPDATE resources SET type = $1, name = $2, description = $3, lat = $4, lng = $5, status = 'verified', contact_phone = $6, verified_by = $7, verified_at = $8, updated_at = datetime('now') WHERE id = $9`,
          [report.type, report.name, report.description, report.lat, report.lng, report.public_contact, userId, reviewedAt, resourceId]
        );
      }
    } else {
      // Create new resource
      if (isPostgres) {
        const rows = await query(
          `INSERT INTO resources (type, name, description, location, status, contact_phone, source, verified_by, verified_at)
           VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, 'verified', $6, $7, $8, $9)
           RETURNING id`,
          [report.type, report.name, report.description, report.lng, report.lat, report.public_contact, report.source, userId, reviewedAt]
        );
        resourceId = rows[0].id;
      } else {
        resourceId = require('crypto').randomUUID();
        await query(
          `INSERT INTO resources (id, type, name, description, lat, lng, status, contact_phone, source, verified_by, verified_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'verified', $7, $8, $9, $10)`,
          [resourceId, report.type, report.name, report.description, report.lat, report.lng, report.public_contact, report.source, userId, reviewedAt]
        );
      }
      
      // Update report to link to the resource
      await query(`UPDATE reports SET resource_id = $1 WHERE id = $2`, [resourceId, id]);
    }

    return this.getResourceById(resourceId);
  },

  async rejectReport(id, userId) {
    const reviewedAt = new Date().toISOString();
    await query(
      `UPDATE reports SET status = 'rejected', reviewed_by = $1, reviewed_at = $2 WHERE id = $3`,
      [userId, reviewedAt, id]
    );
    return { id, status: 'rejected' };
  },

  async updateResource(id, { type, name, description, lat, lng, status, capacity, contact_phone }) {
    if (isPostgres) {
      await query(
        `UPDATE resources SET type = $1, name = $2, description = $3, location = ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography, status = $6, capacity = $7, contact_phone = $8, updated_at = now() WHERE id = $9`,
        [type, name, description, lng, lat, status, capacity, contact_phone, id]
      );
    } else {
      await query(
        `UPDATE resources SET type = $1, name = $2, description = $3, lat = $4, lng = $5, status = $6, capacity = $7, contact_phone = $8, updated_at = datetime('now') WHERE id = $9`,
        [type, name, description, lat, lng, status, capacity, contact_phone, id]
      );
    }
    return this.getResourceById(id);
  },

  async getAdminStats() {
    const resCountRows = await query(`SELECT type, COUNT(*) as count FROM resources WHERE status = 'verified' GROUP BY type`);
    const pendingReportsRows = await query(`SELECT COUNT(*) as count FROM reports WHERE status = 'pending'`);
    
    let reportsLast24hRows;
    if (isPostgres) {
      reportsLast24hRows = await query(`SELECT COUNT(*) as count FROM reports WHERE created_at >= now() - interval '24 hours'`);
    } else {
      reportsLast24hRows = await query(`SELECT COUNT(*) as count FROM reports WHERE created_at >= datetime('now', '-24 hours')`);
    }

    const resourcesByType = {};
    // initialize all categories
    ['shelter', 'water', 'medical', 'food', 'safe_zone', 'hazard'].forEach(t => {
      resourcesByType[t] = 0;
    });
    resCountRows.forEach(row => {
      resourcesByType[row.type] = parseInt(row.count);
    });

    // Impact measures shown to coordinators (and on stage): review speed, channel mix, freshness.
    const reportRows = await query(`SELECT source, status, created_at, reviewed_at FROM reports`);
    const verifiedRows = await query(`SELECT verified_at FROM resources WHERE status = 'verified'`);
    const toMs = value => {
      if (!value) return NaN;
      if (value instanceof Date) return value.getTime();
      const text = String(value);
      return new Date(/Z$|[+-]\d\d:?\d\d$/.test(text) ? text : text.replace(' ', 'T') + 'Z').getTime();
    };
    const reviewMinutes = reportRows
      .filter(r => r.status !== 'pending' && r.reviewed_at)
      .map(r => (toMs(r.reviewed_at) - toMs(r.created_at)) / 60000)
      .filter(m => Number.isFinite(m) && m >= 0)
      .sort((a, b) => a - b);
    const mid = Math.floor(reviewMinutes.length / 2);
    const medianReview = !reviewMinutes.length ? null
      : reviewMinutes.length % 2 ? reviewMinutes[mid] : (reviewMinutes[mid - 1] + reviewMinutes[mid]) / 2;
    const reportsBySource = { app: 0, sms: 0, admin: 0 };
    reportRows.forEach(r => { reportsBySource[r.source] = (reportsBySource[r.source] || 0) + 1; });
    const staleCutoff = Date.now() - 72 * 3600 * 1000;

    return {
      resources_by_type: resourcesByType,
      pending_reports: parseInt(pendingReportsRows[0]?.count || 0),
      reports_24h: parseInt(reportsLast24hRows[0]?.count || 0),
      impact: {
        reports_total: reportRows.length,
        reports_by_source: reportsBySource,
        basic_phone_share_pct: reportRows.length ? Math.round(100 * reportsBySource.sms / reportRows.length) : null,
        reviewed_total: reviewMinutes.length,
        median_review_minutes: medianReview === null ? null : Math.round(medianReview),
        reviewed_within_24h_pct: reviewMinutes.length ? Math.round(100 * reviewMinutes.filter(m => m <= 1440).length / reviewMinutes.length) : null,
        stale_resources: verifiedRows.filter(r => !(toMs(r.verified_at) >= staleCutoff)).length
      }
    };
  },

  async logSmsMessage({ direction, phone, message_body, parsed_command, related_report_id }) {
    if (isPostgres) {
      const sql = `
        INSERT INTO sms_messages (direction, phone, message_body, parsed_command, related_report_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
      const rows = await query(sql, [direction, phone, message_body, parsed_command, related_report_id]);
      return rows[0];
    } else {
      const id = require('crypto').randomUUID();
      const sql = `
        INSERT INTO sms_messages (id, direction, phone, message_body, parsed_command, related_report_id)
        VALUES ($1, $2, $3, $4, $5, $6)
      `;
      await query(sql, [id, direction, phone, message_body, parsed_command, related_report_id]);
      return { id, direction, phone, message_body, parsed_command, related_report_id, created_at: new Date().toISOString() };
    }
  },

  async getSmsLogs() {
    return query(`SELECT id, direction, phone, message_body, parsed_command, related_report_id, created_at FROM sms_messages ORDER BY created_at DESC`);
  }
};
