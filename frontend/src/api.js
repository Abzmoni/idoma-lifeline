import db from './db';

const API_BASE = import.meta.env.VITE_API_URL || '';
let dataStatus = { cached: true, updatedAt: null };
export const getDataStatus = () => dataStatus;

// "Online" in the browser only means a network adapter is up. On a phone with data but no credit, a
// captive Wi-Fi, or a laptop with a spare adapter, requests just hang. So we also remember whether the
// server actually answered recently, and never make a person wait on a connection known to be dead.
let serverReachable = null; // null = not tried yet
const setReachable = value => {
  if (serverReachable === value) return;
  serverReachable = value;
  window.dispatchEvent(new CustomEvent('lifeline-connection', { detail: { reachable: value } }));
};
export function isOnline() {
  return navigator.onLine;
}
// True when it is worth making someone wait for the network.
export function connectionUsable() {
  return navigator.onLine && serverReachable !== false;
}
export const isServerReachable = () => serverReachable;
// Resources saved on this device, for showing something instantly before the network answers.
export async function getCachedResources() {
  const resources = await db.resources.toArray();
  const updatedAt = (await db.metadata.get('resources'))?.updatedAt || null;
  return { resources, updatedAt };
}

// Fetch helper with auth header
async function request(path, options = {}) {
  const token = localStorage.getItem('idoma-lifeline_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE}${path}`;
  let response;
  // No answer within a few seconds: treat the connection as unusable for now (it flips back when an answer arrives).
  const slow = setTimeout(() => setReachable(false), 4000);
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(12000), ...options, headers });
  } catch (error) {
    setReachable(false); // no answer at all: network down or hanging
    throw error;
  } finally { clearTimeout(slow); }
  setReachable(true);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error = new Error(errorData.error || `HTTP error ${response.status}`);
    error.status = response.status;
    throw error;
  }
  
  return response.json();
}

