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
const JWT_SECRET = process.env.JWT_SECRET || 'safepath_super_secret_key_12345';

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
  'town hall': { lat: 7.1900, lng: 8.1350 }
};

function geocodeLandmark(text) {
  if (!text) return null;
  const cleanText = text.trim().toLowerCase();
  
  // Direct match
  if (LANDMARKS[cleanText]) {
    return LANDMARKS[cleanText];
  }
  
  // Fuzzy match (substring)
  for (const landmark in LANDMARKS) {
    if (cleanText.includes(landmark) || landmark.includes(cleanText)) {
      return LANDMARKS[landmark];
    }
  }
  
  // Default fallback to center of Otukpo
  return LANDMARKS['otukpo'];
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
app.get('/api/resources', async (req, res) => {
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
    res.json(resource);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch resource details' });
  }
});

// 3. Submit a new report (rate limiting mocked/simplified)
app.post('/api/reports', async (req, res) => {
  try {
    const { type, name, description, location, reporter_contact, source } = req.body;
    
    if (!type || !name || !location || typeof location.lat === 'undefined' || typeof location.lng === 'undefined') {
      return res.status(400).json({ error: 'Missing required fields (type, name, location.lat, location.lng)' });
    }
    
    const report = await db.createReport({
      type,
      name,
      description,
      lat: location.lat,
      lng: location.lng,
      reporter_contact,
      source: source || 'app'
    });
    
    res.status(201).json(report);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// 4. Safe route path avoidance
app.post('/api/route', async (req, res) => {
  try {
    const { start, end } = req.body;
    if (!start || !end) {
      return res.status(400).json({ error: 'Missing start or end coordinates' });
    }

    // Get all verified hazard zones
    const hazards = await db.getResources({ type: 'hazard', status: 'verified' });

    // Standard path is direct
    let pathPoints = [start, end];

    // Simple hazard avoidance logic
    // Demo hazard buffer: roughly 4.5km around verified hazard reports.
    const HAZARD_RADIUS_DEG = 0.04; 

    for (const hazard of hazards) {
      const H = { lat: hazard.lat, lng: hazard.lng };

      // Line segment from Start (S) to End (E)
      const S = start;
      const E = end;

      // Vector SE
      const dx = E.lng - S.lng;
      const dy = E.lat - S.lat;
      const lenSq = dx * dx + dy * dy;

      if (lenSq === 0) continue;

      // Project H onto segment SE
      let t = ((H.lng - S.lng) * dx + (H.lat - S.lat) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t)); // Clamp to segment

      // Closest point C on segment
      const C = {
        lat: S.lat + t * dy,
        lng: S.lng + t * dx
      };

      // Distance from H to C
      const distLat = C.lat - H.lat;
      const distLng = C.lng - H.lng;
      const distSq = distLat * distLat + distLng * distLng;
      const dist = Math.sqrt(distSq);

      if (dist < HAZARD_RADIUS_DEG) {
        // Path intersects hazard! Calculate detour point D
        // Push C away from H to outside the circle (with 25% safety margin)
        const pushFactor = (HAZARD_RADIUS_DEG * 1.25) / (dist || 0.001);
        const D = {
          lat: H.lat + distLat * pushFactor,
          lng: H.lng + distLng * pushFactor
        };

        // Insert detour point between start and end
        pathPoints = [start, D, end];
        break; // Detour around first intersecting hazard for the demo
      }
    }

    res.json({
      route: pathPoints,
      avoided_hazards_count: pathPoints.length > 2 ? 1 : 0
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to calculate safe route' });
  }
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
        replyText = `Could not geocode location: ${placeName}`;
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
        replyText = `Could not geocode location: ${placeName}`;
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
        replyText = `Could not find location ${placeName}. Report aborted.`;
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

    const parts = text.split('*').filter(p => p !== '');

    if (parts.length === 0) {
      // Main Menu
      response = `CON Welcome to SafePath\n1. Find nearest resource\n2. Report a resource or hazard`;
    } else if (parts[0] === '1') {
      // Find Resource Sub-Menu
      if (parts.length === 1) {
        response = `CON Select resource type:\n1. Shelter\n2. Water\n3. Medical\n4. Food\n5. Safe Zone`;
      } else if (parts.length === 2) {
        response = `CON Enter your nearest landmark (e.g. Otukpo market):`;
      } else if (parts.length === 3) {
        const typeIdx = parts[1];
        const landmark = parts[2];
        const typeMap = { '1': 'shelter', '2': 'water', '3': 'medical', '4': 'food', '5': 'safe_zone' };
        const typeStr = typeMap[typeIdx] || 'shelter';

        const coords = geocodeLandmark(landmark);
        const verifiedList = await db.getResources({ type: typeStr, status: 'verified' });

        const nearby = verifiedList.map(r => {
          const d = db.getDistance(coords.lat, coords.lng, r.lat, r.lng);
          return { ...r, distance: d };
        }).sort((a, b) => a.distance - b.distance);

        if (nearby.length > 0) {
          const nearest = nearby[0];
          response = `END Nearest ${typeStr.toUpperCase()}: ${nearest.name} (${nearest.distance.toFixed(1)}km). ${nearest.description || ''}`;
        } else {
          response = `END No ${typeStr.toUpperCase()} found near ${landmark}`;
        }
      }
    } else if (parts[0] === '2') {
      // Report Resource Sub-Menu
      if (parts.length === 1) {
        response = `CON Select type to report:\n1. Shelter\n2. Water\n3. Medical\n4. Food\n5. Hazard`;
      } else if (parts.length === 2) {
        response = `CON Enter short description (e.g. Church hall open):`;
      } else if (parts.length === 3) {
        response = `CON Enter nearest landmark (e.g. Otukpo market):`;
      } else if (parts.length === 4) {
        const typeIdx = parts[1];
        const desc = parts[2];
        const landmark = parts[3];
        const typeMap = { '1': 'shelter', '2': 'water', '3': 'medical', '4': 'food', '5': 'hazard' };
        const typeStr = typeMap[typeIdx] || 'shelter';

        const coords = geocodeLandmark(landmark);
        const newReport = await db.createReport({
          type: typeStr,
          name: `${typeStr.toUpperCase()} reported via USSD`,
          description: `${desc} (near ${landmark})`,
          lat: coords.lat,
          lng: coords.lng,
          reporter_contact: phoneNumber,
          source: 'sms'
        });

        response = `END Report submitted successfully. Thank you for keeping the community safe. ID: ${newReport.id.slice(0, 8)}`;
      }
    } else {
      response = `END Invalid selection. Please dial again.`;
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

// Start Server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  try {
    await db.initDb();
    // Self-seeding: a fresh deploy (any driver) comes up with the full demo dataset,
    // so there is never an empty map on stage. Idempotent -- existing data is left alone.
    const summary = await seedDatabase();
    console.log(`Demo data ready: ${summary.resources} resources, ${summary.pending_reports} pending reports`);
    console.log(`Coordinator login: ${summary.credentials.phone} / ${summary.credentials.password}`);
  } catch (error) {
    console.error('Error starting database:', error);
  }
});

