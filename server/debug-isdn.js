/**
 * ISDN Debug Script
 * Run from inside your isdn/server/ folder:
 *   node debug-isdn.js
 *
 * Tests every layer and tells you exactly what is broken.
 */

const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

// ── ANSI colours ──────────────────────────────────────────────
const G = s => `\x1b[32m✔  ${s}\x1b[0m`;
const R = s => `\x1b[31m✘  ${s}\x1b[0m`;
const Y = s => `\x1b[33m⚠  ${s}\x1b[0m`;
const H = s => `\n\x1b[1m\x1b[36m── ${s} ──\x1b[0m`;

let passed = 0, failed = 0;
const ok  = msg => { console.log(G(msg)); passed++; };
const bad = msg => { console.log(R(msg)); failed++; };
const warn = msg => console.log(Y(msg));

// ── 1. Check .env exists ──────────────────────────────────────
console.log(H('1. Environment file'));
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  bad('.env file NOT FOUND in server/ folder');
  console.log('   Fix: create server/.env with this content:\n');
  console.log('   PORT=5000');
  console.log('   DB_HOST=localhost');
  console.log('   DB_PORT=3306');
  console.log('   DB_USER=root');
  console.log('   DB_PASSWORD=');
  console.log('   DB_NAME=isdn_db');
  console.log('   JWT_SECRET=any_long_secret_string_here\n');
} else {
  ok('.env file found');
  // parse it
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  const env = {};
  lines.forEach(l => {
    const [k, ...v] = l.split('=');
    if (k && k.trim()) env[k.trim()] = v.join('=').trim();
  });
  const required = ['PORT','DB_HOST','DB_PORT','DB_USER','DB_NAME','JWT_SECRET'];
  required.forEach(k => {
    if (env[k] !== undefined) ok(`.env has ${k} = "${env[k]}"`);
    else bad(`.env is MISSING key: ${k}`);
  });
  if (env['DB_PASSWORD'] === undefined) warn('DB_PASSWORD not set — using empty string (OK for WAMP default)');
  else ok(`.env has DB_PASSWORD = "${env['DB_PASSWORD']}" (empty is correct for WAMP)`);
}

// ── 2. Check mysql2 package exists ───────────────────────────
console.log(H('2. Node packages'));
const pkgs = ['mysql2','express','jsonwebtoken','bcryptjs','dotenv'];
pkgs.forEach(p => {
  const pPath = path.join(__dirname, 'node_modules', p);
  if (fs.existsSync(pPath)) ok(`node_modules/${p} installed`);
  else bad(`node_modules/${p} NOT installed — run: npm install`);
});

// ── 3. MySQL connection test ──────────────────────────────────
console.log(H('3. MySQL connection'));
let mysql2;
try {
  mysql2 = require('./node_modules/mysql2/promise');
} catch {
  bad('Cannot load mysql2 — run npm install first');
  printSummary();
  process.exit(1);
}

// Load env vars
require('./node_modules/dotenv').config();
const cfg = {
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '3306'),
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'isdn_db',
};

