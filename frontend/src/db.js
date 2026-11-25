import Dexie from 'dexie';

export const db = new Dexie('idoma-lifeline_offline');

db.version(1).stores({
  resources: 'id, type, name, status, lat, lng',
  reports_queue: '++id, type, name, description, lat, lng, reporter_contact, source, created_at'
});
db.version(2).stores({
  resources: 'id, type, name, status, lat, lng',
  reports_queue: '++id, client_request_id, type, name, created_at',
  metadata: 'key'
});
export default db;
