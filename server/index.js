const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const app = express();

const USERS_FILE = './db/users.json';
const KEYS_FILE = './db/keys.json';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN; // ✅ ใช้ Environment Variable

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// 🧩 Helper
function load(file) {
  if (!fs.existsSync(file)) fs.writeFileSync(file, '[]');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function save(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ✅ สมัครสมาชิก
app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).send("Missing username or password");

  const users = load(USERS_FILE);
  if (users.find(u => u.username === username)) return res.status(400).send("Username already exists");

  const token = uuidv4();
  users.push({ username, password, token });

  save(USERS_FILE, users);
  res.json({ token });
});

// ✅ ล็อกอิน
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).send("Missing fields");

  const users = load(USERS_FILE);
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).send("Invalid credentials");

  res.json({ token: user.token });
});

// ✅ ตรวจสอบ license
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

// ✅ Auth Admin ด้วย token
app.post("/admin-auth", (req, res) => {
  const { token } = req.body;
  if (!token || token !== ADMIN_TOKEN) {
    return res.status(403).send("Unauthorized");
  }
  res.json({ access: true });
});

// ✅ อ่าน key ทั้งหมด
app.get('/keys', (req, res) => {
  const keys = load(KEYS_FILE);
  res.json(keys);
});

// ✅ สร้าง Key
app.post('/create-key', (req, res) => {
  const { key, limit } = req.body;
  if (!key || !limit) return res.status(400).send("Missing key or limit");

  const keys = load(KEYS_FILE);
  if (keys.find(k => k.key === key)) return res.status(409).send("Key exists");

  keys.push({ key, limit: parseInt(limit), hwid: [] });
  save(KEYS_FILE, keys);
  res.send("Key created");
});

// ✅ ลบ Key
app.post('/delete-key', (req, res) => {
  const { key } = req.body;
  let keys = load(KEYS_FILE);
  keys = keys.filter(k => k.key !== key);
  save(KEYS_FILE, keys);
  res.send("Deleted");
});

// ✅ อ่าน Users
app.get('/users', (req, res) => {
  const users = load(USERS_FILE);
  res.json(users);
});

// ✅ Reset HWID
app.post('/reset-hwid', (req, res) => {
  const { username } = req.body;
  const users = load(USERS_FILE);
  const user = users.find(u => u.username === username);
  if (!user) return res.status(404).send("User not found");

  user.hwid = "";
  save(USERS_FILE, users);
  res.send("HWID reset");
});

// ✅ Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Server running on http://localhost:${PORT}`));
