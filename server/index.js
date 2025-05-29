// index.js (Node.js Express Backend)
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const dotenv = require('dotenv');
dotenv.config();

const app = express();

const USERS_FILE = './db/users.json';
const KEYS_FILE = './db/keys.json';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

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
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).send("Missing username or password");

  const users = load(USERS_FILE);
  if (users.find(u => u.username === username))
    return res.status(400).send("Username already exists");

  const token = uuidv4();
  users.push({ username, password, token });

  save(USERS_FILE, users);
  res.json({ token });
});


// ✅ ล็อกอินพร้อมเช็ค HWID
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).send("Missing fields");

  const users = load(USERS_FILE);
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).send("Invalid credentials");

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

// ✅ Admin auth route
app.post("/admin-auth", (req, res) => {
  const { token } = req.body;
  if (!token || token !== ADMIN_TOKEN) {
    return res.status(403).send("Unauthorized");
  }
  res.json({ access: true });
});

// ✅ คืนค่าทุก Key
app.get('/keys', (req, res) => {
  const keys = load(KEYS_FILE);
  res.json(keys);
});

// ✅ ลบ Key (admin)
app.post('/delete-key', (req, res) => {
  const { key } = req.body;
  let keys = load(KEYS_FILE);
  keys = keys.filter(k => k.key !== key);
  save(KEYS_FILE, keys);
  res.send("Deleted");
});

// ✅ คืนค่าทุก User
app.get('/users', (req, res) => {
  const users = load(USERS_FILE);
  res.json(users);
});

// ✅ Reset HWID ผู้ใช้
app.post('/reset-hwid', (req, res) => {
  const { username } = req.body;
  const users = load(USERS_FILE);
  const user = users.find(u => u.username === username);
  if (!user) return res.status(404).send("User not found");
  user.hwid = "";
  save(USERS_FILE, users);
  res.send("HWID reset");
});

const PORT = 3000;
app.listen(PORT, () => console.log(`\uD83C\uDF10 Server running on http://localhost:${PORT}`));
