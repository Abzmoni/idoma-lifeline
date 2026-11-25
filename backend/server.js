require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const { seedDatabase } = require('./seed');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = resolveJwtSecret();

// Never ship a shared, hard-coded signing key. Production must provide JWT_SECRET
// (render.yaml generates one); local development gets a random key persisted per machine.
function resolveJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    console.error('JWT_SECRET must be set in production. Refusing to start.');
    process.exit(1);
  }
  const file = path.join(__dirname, '.jwt-secret');
  try {
    const saved = fs.readFileSync(file, 'utf8').trim();
    if (saved) return saved;
  } catch { /* first run: generate below */ }
  const secret = require('crypto').randomBytes(32).toString('hex');
  try { fs.writeFileSync(file, secret, { mode: 0o600 }); } catch { /* read-only disk: key lasts for this process */ }
  console.warn('JWT_SECRET not set; using a generated local development key.');
  return secret;
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Pre-defined landmarks database for geocoding phone requests
const LANDMARKS = {
  'otukpo': { lat: 7.1904, lng: 8.1345 },
  'otukpo market': { lat: 7.1930, lng: 8.1380 },
  'otukpo main market': { lat: 7.1930, lng: 8.1380 },
  'apa': { lat: 7.5833, lng: 7.8333 },
  'agatu': { lat: 7.8856, lng: 7.9136 },
  'st. mary\'s church': { lat: 7.1950, lng: 8.1250 },
  'st marys church': { lat: 7.1950, lng: 8.1250 },
  'st. mary\'s': { lat: 7.1950, lng: 8.1250 },
  'st marys': { lat: 7.1950, lng: 8.1250 },
  'health post': { lat: 7.1850, lng: 8.1400 },
  'clinic': { lat: 7.1850, lng: 8.1400 },
  'adoka': { lat: 7.1610, lng: 7.9300 },
  'ugbokolo': { lat: 6.9850, lng: 7.9800 },
  'ugbokolo school': { lat: 6.9850, lng: 7.9800 },
  'ogbadibo': { lat: 7.0200, lng: 7.9000 },
  'okpokwu': { lat: 6.9500, lng: 8.1000 },
  'catholic church': { lat: 7.1910, lng: 8.1300 },
  'central school': { lat: 7.1945, lng: 8.1310 },
  'town hall': { lat: 7.1900, lng: 8.1350 },
  'general hospital': { lat: 7.1820, lng: 8.1300 },
  'methodist school': { lat: 7.1880, lng: 8.1420 },
  // Idoma LGA headquarters and major towns. Approximate town centres for
  // "nearest help" lookups; confirm with local coordinators before a live pilot.
  'ugbokpo': { lat: 7.6500, lng: 7.9000 },     // Apa LGA
  'obagaji': { lat: 7.9300, lng: 7.8700 },     // Agatu LGA
  'oju': { lat: 6.8500, lng: 8.4167 },         // Oju LGA
  'obarike ito': { lat: 7.0167, lng: 8.3333 }, // Obi LGA
  'obi': { lat: 7.0167, lng: 8.3333 },
  'igumale': { lat: 6.8000, lng: 7.9667 },     // Ado LGA
  'ado': { lat: 6.8000, lng: 7.9667 },
  'utonkon': { lat: 6.9500, lng: 8.0500 },
  'otukpa': { lat: 7.1000, lng: 7.6500 },      // Ogbadibo LGA
  'orokam': { lat: 7.0333, lng: 7.5833 },
  'okpoga': { lat: 7.0500, lng: 7.8000 },      // Okpokwu LGA
  'idekpa': { lat: 7.3800, lng: 8.0000 },      // Ohimini LGA
  'ohimini': { lat: 7.3800, lng: 8.0000 },
  'ochobo': { lat: 7.1800, lng: 7.9900 }
};
const LANDMARK_EXAMPLES = 'Otukpo, Ugbokpo, Obagaji, Oju, Igumale or Okpoga';