export const api = {
  // Resources
  async getResources(filters = {}) {
    const { type, bbox, status } = filters;
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (bbox) params.append('bbox', bbox);
    if (status) params.append('status', status);

    const qs = params.toString() ? `?${params.toString()}` : '';

    if (isOnline()) {
      try {
        const data = await request(`/api/resources${qs}`);
        
        // Cache verified resources in IndexedDB when fetched successfully
        if (!type && !bbox && (!status || status === 'verified')) {
          const updatedAt = new Date().toISOString();
          await db.transaction('rw', db.resources, db.metadata, async () => {
            await db.resources.clear();
            await db.resources.bulkPut(data);
            await db.metadata.put({ key: 'resources', updatedAt });
          });
          dataStatus = { cached: false, updatedAt };
        }
        
        return data;
      } catch (err) {
        console.warn('API error, falling back to IndexedDB:', err);
        if (status && status !== 'verified') throw err;
      }
    }
      // Offline: read from IndexedDB
      console.log('Offline: loading resources from IndexedDB');
      let cached = await db.resources.toArray();
      dataStatus = { cached: true, updatedAt: (await db.metadata.get('resources'))?.updatedAt || null };
      if (type) {
        cached = cached.filter(r => r.type === type);
      }
      if (bbox) {
        const [west, south, east, north] = bbox.split(',').map(Number);
        cached = cached.filter(r => r.lng >= west && r.lng <= east && r.lat >= south && r.lat <= north);
      }
      return cached;
  },

  async getResource(id) {
    if (isOnline()) {
      return request(`/api/resources/${id}`);
    } else {
      const cached = await db.resources.get(id);
      if (!cached) throw new Error('Resource not cached offline');
      return cached;
    }
  },

  async updateResource(id, data) {
    return request(`/api/resources/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  // Reports
  async submitReport(data) {
    // Persist before transmission: a lost response must not lose or duplicate a report.
    const report = { ...data, client_request_id: crypto.randomUUID(), created_at: new Date().toISOString() };
    const id = await db.reports_queue.add(report);
    window.dispatchEvent(new Event('idoma-lifeline_queue'));
    // Never keep someone waiting more than ~3 s; the queue keeps trying in the background.
    if (connectionUsable()) await Promise.race([syncOfflineReports(), new Promise(r => setTimeout(r, 3000))]);
    const remaining = await db.reports_queue.get(id);
    if (remaining?.sync_error) {
      // The open form retains the user's input so it can be corrected and submitted again.
      await db.reports_queue.delete(id);
      window.dispatchEvent(new Event('idoma-lifeline_queue'));
      throw new Error(remaining.sync_error);
    }
    return { id, status: 'pending', offline: Boolean(remaining) };
  },

  async getReports(status) {
    const qs = status ? `?status=${status}` : '';
    return request(`/api/reports${qs}`);
  },

  async approveReport(id) {
    return request(`/api/reports/${id}/approve`, { method: 'POST' });
  },

  async rejectReport(id) {
    return request(`/api/reports/${id}/reject`, { method: 'POST' });
  },

  // Route Avoidance
  async getRoute(start, end) {
    return request('/api/route', {
      method: 'POST',
      body: JSON.stringify({ start, end })
    });
  },

  async simulateSms({ from, text }) {
    const response = await fetch(`${API_BASE}/api/sms/inbound`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: '+23480000000',
        text,
        linkId: `sim_${Math.random().toString(36).slice(2, 11)}`
      })
    });

    if (!response.ok) {
      throw new Error(await response.text().catch(() => 'SMS simulation failed'));
    }

    return response.text();
  },

  async simulateUssd({ sessionId, phoneNumber, text }) {
    const response = await fetch(`${API_BASE}/api/sms/ussd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        phoneNumber,
        text,
        serviceCode: '*384#'
      })
    });

    if (!response.ok) {
      throw new Error(await response.text().catch(() => 'USSD simulation failed'));
    }

    return response.text();
  },

  // Auth
  async login(phone, password) {
    const data = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password })
    });
    localStorage.setItem('idoma-lifeline_token', data.token);
    localStorage.setItem('idoma-lifeline_user', JSON.stringify(data.user));
    return data;
  },

  logout() {
    localStorage.removeItem('idoma-lifeline_token');
    localStorage.removeItem('idoma-lifeline_user');
  },

  getCurrentUser() {
    try {
      return JSON.parse(localStorage.getItem('idoma-lifeline_user'));
    } catch {
      return null;
    }
  },

  // Stats & Logs
  async getAdminStats() {
    return request('/api/admin/stats');
  },

  async getSmsLogs() {
    return request('/api/admin/sms-logs');
  },

  async triggerSeed() {
    return request('/api/admin/seed', { method: 'POST' });
  }
};

// Serialize within a tab; Web Locks also serialize across tabs when available.
let syncPromise = null;
export function syncOfflineReports() {
  if (syncPromise) return syncPromise;
  const run = async () => {
    if (!isOnline()) return 0;
    let count = 0;
    for (const report of await db.reports_queue.toArray()) {
      if (report.sync_error) continue;
      const client_request_id = report.client_request_id || crypto.randomUUID();
      await db.reports_queue.update(report.id, { client_request_id });
      const { id, ...data } = { ...report, client_request_id };
      try {
        await request('/api/reports', { method: 'POST', body: JSON.stringify(data) });
        await db.reports_queue.delete(id);
        count++;
      } catch (error) {
        if (error.status >= 400 && error.status < 500 && error.status !== 429) {
          await db.reports_queue.update(id, { sync_error: error.message });
        }
        break;
      }
    }
    window.dispatchEvent(new CustomEvent('idoma-lifeline_synced', { detail: { count } }));
    return count;
  };
  syncPromise = (navigator.locks ? navigator.locks.request('lifeline-report-sync', run) : run())
    .finally(() => { syncPromise = null; });
  return syncPromise;
}
if (typeof window !== 'undefined') {
  const retry = () => syncOfflineReports().catch(() => {});
  window.addEventListener('online', retry);
  window.addEventListener('focus', retry);
  setTimeout(retry, 0);
  setInterval(retry, 30000);
}
