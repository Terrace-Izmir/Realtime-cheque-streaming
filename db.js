const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const DB_PATH = path.join(__dirname, 'data.db');

async function init() {
  const db = await open({ filename: DB_PATH, driver: sqlite3.Database });
  await db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      orderNumber TEXT,
      site TEXT,
      items TEXT,
      driver TEXT,
      status TEXT DEFAULT 'created',
      startPhoto TEXT,
      startAnswers TEXT,
      completePhoto TEXT,
      completeAnswers TEXT,
      createdAt TEXT
    );
  `);
  // ensure new columns exist (SQLite ALTER TABLE ADD COLUMN is safe if column missing)
  try { await db.exec(`ALTER TABLE orders ADD COLUMN startAt TEXT;`); } catch(e){}
  try { await db.exec(`ALTER TABLE orders ADD COLUMN completeAt TEXT;`); } catch(e){}
  try { await db.exec(`ALTER TABLE orders ADD COLUMN returnedAt TEXT;`); } catch(e){}
  try { await db.exec(`ALTER TABLE orders ADD COLUMN returnNotes TEXT;`); } catch(e){}
  try { await db.exec(`ALTER TABLE orders ADD COLUMN returnPhoto TEXT;`); } catch(e){}
  return db;
}

// simple key/value settings helpers
async function getSetting(key){
  const db = await init();
  // ensure settings table
  await db.exec(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);`);
  const row = await db.get(`SELECT value FROM settings WHERE key = ?`, key);
  return row ? JSON.parse(row.value) : null;
}

async function setSetting(key, value){
  const db = await init();
  await db.exec(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);`);
  const s = JSON.stringify(value);
  await db.run(`INSERT INTO settings(key, value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value;`, key, s);
  return value;
}

async function createOrder(orderNumber, site, items, driver) {
  const db = await init();
  // auto-generate order number if not provided: ORD-<YYYYMMDD>-<random4>
  const num = (orderNumber || `ORD-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(1000+Math.random()*9000)}`);
  // normalize strings to NFC to ensure consistent unicode storage
  const normNum = typeof num === 'string' ? num.normalize('NFC') : num;
  const normDriver = typeof driver === 'string' ? driver.normalize('NFC') : driver;
  const normSite = typeof site === 'object' && site !== null ? { name: (site.name || '').normalize ? (site.name.normalize('NFC')) : site.name, address: (site.address || '').normalize ? (site.address.normalize('NFC')) : site.address } : site;
  const createdAt = new Date().toISOString();
  const res = await db.run(
    `INSERT INTO orders (orderNumber, site, items, driver, createdAt) VALUES (?,?,?,?,?)`,
    normNum, JSON.stringify(normSite||{}), JSON.stringify(items || []), normDriver, createdAt
  );
  return getOrder(res.lastID);
}

async function listOrders(q, startDate, endDate, startFrom, startTo, completeFrom, completeTo) {
  const db = await init();
  let rows;
  const hasQ = q && String(q).trim();
  const hasCreatedStart = startDate && String(startDate).trim();
  const hasCreatedEnd = endDate && String(endDate).trim();
  const hasStartFrom = startFrom && String(startFrom).trim();
  const hasStartTo = startTo && String(startTo).trim();
  const hasCompleteFrom = completeFrom && String(completeFrom).trim();
  const hasCompleteTo = completeTo && String(completeTo).trim();

  // build query dynamically
  const clauses = [];
  const params = [];
  if (hasQ){ clauses.push(`(orderNumber LIKE ? OR site LIKE ? OR driver LIKE ? OR items LIKE ?)`); const like = `%${q}%`; params.push(like, like, like, like); }
  if (hasCreatedStart){ clauses.push(`createdAt >= ?`); params.push(startDate); }
  if (hasCreatedEnd){ clauses.push(`createdAt <= ?`); params.push(endDate); }
  if (hasStartFrom){ clauses.push(`startAt >= ?`); params.push(startFrom); }
  if (hasStartTo){ clauses.push(`startAt <= ?`); params.push(startTo); }
  if (hasCompleteFrom){ clauses.push(`completeAt >= ?`); params.push(completeFrom); }
  if (hasCompleteTo){ clauses.push(`completeAt <= ?`); params.push(completeTo); }

  const where = clauses.length ? ('WHERE ' + clauses.join(' AND ')) : '';
  const sql = `SELECT * FROM orders ${where} ORDER BY createdAt DESC`;
  rows = await db.all(sql, ...params);
  return Promise.all(rows.map(async row => {
    try { row.site = JSON.parse(row.site || '{}'); } catch(e) { row.site = {}; }
    try { row.items = JSON.parse(row.items || '[]'); } catch(e) { row.items = []; }
    try { row.startAnswers = JSON.parse(row.startAnswers || 'null'); } catch(e) { row.startAnswers = null; }
    try { row.completeAnswers = JSON.parse(row.completeAnswers || 'null'); } catch(e) { row.completeAnswers = null; }
    return row;
  }));
}

async function getOrder(id) {
  const db = await init();
  const row = await db.get(`SELECT * FROM orders WHERE id = ?`, id);
  if (!row) return null;
  try { row.site = JSON.parse(row.site || '{}'); } catch(e){ row.site = {}; }
  try { row.items = JSON.parse(row.items || '[]'); } catch(e){ row.items = []; }
  try { row.startAnswers = JSON.parse(row.startAnswers || 'null'); } catch(e){ row.startAnswers = null; }
  try { row.completeAnswers = JSON.parse(row.completeAnswers || 'null'); } catch(e){ row.completeAnswers = null; }
  // ensure startAt/completeAt fields are present
  row.startAt = row.startAt || null;
  row.completeAt = row.completeAt || null;
  row.returnedAt = row.returnedAt || null;
  row.returnPhoto = row.returnPhoto || null;
  try { row.returnNotes = JSON.parse(row.returnNotes || 'null'); } catch(e){ row.returnNotes = null; }
  return row;
}

async function startDispatch(id, photo, answers) {
  const db = await init();
  const now = new Date().toISOString();
  await db.run(`UPDATE orders SET status='in_transit', startPhoto=?, startAnswers=?, startAt=? WHERE id=?`, photo, JSON.stringify(answers||null), now, id);
  return getOrder(id);
}

async function completeDispatch(id, photo, answers) {
  const db = await init();
  const now = new Date().toISOString();
  await db.run(`UPDATE orders SET status='completed', completePhoto=?, completeAnswers=?, completeAt=? WHERE id=?`, photo, JSON.stringify(answers||null), now, id);
  return getOrder(id);
}

async function returnOrder(id, notes, photo){
  const db = await init();
  const now = new Date().toISOString();
  await db.run(`UPDATE orders SET status='returned', returnedAt=?, returnNotes=?, returnPhoto=? WHERE id=?`, now, JSON.stringify(notes||null), photo || null, id);
  return getOrder(id);
}

module.exports = { init, createOrder, listOrders, getOrder, startDispatch, completeDispatch, returnOrder, getSetting, setSetting };