// USSD menu text. Pidgin should be reviewed by a fluent speaker before a live shortcode.
// An Idoma entry can be added with the same keys once native speakers have written it.
const USSD_TEXT = {
  en: {
    main: 'Welcome to Idoma Lifeline\n1. Find nearest resource\n2. Report a resource or hazard\n3. Pidgin',
    findType: 'Select resource type:\n1. Shelter\n2. Water\n3. Medical\n4. Food\n5. Safe Zone',
    landmark: 'Enter your nearest landmark (e.g. Otukpo market):',
    nearest: 'Nearest {type}: {name} ({km}km). {desc}',
    none: 'No {type} found near {place}',
    reportType: 'Select type to report:\n1. Shelter\n2. Water\n3. Medical\n4. Food\n5. Hazard',
    describe: 'Enter short description (e.g. Church hall open):',
    reportLandmark: 'Enter nearest landmark (e.g. Otukpo market):',
    done: 'Report submitted for coordinator review. Thank you for keeping the community safe. ID: {id}',
    notFound: 'Place not recognised. Try a town such as {examples}.',
    invalid: 'Invalid selection. Please dial again.',
    type_shelter: 'SHELTER', type_water: 'WATER', type_medical: 'MEDICAL', type_food: 'FOOD', type_safe_zone: 'SAFE ZONE',
  },
  pcm: {
    main: 'Welcome to Idoma Lifeline\n1. Find help near you\n2. Report wetin you see\n3. English',
    findType: 'Wetin you need?\n1. Place to stay\n2. Water\n3. Hospital\n4. Food\n5. Safe place',
    landmark: 'Type the place wey near you (e.g. Otukpo market):',
    nearest: '{type} wey near pass: {name} ({km}km). {desc}',
    none: 'We no see {type} near {place}',
    reportType: 'Wetin you wan report?\n1. Place to stay\n2. Water\n3. Hospital\n4. Food\n5. Danger',
    describe: 'Talk small about am (e.g. Church hall open):',
    reportLandmark: 'Type the place wey near am (e.g. Otukpo market):',
    done: 'We don receive your report. Coordinator go check am. Thank you. ID: {id}',
    notFound: 'We no know that place. Try town like {examples}.',
    invalid: 'Wrong choice. Abeg dial again.',
    type_shelter: 'Place to stay', type_water: 'Water', type_medical: 'Hospital', type_food: 'Food', type_safe_zone: 'Safe place',
  },
};
const normalisePlace = text => String(text || '').toLowerCase().replace(/['’.]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const NORMALISED_LANDMARKS = Object.entries(LANDMARKS).map(([name, coords]) => [normalisePlace(name), coords]);

function geocodeLandmark(text) {
  const clean = normalisePlace(text);
  if (clean.length < 2) return null;
  const exact = NORMALISED_LANDMARKS.find(([name]) => name === clean);
  if (exact) return exact[1];

  // Landmark named inside the message ("near otukpo market please"): prefer the most specific (longest) name.
  const padded = ` ${clean} `;
  const contained = NORMALISED_LANDMARKS.filter(([name]) => padded.includes(` ${name} `))
    .sort((a, b) => b[0].length - a[0].length)[0];
  if (contained) return contained[1];

  // Short partial entry ("ugbok"): match the start of a landmark word, never single letters.
  if (clean.length >= 4) {
    const partial = NORMALISED_LANDMARKS.filter(([name]) => name.split(' ').some(word => word.startsWith(clean)))
      .sort((a, b) => a[0].length - b[0].length)[0];
    if (partial) return partial[1];
  }

  // Default fallback to center of Otukpo
  return null;
}

// Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access token missing' });
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

// PUBLIC ENDPOINTS

// 1. Get verified resources (or all if admin checks status)
app.get('/api/resources', (req, res, next) => {
  if (req.query.status && req.query.status !== 'verified') return authenticateToken(req, res, next);
  next();
}, async (req, res) => {
  try {
    const { type, bbox, status } = req.query;
    const resources = await db.getResources({ type, bbox, status });
    res.json(resources);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch resources' });
  }
});

// 2. Get single resource
app.get('/api/resources/:id', async (req, res) => {
  try {
    const resource = await db.getResourceById(req.params.id);
    if (!resource) return res.status(404).json({ error: 'Resource not found' });
    if (resource.status !== 'verified') return authenticateToken(req, res, () => res.json(resource));
    res.json(resource);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch resource details' });
  }
});

// 3. Submit a new report (rate limiting mocked/simplified)
app.post('/api/reports', async (req, res) => {
  try {
    const { type, name, description, location, reporter_contact, public_contact, source, client_request_id } = req.body;
    
    if (!type || !name || !location || typeof location.lat === 'undefined' || typeof location.lng === 'undefined') {
      return res.status(400).json({ error: 'Missing required fields (type, name, location.lat, location.lng)' });
    }
    
    const allowed = ['shelter', 'water', 'medical', 'food', 'safe_zone', 'hazard'];
    if (!allowed.includes(type) || typeof name !== 'string' || !name.trim() || name.length > 180 ||
        !Number.isFinite(location.lat) || !Number.isFinite(location.lng) || Math.abs(location.lat) > 90 || Math.abs(location.lng) > 180 ||
        (client_request_id && !/^[0-9a-f-]{36}$/i.test(client_request_id)) ||
        (public_contact && (typeof public_contact !== 'string' || !/^\+?[\d ()-]{5,25}$/.test(public_contact))) ||
        (description != null && (typeof description !== 'string' || description.length > 3000)) ||
        (reporter_contact != null && (typeof reporter_contact !== 'string' || reporter_contact.length > 60)) ||
        (source && !['app', 'sms', 'admin'].includes(source))) {
      return res.status(400).json({ error: 'Please provide a valid resource type, title, coordinates and contact number.' });
    }
    const report = await db.createReport({
      type,
      name,
      description,
      lat: location.lat,
      lng: location.lng,
      reporter_contact,
      public_contact,
      client_request_id,
      source: source || 'app'
    });
    
    res.status(201).json({ id: report.id, status: report.status });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// 4. Safe route path avoidance
app.post('/api/route', (req, res) => {
  res.status(503).json({ error: 'Road routing requires an online road-routing provider. Geometric fallback routes are not available.' });
});

// AUTH LOGIN
app.post('/api/auth/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ error: 'Phone and password are required' });
    }

    const user = await db.getUserByPhone(phone);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, phone: user.phone, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, user: { id: user.id, name: user.name, phone: user.phone, role: user.role } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Login failed' });
  }
});


// PROTECTED ADMIN ENDPOINTS

// 5. List reports for review
app.get('/api/reports', authenticateToken, async (req, res) => {
  try {
    const { status } = req.query; // pending, approved, rejected
    const reports = await db.getReports(status);
    res.json(reports);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// 6. Approve report
app.post('/api/reports/:id/approve', authenticateToken, async (req, res) => {
  try {
    const resource = await db.approveReport(req.params.id, req.user.id);
    res.json({ message: 'Report approved successfully', resource });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Failed to approve report' });
  }
});

// 7. Reject report
app.post('/api/reports/:id/reject', authenticateToken, async (req, res) => {
  try {
    await db.rejectReport(req.params.id, req.user.id);
    res.json({ message: 'Report rejected successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to reject report' });
  }
});

// 8. Update Resource details
app.put('/api/resources/:id', authenticateToken, async (req, res) => {
  try {
    const { type, name, description, lat, lng, status, capacity, contact_phone } = req.body;
    const updated = await db.updateResource(req.params.id, {
      type,
      name,
      description,
      lat,
      lng,
      status,
      capacity: capacity ? parseInt(capacity) : null,
      contact_phone
    });
    res.json({ message: 'Resource updated successfully', resource: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update resource' });
  }
});

// 9. Get Admin stats
app.get('/api/admin/stats', authenticateToken, async (req, res) => {
  try {
    const stats = await db.getAdminStats();
    res.json(stats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// SMS & USSD GATEWAY WEBHOOKS (Africa's Talking Callback)

// 10. SMS Inbound Webhook
app.post('/api/sms/inbound', async (req, res) => {
  try {
    const { from, to, text, linkId } = req.body;
    if (!from || !text) {
      return res.status(400).send('Missing payload fields (from, text)');
    }

    console.log(`Inbound SMS from ${from}: "${text}"`);
    const cleanText = text.trim();
    let replyText = '';
    let parsedCommand = '';
    let relatedReportId = null;

    // Parse commands
    const nearMatch = cleanText.match(/^NEAR\s+(.+)$/i);
    const typeMatch = cleanText.match(/^(WATER|SHELTER|MEDICAL|FOOD)\s+(.+)$/i);
    const reportMatch = cleanText.match(/^REPORT\s+(shelter|water|medical|food|safe_zone|hazard),?\s+([^,]+),\s*(.+)$/i);

    if (nearMatch) {
      parsedCommand = 'NEAR';
      const placeName = nearMatch[1];
      const coords = geocodeLandmark(placeName);
      
      if (coords) {
        const verifiedList = await db.getResources({ status: 'verified' });
        // Calculate distances and sort
        const nearby = verifiedList.map(r => {
          const d = db.getDistance(coords.lat, coords.lng, r.lat, r.lng);
          return { ...r, distance: d };
        }).sort((a, b) => a.distance - b.distance).slice(0, 3);

        if (nearby.length > 0) {
          replyText = nearby.map((r, i) => `${i+1}. ${r.type.toUpperCase()} - ${r.name} (${r.distance.toFixed(1)}km)`).join('\n');
        } else {
          replyText = `No resources found near ${placeName}`;
        }
      } else {
        replyText = `Place not recognised: ${placeName}. Try a town such as ${LANDMARK_EXAMPLES}.`;
      }
    } else if (typeMatch) {
      const typeStr = typeMatch[1].toLowerCase();
      parsedCommand = typeStr.toUpperCase();
      const placeName = typeMatch[2];
      const coords = geocodeLandmark(placeName);

      if (coords) {
        const verifiedList = await db.getResources({ type: typeStr, status: 'verified' });
        const nearby = verifiedList.map(r => {
          const d = db.getDistance(coords.lat, coords.lng, r.lat, r.lng);
          return { ...r, distance: d };
        }).sort((a, b) => a.distance - b.distance);

        if (nearby.length > 0) {
          const nearest = nearby[0];
          replyText = `Nearest ${typeStr.toUpperCase()}: ${nearest.name} (${nearest.distance.toFixed(1)}km). ${nearest.description || ''}. Contact: ${nearest.contact_phone || 'N/A'}`;
        } else {
          replyText = `No ${typeStr.toUpperCase()} found near ${placeName}`;
        }
      } else {
        replyText = `Place not recognised: ${placeName}. Try a town such as ${LANDMARK_EXAMPLES}.`;
      }
    } else if (reportMatch) {
      parsedCommand = 'REPORT';
      const type = reportMatch[1].toLowerCase();
      const desc = reportMatch[2];
      const placeName = reportMatch[3];
      const coords = geocodeLandmark(placeName);

      if (coords) {
        const newReport = await db.createReport({
          type,
          name: `${type.toUpperCase()} reported via SMS`,
          description: `${desc} (near ${placeName})`,
          lat: coords.lat,
          lng: coords.lng,
          reporter_contact: from,
          source: 'sms'
        });
        relatedReportId = newReport.id;
        replyText = `Report submitted for review. Thank you. ID: ${newReport.id.slice(0, 8)}`;
      } else {
        replyText = `Place not recognised: ${placeName}. Report not saved. Try a town such as ${LANDMARK_EXAMPLES}.`;
      }
    } else {
      replyText = `Unknown command. Use: NEAR <place>, WATER <place>, SHELTER <place>, or REPORT <type> <desc>, <place>`;
    }

    // Log the transaction
    await db.logSmsMessage({
      direction: 'inbound',
      phone: from,
      message_body: text,
      parsed_command: parsedCommand,
      related_report_id: relatedReportId
    });

    await db.logSmsMessage({
      direction: 'outbound',
      phone: from,
      message_body: replyText,
      parsed_command: parsedCommand + '_REPLY',
      related_report_id: relatedReportId
    });

    // Send SMS reply (In a real system, we'd invoke Africa's Talking API here. For sandbox integration,
    // we return the text to the HTTP response if they poll it, or log it. AT webhook expects HTTP 200/201).
    res.setHeader('Content-Type', 'text/plain');
    res.send(replyText);
  } catch (error) {
    console.error(error);
    res.status(500).send('Webhook failed');
  }
});

// 11. USSD session webhook
app.post('/api/sms/ussd', async (req, res) => {
  try {
    const { sessionId, phoneNumber, text, serviceCode } = req.body;
    
    if (typeof text === 'undefined') {
      return res.status(400).send('Missing text field');
    }

    console.log(`USSD session ${sessionId} from ${phoneNumber}: text="${text}"`);
    let response = '';

    // Option 3 on the main menu toggles English <-> Pidgin; the rest of the session continues in that language.
    let parts = text.split('*').filter(p => p !== '');
    let lang = 'en';
    while (parts[0] === '3') { lang = lang === 'en' ? 'pcm' : 'en'; parts = parts.slice(1); }
    const say = (key, vars = {}) => USSD_TEXT[lang][key].replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

    if (parts.length === 0) {
      response = `CON ${say('main')}`;
    } else if (parts[0] === '1') {
      if (parts.length === 1) {
        response = `CON ${say('findType')}`;
      } else if (parts.length === 2) {
        response = `CON ${say('landmark')}`;
      } else if (parts.length === 3) {
        const typeMap = { '1': 'shelter', '2': 'water', '3': 'medical', '4': 'food', '5': 'safe_zone' };
        const typeStr = typeMap[parts[1]] || 'shelter';
        const landmark = parts[2];
        const coords = geocodeLandmark(landmark);
        if (!coords) return res.type('text/plain').send(`END ${say('notFound', { examples: LANDMARK_EXAMPLES })}`);
        const verifiedList = await db.getResources({ type: typeStr, status: 'verified' });
        const nearby = verifiedList.map(r => ({ ...r, distance: db.getDistance(coords.lat, coords.lng, r.lat, r.lng) }))
          .sort((a, b) => a.distance - b.distance);
        const typeLabel = say('type_' + typeStr);
        if (nearby.length > 0) {
          const nearest = nearby[0];
          response = `END ${say('nearest', { type: typeLabel, name: nearest.name, km: nearest.distance.toFixed(1), desc: nearest.description || '' })}`;
        } else {
          response = `END ${say('none', { type: typeLabel, place: landmark })}`;
        }
      }
    } else if (parts[0] === '2') {
      if (parts.length === 1) {
        response = `CON ${say('reportType')}`;
      } else if (parts.length === 2) {
        response = `CON ${say('describe')}`;
      } else if (parts.length === 3) {
        response = `CON ${say('reportLandmark')}`;
      } else if (parts.length === 4) {
        const typeMap = { '1': 'shelter', '2': 'water', '3': 'medical', '4': 'food', '5': 'hazard' };
        const typeStr = typeMap[parts[1]] || 'shelter';
        const desc = parts[2];
        const landmark = parts[3];
        const coords = geocodeLandmark(landmark);
        if (!coords) return res.type('text/plain').send(`END ${say('notFound', { examples: LANDMARK_EXAMPLES })}`);
        const newReport = await db.createReport({
          type: typeStr,
          name: `${typeStr.toUpperCase()} reported via USSD`,
          description: `${desc} (near ${landmark})`,
          lat: coords.lat,
          lng: coords.lng,
          reporter_contact: phoneNumber,
          source: 'sms'
        });
        response = `END ${say('done', { id: newReport.id.slice(0, 8) })}`;
      }
    } else {
      response = `END ${say('invalid')}`;
    }

    res.setHeader('Content-Type', 'text/plain');
    res.send(response);
  } catch (error) {
    console.error(error);
    res.status(500).send('USSD Callback error');
  }
});

// Admin SMS logs endpoint (for debugging SMS and USSD flow)
app.get('/api/admin/sms-logs', authenticateToken, async (req, res) => {
  try {
    const logs = await db.getSmsLogs();
    res.json(logs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch SMS logs' });
  }
});

// SEED SYSTEM DATA ENDPOINT
// Destructive: wipes resources/reports/SMS logs and rebuilds the rehearsed demo state,
// so it requires a coordinator token. Backs the "Re-seed Data" button in the admin console.
app.post('/api/admin/seed', authenticateToken, async (req, res) => {
  try {
    const summary = await seedDatabase({ reset: true });
    res.json({ message: 'Database reset to demo state', ...summary });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to seed database' });
  }
});



// Serve React app in production if built (fallback static server)
const frontendDistPath = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

// Serve traffic only after migrations and demo data are ready.
async function start() {
  await db.initDb();
  await seedDatabase();
  app.listen(PORT, () => console.log('Server ready on port ' + PORT));
}
start().catch(error => { console.error('Startup failed:', error.message); process.exitCode = 1; });
