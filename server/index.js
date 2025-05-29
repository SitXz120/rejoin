// index.js (Node.js Express Backend)
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const app = express();

const USERS_FILE = './db/users.json';
const KEYS_FILE = './db/keys.json';

app.use(bodyParser.json());
app.use(express.static('public'));

function load(file) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
}

function save(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ✅ สมัครสมาชิก พร้อมผูก HWID และ Key
app.post('/register', (req, res) => {
  const { username, password, hwid, licenseKey } = req.body;
  if (!username || !password || !hwid || !licenseKey)
    return res.status(400).send("Missing required fields");

  const users = load(USERS_FILE);
  const keys = load(KEYS_FILE);

  if (users.find(u => u.username === username))
    return res.status(400).send("Username already exists");

  const key = keys.find(k => k.key === licenseKey);
  if (!key) return res.status(401).send("Invalid license key");
  if (key.hwid.length >= key.limit)
    return res.status(403).send("Device limit exceeded for this key");

  const token = uuidv4();
  users.push({ username, password, token, hwid, key: licenseKey });
  key.hwid.push(hwid);

  save(USERS_FILE, users);
  save(KEYS_FILE, keys);
  res.json({ token });
});

// ✅ ล็อกอินพร้อมเช็ค HWID
app.post('/login', (req, res) => {
  const { username, password, hwid } = req.body;
  if (!username || !password || !hwid)
    return res.status(400).send("Missing fields");

  const users = load(USERS_FILE);
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).send("Invalid credentials");
  if (user.hwid !== hwid) return res.status(403).send("HWID mismatch");

  res.json({ token: user.token });
});

// ✅ ตรวจสอบ HWID (จาก GUI)
app.post('/check_hwid', (req, res) => {
  const { username, hwid } = req.body;
  const users = load(USERS_FILE);
  const user = users.find(u => u.username === username);
  if (!user) return res.status(404).send("User not found");
  if (user.hwid !== hwid) return res.status(403).send("HWID mismatch");
  res.send("HWID OK");
});

// ✅ ดูข้อมูล License ของผู้ใช้
app.post('/license-info', (req, res) => {
  const { token } = req.body;
  const users = load(USERS_FILE);
  const keys = load(KEYS_FILE);
  const user = users.find(u => u.token === token);
  if (!user) return res.status(404).send("User not found");

  const key = keys.find(k => k.key === user.key);
  if (!key) return res.status(404).send("Key not found");

  res.json({
    key: key.key,
    limit: key.limit,
    hwids: key.hwid
  });
});

// ✅ สร้าง License Key (admin เท่านั้น)
app.post('/create-key', (req, res) => {
  const { key, limit } = req.body;
  if (!key || !limit) return res.status(400).send("Missing key or limit");

  const keys = load(KEYS_FILE);
  if (keys.find(k => k.key === key)) return res.status(409).send("Key exists");

  keys.push({ key, limit: parseInt(limit), hwid: [] });
  save(KEYS_FILE, keys);
  res.send("Key created");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Server running on port ${PORT}`));
