import db from './db';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Helper to determine if we are online
export function isOnline() {
  return navigator.onLine;
}

// Fetch helper with auth header
async function request(path, options = {}) {
  const token = localStorage.getItem('safepath_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE}${path}`;
  const response = await fetch(url, { ...options, headers });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error ${response.status}`);
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
          await db.resources.clear();
          await db.resources.bulkAdd(data);
        }
        
        return data;
      } catch (err) {
        console.warn('API error, falling back to IndexedDB:', err);
        return db.resources.toArray();
      }
    } else {
      // Offline: read from IndexedDB
      console.log('Offline: loading resources from IndexedDB');
      let cached = await db.resources.toArray();
      if (type) {
        cached = cached.filter(r => r.type === type);
      }
      return cached;
    }
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
    if (isOnline()) {
      return request('/api/reports', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    } else {
      // Offline: queue in IndexedDB
      console.log('Offline: queueing report in IndexedDB');
      const id = await db.reports_queue.add({
        ...data,
        created_at: new Date().toISOString()
      });
      return { id, status: 'pending', offline: true };
    }
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
    localStorage.setItem('safepath_token', data.token);
    localStorage.setItem('safepath_user', JSON.stringify(data.user));
    return data;
  },

  logout() {
    localStorage.removeItem('safepath_token');
    localStorage.removeItem('safepath_user');
  },

  getCurrentUser() {
    try {
      return JSON.parse(localStorage.getItem('safepath_user'));
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

// Sync offline reports queue when back online
export async function syncOfflineReports() {
  const queue = await db.reports_queue.toArray();
  if (queue.length === 0) return 0;

  console.log(`Syncing ${queue.length} offline reports...`);
  let syncedCount = 0;

  for (const report of queue) {
    try {
      const { id, ...reportData } = report;
      await request('/api/reports', {
        method: 'POST',
        body: JSON.stringify(reportData)
      });
      await db.reports_queue.delete(id);
      syncedCount++;
    } catch (err) {
      console.error('Failed to sync report:', report, err);
      // Keep it in queue to retry later
    }
  }

  return syncedCount;
}

// Add event listener to auto-sync when network returns
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('Network back online! Triggering background sync...');
    syncOfflineReports().then(count => {
      if (count > 0) {
        console.log(`Auto-synced ${count} reports.`);
        // Dispatch custom event to let UI know database sync completed
        window.dispatchEvent(new CustomEvent('safepath_synced'));
      }
    });
  });
}
