const path = require('path');
const fs = require('fs');
const express = require('express');
const http = require('http');
const multer = require('multer');
const { Server } = require('socket.io');
const cors = require('cors');
const db = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ensure API JSON responses declare UTF-8 charset so Turkish characters are preserved
app.use('/api', (req, res, next) => {
  // Only set for API routes returning JSON
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g,'_'))
});
const upload = multer({ storage });

io.on('connection', socket => {
  console.log('socket connected', socket.id);
  socket.on('join', room => {
    console.log('socket join', socket.id, room);
    socket.join(room);
  });
});

// API
app.post('/api/orders', async (req, res) => {
  // Accepts: orderNumber (optional), siteName, siteAddress, items, driver (name/phone)
  const { orderNumber, siteName, siteAddress, items, driver } = req.body;
  try {
    // If no orderNumber provided, db.createOrder will generate one
    const order = await db.createOrder(orderNumber, { name: siteName, address: siteAddress }, items, driver);
    io.to('dispatcher').emit('order_created', order);
    io.to('accounting').emit('order_created', order);
    io.to('drivers').emit('order_created', order);
    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders', async (req, res) => {
  const q = req.query.q || '';
  const startDate = req.query.startDate || '';
  const endDate = req.query.endDate || '';
  const startFrom = req.query.startFrom || '';
  const startTo = req.query.startTo || '';
  const completeFrom = req.query.completeFrom || '';
  const completeTo = req.query.completeTo || '';
  const orders = await db.listOrders(q, startDate, endDate, startFrom, startTo, completeFrom, completeTo);
  res.json(orders);
});

app.get('/api/orders/:id', async (req, res) => {
  const order = await db.getOrder(req.params.id);
  res.json(order);
});

app.post('/api/orders/:id/start', upload.single('photo'), async (req, res) => {
  try {
    const { id } = req.params;
    const { answers } = req.body; // expected JSON string or object
    const photo = req.file ? req.file.filename : null;
    const parsed = typeof answers === 'string' ? JSON.parse(answers) : answers;
    const update = await db.startDispatch(id, photo, parsed);
  const full = await db.getOrder(id);
  io.to('accounting').emit('dispatch_started', full);
  io.to('dispatcher').emit('dispatch_started', full);
  io.to('drivers').emit('dispatch_started', full);
    res.json(update);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/orders/:id/complete', upload.single('photo'), async (req, res) => {
  try {
    const { id } = req.params;
    const { answers } = req.body;
    const photo = req.file ? req.file.filename : null;
    const parsed = typeof answers === 'string' ? JSON.parse(answers) : answers;
  const update = await db.completeDispatch(id, photo, parsed);
  const full = await db.getOrder(id);
  io.to('accounting').emit('dispatch_completed', full);
  io.to('dispatcher').emit('dispatch_completed', full);
  io.to('drivers').emit('dispatch_completed', full);
  res.json(update);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/orders/:id/return', upload.single('photo'), async (req, res) => {
  try{
    const { id } = req.params;
    const notes = req.body && req.body.notes ? req.body.notes : req.body || null;
    const photo = req.file ? req.file.filename : null;
    const update = await db.returnOrder(id, notes, photo);
    const full = await db.getOrder(id);
    io.to('accounting').emit('order_returned', full);
    io.to('dispatcher').emit('order_returned', full);
    io.to('drivers').emit('order_returned', full);
    res.json(update);
  }catch(err){ console.error(err); res.status(500).json({ error: err.message }); }
});

app.get('/uploads/:file', (req, res) => {
  const p = path.join(uploadsDir, req.params.file);
  res.sendFile(p);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

// settings endpoints
app.get('/api/settings/:key', async (req, res) => {
  try{
    const val = await db.getSetting(req.params.key);
    res.json({ value: val });
  }catch(err){ res.status(500).json({ error: err.message }); }
});

app.post('/api/settings/:key', express.json(), async (req, res) => {
  try{
    const val = req.body && req.body.value !== undefined ? req.body.value : null;
    const saved = await db.setSetting(req.params.key, val);
    res.json({ value: saved });
  }catch(err){ res.status(500).json({ error: err.message }); }
});
