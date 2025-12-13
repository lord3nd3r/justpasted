const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const HTTP_PORT = process.env.TEST_PORT || 4000;
const BASE = `http://127.0.0.1:${HTTP_PORT}`;

function waitForServer(timeout = 5000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    (function poll() {
      fetch(BASE + '/').then(r => {
        if (r.ok) return resolve();
        if (Date.now() - start > timeout) return reject(new Error('timeout'));
        setTimeout(poll, 200);
      }).catch(() => {
        if (Date.now() - start > timeout) return reject(new Error('timeout'));
        setTimeout(poll, 200);
      });
    })();
  });
}

function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

describe('Admin API integration', () => {
  let serverProc = null;
  let db = null;
  let sid = null;

  beforeAll(async () => {
    // remove existing DB for clean slate
    const dbPath = path.join(__dirname, '..', 'pastebin.db');
    try { if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath); } catch (e) {}

    // spawn server
    serverProc = spawn('node', ['server.js'], {
      env: Object.assign({}, process.env, { HTTP_PORT: String(HTTP_PORT) }),
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // attach logs to help debugging if tests fail
    serverProc.stdout.on('data', d => process.stdout.write('[srv] '+d.toString()));
    serverProc.stderr.on('data', d => process.stderr.write('[srv] '+d.toString()));

    // wait for server to be available
    await waitForServer(8000);

    // open DB and create an admin user + session
    db = new sqlite3.Database(path.join(__dirname, '..', 'pastebin.db'));
    await new Promise((resolve) => setTimeout(resolve, 200));

    await new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run("INSERT INTO users (email, password_hash, created, role) VALUES (?, ?, ?, ?)", ['lord3nd3r@gmail.com','x', Date.now(), 'admin'], function(err) {
          if (err) return reject(err);
          const uid = this.lastID;
          sid = 'testsid-' + Math.random().toString(36).slice(2);
          db.run('INSERT INTO sessions (id, user_id, created, expires) VALUES (?, ?, ?, ?)', [sid, uid, Date.now(), Date.now() + 1000*60*60*24], function(err2){ if(err2) return reject(err2); resolve(); });
        });
      });
    });
    // small delay to ensure DB writes flushed
    await sleep(150);
  }, 20000);

  afterAll(async () => {
    try { if (serverProc) serverProc.kill(); } catch (e) {}
    try { if (db) db.close(); } catch (e) {}
  });

  test('GET /api/admin/config (authorized)', async () => {
    const res = await fetch(BASE + '/api/admin/config', { headers:{ Cookie: `session_id=${sid}` } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('EMAIL_VERIFICATION_ENABLED');
    expect(body).toHaveProperty('MAIL');
  });

  test('POST /api/admin/test-smtp returns error for invalid server', async () => {
    const payload = { MAIL: { HOST: 'invalid.local', PORT: 2525, SECURE: false } };
    const res = await fetch(BASE + '/api/admin/test-smtp', { method: 'POST', headers: { 'Content-Type':'application/json', Cookie: `session_id=${sid}` }, body: JSON.stringify(payload) });
    expect(res.status).toBeGreaterThanOrEqual(400);
    const json = await res.json();
    expect(json).toHaveProperty('ok');
  });

  test('Blocked IPs CRUD', async () => {
    // initially empty
    let r = await fetch(BASE + '/api/admin/blocked-ips', { headers:{ Cookie: `session_id=${sid}` } });
    expect(r.status).toBe(200); let arr = await r.json(); expect(Array.isArray(arr)).toBe(true);

    // add IP
    r = await fetch(BASE + '/api/admin/blocked-ips', { method:'POST', headers:{ 'Content-Type':'application/json', Cookie: `session_id=${sid}` }, body: JSON.stringify({ ip:'1.2.3.4', reason:'test' }) });
    expect(r.status).toBe(200); let j = await r.json(); expect(j.ok).toBe(true);

    // list contains it
    r = await fetch(BASE + '/api/admin/blocked-ips', { headers:{ Cookie: `session_id=${sid}` } }); arr = await r.json(); expect(arr.find(x=>x.ip==='1.2.3.4')).toBeTruthy();

    // delete
    r = await fetch(BASE + '/api/admin/blocked-ips/' + encodeURIComponent('1.2.3.4'), { method:'DELETE', headers:{ Cookie: `session_id=${sid}` } }); j = await r.json(); expect(j.ok).toBe(true);

    // now not present
    r = await fetch(BASE + '/api/admin/blocked-ips', { headers:{ Cookie: `session_id=${sid}` } }); arr = await r.json(); expect(arr.find(x=>x.ip==='1.2.3.4')).toBeFalsy();
  });

  test('POST /api/admin/config (force save)', async () => {
    const payload = { EMAIL_VERIFICATION_ENABLED: false, ENABLE_ADMIN_REGISTRATION: false, QUOTA_BYTES: 1234, MAIL: { HOST:'smtp.example', PORT:587 }, force: true };
    const r = await fetch(BASE + '/api/admin/config', { method:'POST', headers:{ 'Content-Type':'application/json', Cookie: `session_id=${sid}` }, body: JSON.stringify(payload) });
    expect(r.status).toBe(200);
    const j = await r.json(); expect(j.ok).toBe(true);
  });
});
