import express from "express";
import cors from "cors";
import multer from "multer";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import cloudinary from "cloudinary";
import streamifier from "streamifier";

const app = express();
const upload = multer();
app.use(cors());
app.use(express.json());

// --- base de données temporaire (objet en mémoire)
const users = {}; // { username: { passwordHash, levels: [] } }
const levels = {}; // { levelId: { title, description, creator, json_url, image_urls, id } }

// --- configuration Cloudinary
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_KEY = process.env.ADMIN_KEY;

// --- signup
app.post("/api/signup", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: "missing" });
  if (users[username]) return res.status(400).json({ error: "exists" });
  const hash = await bcrypt.hash(password, 10);
  users[username] = { passwordHash: hash, levels: [] };
  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, username });
});

// --- login
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  const user = users[username];
  if (!user) return res.status(400).json({ error: "not found" });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(400).json({ error: "wrong password" });
  const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token, username });
});

// --- admin login
app.post("/api/admin/login", (req, res) => {
  const { adminKey } = req.body;
  if (adminKey !== ADMIN_KEY) return res.status(401).json({ error: "invalid key" });
  const token = jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ token });
});

// --- auth middleware
function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "no auth" });
  const parts = authHeader.split(" ");
  if (parts.length !== 2) return res.status(401).json({ error: "bad auth" });
  try {
    req.user = jwt.verify(parts[1], JWT_SECRET);
    next();
  } catch (e) {
    res.status(401).json({ error: "invalid token" });
  }
}

// --- upload JSON + images
app.post("/api/upload", auth, upload.fields([{ name: "jsonFile", maxCount: 1 }, { name: "images", maxCount: 3 }]), async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title || !req.files["jsonFile"]) return res.status(400).json({ error: "missing" });
    const creator = req.user.username;

    // --- upload JSON
    const jsonBuf = req.files["jsonFile"][0].buffer;
    const jsonResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.v2.uploader.upload_stream({
        resource_type: "raw",
        folder: `levels/${creator}`
      }, (err, result) => { if (err) reject(err); else resolve(result); });
      streamifier.createReadStream(jsonBuf).pipe(uploadStream);
    });

    // --- upload images
    const images = req.files["images"] || [];
    const imageResults = [];
    for (const f of images) {
      const imgRes = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.v2.uploader.upload_stream({
          folder: `levels/${creator}`
        }, (err, result) => { if (err) reject(err); else resolve(result); });
        streamifier.createReadStream(f.buffer).pipe(uploadStream);
      });
      imageResults.push(imgRes.secure_url);
    }

    // --- sauvegarde niveau
    const id = Date.now().toString();
    const levelObj = {
      id,
      title,
      description,
      creator,
      json_url: jsonResult.secure_url,
      image_urls: imageResults
    };
    levels[id] = levelObj;
    users[creator].levels.push(id);

    res.json({ ok: true, level: levelObj });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "upload failed" });
  }
});

// --- get levels
app.get("/api/levels", auth, (req, res) => {
  const { creator, q } = req.query;
  let result = Object.values(levels);
  if (creator) result = result.filter(l => l.creator === creator);
  if (q) result = result.filter(l => l.title.toLowerCase().includes(q.toLowerCase()) || l.creator.toLowerCase().includes(q.toLowerCase()));
  res.json(result);
});

// --- delete level
app.delete("/api/levels/:id", auth, (req, res) => {
  const level = levels[req.params.id];
  if (!level) return res.status(404).json({ error: "not found" });
  if (req.user.admin || req.user.username === level.creator) {
    delete levels[req.params.id];
    const idx = users[level.creator].levels.indexOf(req.params.id);
    if (idx !== -1) users[level.creator].levels.splice(idx, 1);
    res.json({ ok: true });
  } else res.status(403).json({ error: "forbidden" });
});

// --- start server (Vercel ignore port, handler export suffices)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

export default app;