(async () => {
  let conn;
  try {
    conn = await mysql2.createConnection(cfg);
    ok(`Connected to MySQL at ${cfg.host}:${cfg.port}`);
    ok(`Using database: ${cfg.database}`);
  } catch (e) {
    bad(`MySQL connection FAILED: ${e.message}`);
    if (e.message.includes('ECONNREFUSED'))
      warn('Fix: WAMP is not running or MySQL is stopped. Start WAMP and wait for green icon.');
    else if (e.message.includes('ER_ACCESS_DENIED'))
      warn(`Fix: Wrong DB_USER/DB_PASSWORD in .env. WAMP default is user=root, password=(empty)`);
    else if (e.message.includes('ER_BAD_DB_ERROR'))
      warn(`Fix: Database "${cfg.database}" does not exist. Create it in phpMyAdmin.`);
    printSummary();
    process.exit(1);
  }

  // ── 4. Check tables exist ───────────────────────────────────
  console.log(H('4. Database tables'));
  const tables = ['roles','users','user_roles','rdcs','products','inventory','orders','deliveries','invoices','notifications'];
  const [rows] = await conn.query('SHOW TABLES');
  const existing = rows.map(r => Object.values(r)[0]);
  tables.forEach(t => {
    if (existing.includes(t)) ok(`Table "${t}" exists`);
    else bad(`Table "${t}" MISSING — run database/schema.sql in phpMyAdmin`);
  });

  // ── 5. Check admin user exists ──────────────────────────────
  console.log(H('5. Seed data'));
  const [users] = await conn.query('SELECT id, email, password_hash FROM users WHERE email = ?', ['admin@isdn.lk']);
  if (users.length === 0) {
    bad('Admin user (admin@isdn.lk) NOT found — run fix-seed.sql in phpMyAdmin');
    printSummary();
    conn.end();
    process.exit(1);
  }
  const adminUser = users[0];
  ok(`Admin user found: ${adminUser.email}`);

  const [roleRows] = await conn.query(
    `SELECT r.name FROM roles r
     JOIN user_roles ur ON r.id = ur.role_id
     WHERE ur.user_id = ?`, [adminUser.id]);
  if (roleRows.length > 0) ok(`Admin roles: ${roleRows.map(r=>r.name).join(', ')}`);
  else bad('Admin user has NO roles assigned — check user_roles table');

  // ── 6. Verify bcrypt hash ───────────────────────────────────
  console.log(H('6. Password hash verification'));
  const bcrypt = require('./node_modules/bcryptjs');
  const hash = adminUser.password_hash;
  console.log(`   Stored hash: ${hash.substring(0,20)}...`);

  const testPasswords = ['Admin@1234', 'password', 'admin', 'Admin1234', '123456'];
  let matched = null;
  for (const p of testPasswords) {
    const valid = await bcrypt.compare(p, hash);
    if (valid) { matched = p; break; }
  }
  if (matched) {
    ok(`Hash matches password: "${matched}"`);
    if (matched !== 'Admin@1234') {
      warn(`Password is "${matched}", NOT "Admin@1234" — run fix-seed.sql to reset`);
    }
  } else {
    bad('Hash does NOT match any common password — run fix-seed.sql in phpMyAdmin');
  }

  // ── 7. Test the live API endpoint ───────────────────────────
  console.log(H('7. Live API test (POST /api/v1/auth/login)'));
  const loginPassword = matched || 'Admin@1234';
  const postData = JSON.stringify({ email: 'admin@isdn.lk', password: loginPassword });

  await new Promise(resolve => {
    const req = http.request({
      hostname: 'localhost',
      port: parseInt(process.env.PORT || '5000'),
      path: '/api/v1/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
    }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        if (res.statusCode === 200) {
          ok(`API login returned 200 OK`);
          try {
            const json = JSON.parse(body);
            if (json.data && json.data.accessToken) ok('Access token received — login WORKS!');
            else warn('Response 200 but no accessToken in body: ' + body.substring(0,200));
          } catch { warn('Could not parse response: ' + body.substring(0,200)); }
        } else {
          bad(`API returned ${res.statusCode}: ${body.substring(0,300)}`);
          if (res.statusCode === 401) warn('Server running but login rejected — password hash mismatch. Run fix-seed.sql');
          if (res.statusCode === 404) warn('Route not found — check app.ts mounts auth routes at /api/v1/auth');
          if (res.statusCode === 500) warn('Server error — check the terminal running npm run dev for the error');
        }
        resolve(null);
      });
    });
    req.on('error', e => {
      bad(`Cannot reach server at localhost:5000 — ${e.message}`);
      warn('Fix: make sure "npm run dev" is running in server/ folder');
      resolve(null);
    });
    req.write(postData);
    req.end();
  });

  // ── 8. Check health endpoint ─────────────────────────────────
  console.log(H('8. Server health check'));
  await new Promise(resolve => {
    http.get(`http://localhost:${process.env.PORT || 5000}/health`, res => {
      let b = '';
      res.on('data', d => b += d);
      res.on('end', () => {
        if (res.statusCode === 200) ok(`Health endpoint OK: ${b}`);
        else bad(`Health endpoint returned ${res.statusCode}`);
        resolve(null);
      });
    }).on('error', () => { bad('Server not reachable on port 5000'); resolve(null); });
  });

  conn.end();
  printSummary();
})();

function printSummary() {
  console.log('\n\x1b[1m════════════════════════════════\x1b[0m');
  console.log(`\x1b[32m  Passed: ${passed}\x1b[0m`);
  console.log(`\x1b[31m  Failed: ${failed}\x1b[0m`);
  console.log('\x1b[1m════════════════════════════════\x1b[0m\n');
  if (failed === 0) {
    console.log('\x1b[32m\x1b[1m  All checks passed! Login should work.\x1b[0m\n');
  } else {
    console.log('\x1b[31m\x1b[1m  Fix the items marked ✘ above, then retry.\x1b[0m\n');
  }
}