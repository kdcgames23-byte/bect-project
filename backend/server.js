// backend/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import multer from "multer";
import cloudinary from "cloudinary";
import streamifier from "streamifier";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "8mb" })); // allow base64 if used
const upload = multer(); // memory storage

// ensure required env
const required = ["MONGO_URI", "CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET", "JWT_SECRET", "ADMIN_KEY"];
for (const k of required) {
  if (!process.env[k]) {
    console.error(`❌ Missing env ${k}`);
  }
}

// Cloudinary
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// MongoDB
if (!process.env.MONGO_URI) {
  console.error("❌ MONGO_URI is not set — set it in Render environment variables");
  // exit so deploy will fail early
  process.exit(1);
}
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(()=>console.log("✅ MongoDB connected"))
  .catch(err=>{ console.error("❌ MongoDB connection error:", err); process.exit(1); });

// Schemas
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  passwordHash: String,
  role: { type: String, default: "user" }
});
const levelSchema = new mongoose.Schema({
  title: String,
  description: String,
  creator: String,      // username
  creatorId: String,    // user._id as string
  images: [String],     // image URLs
  json_url: String,     // raw json URL on cloudinary
  json_public_id: String,
  image_public_ids: [String],
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model("User", userSchema);
const Level = mongoose.model("Level", levelSchema);

// Helpers
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_KEY = process.env.ADMIN_KEY;

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: "no auth" });
  const parts = auth.split(" ");
  if (parts.length !== 2) return res.status(401).json({ error: "bad auth" });
  try {
    req.user = jwt.verify(parts[1], JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: "invalid token" });
  }
}

// Routes

app.get("/", (req, res) => res.send("BECT API en ligne via Render"));

// Register (username + password)
app.post("/api/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success:false, message: "username & password required" });

    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ success:false, message: "username already exists" });

    const hash = await bcrypt.hash(password, 10);
    const u = new User({ username, passwordHash: hash });
    await u.save();
    const token = jwt.sign({ id: u._id, username: u.username, role: u.role }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ success:true, token, username: u.username, role: u.role });
  } catch(e) {
    console.error(e);
    res.status(500).json({ success:false, message: "server error" });
  }
});

// Login (username + password)
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success:false, message: "username & password required" });
    // admin by key? allow admin login via special endpoint
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ success:false, message: "user not found" });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(400).json({ success:false, message: "wrong password" });
    const token = jwt.sign({ id: user._id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ success:true, token, username: user.username, role: user.role });
  } catch(e){
    console.error(e);
    res.status(500).json({ success:false, message: "server error" });
  }
});

// Admin login by key (returns admin token)
app.post("/api/admin/login", (req, res) => {
  const { adminKey } = req.body;
  if (adminKey !== ADMIN_KEY) return res.status(401).json({ success:false, message: "invalid admin key" });
  const token = jwt.sign({ role: "admin", username: "admin" }, JWT_SECRET, { expiresIn: "7d" });
  res.json({ success:true, token, username: "admin", role: "admin" });
});

// Upload level: expects multipart form-data: fields: title, description; files: jsonFile (1), images (0..3)
// limit total payload to 3MB -> check sum of files sizes before uploading to cloudinary
app.post("/api/upload", requireAuth, upload.fields([{ name: "jsonFile", maxCount: 1 }, { name: "images", maxCount: 3 }]), async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title) return res.status(400).json({ success:false, message: "title required" });
    if (!req.files || !req.files["jsonFile"] || req.files["jsonFile"].length === 0) return res.status(400).json({ success:false, message: "json file required" });

    // size check total (all files)
    const files = [];
    files.push(...(req.files["jsonFile"]||[]));
    files.push(...(req.files["images"]||[]));
    const totalSize = files.reduce((s, f) => s + (f.size || 0), 0);
    const MAX = 3 * 1024 * 1024; // 3 MB
    if (totalSize > MAX) return res.status(400).json({ success:false, message: `Total upload size must be <= ${MAX} bytes (3MB)` });

    const creator = req.user.username;
    const creatorId = req.user.id;

    // Upload JSON as raw
    const jsonBuf = req.files["jsonFile"][0].buffer;
    const jsonUpload = await new Promise((resolve, reject) => {
      const upload_stream = cloudinary.v2.uploader.upload_stream({ resource_type: "raw", folder: `bect/levels/${creator}` }, (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
      streamifier.createReadStream(jsonBuf).pipe(upload_stream);
    });

    // Images upload
    const imageFiles = req.files["images"] || [];
    const image_urls = [];
    const image_public_ids = [];
    for (const f of imageFiles) {
      const imgRes = await new Promise((resolve, reject) => {
        const up = cloudinary.v2.uploader.upload_stream({ folder: `bect/levels/${creator}/images` }, (err, result) => {
          if (err) return reject(err);
          resolve(result);
        });
        streamifier.createReadStream(f.buffer).pipe(up);
      });
      image_urls.push(imgRes.secure_url);
      image_public_ids.push(imgRes.public_id);
    }

    // Save level
    const level = new Level({
      title,
      description,
      creator,
      creatorId: String(creatorId),
      images: image_urls,
      json_url: jsonUpload.secure_url,
      json_public_id: jsonUpload.public_id,
      image_public_ids
    });
    await level.save();

    res.json({ success:true, level });
  } catch (e) {
    console.error("upload error", e);
    res.status(500).json({ success:false, message: "upload failed" });
  }
});

// List levels (optional query: q, creator)
app.get("/api/levels", async (req, res) => {
  try {
    const { q, creator } = req.query;
    let filter = {};
    if (creator) filter.creator = creator;
    if (q) filter.$or = [{ title: new RegExp(q, "i") }, { creator: new RegExp(q, "i") }];
    const list = await Level.find(filter).sort({ createdAt: -1 });
    res.json({ success:true, levels: list });
  } catch(e){ console.error(e); res.status(500).json({ success:false, message: "server error" }); }
});

// Get one level
app.get("/api/levels/:id", async (req, res) => {
  try {
    const lvl = await Level.findById(req.params.id);
    if (!lvl) return res.status(404).json({ success:false, message: "not found" });
    res.json({ success:true, level: lvl });
  } catch(e){ console.error(e); res.status(500).json({ success:false, message: "server error" }); }
});

// Download JSON URL (returns the json_url)
app.get("/api/levels/:id/download", async (req, res) => {
  try {
    const lvl = await Level.findById(req.params.id);
    if (!lvl) return res.status(404).json({ success:false, message: "not found" });
    // redirect to Cloudinary raw URL so browser downloads
    return res.json({ success:true, url: lvl.json_url });
  } catch(e){ console.error(e); res.status(500).json({ success:false, message: "server error" }); }
});

// Get user page (their levels)
app.get("/api/users/:username/levels", async (req, res) => {
  try {
    const list = await Level.find({ creator: req.params.username }).sort({ createdAt: -1 });
    res.json({ success:true, levels: list });
  } catch(e){ console.error(e); res.status(500).json({ success:false, message: "server error" }); }
});

// Delete level (owner or admin)
app.delete("/api/levels/:id", requireAuth, async (req, res) => {
  try {
    const lvl = await Level.findById(req.params.id);
    if (!lvl) return res.status(404).json({ success:false, message: "not found" });
    const isOwner = req.user && req.user.username === lvl.creator;
    const isAdmin = req.user && req.user.role === "admin";
    if (!isOwner && !isAdmin) return res.status(403).json({ success:false, message: "forbidden" });

    // delete cloudinary resources (raw + images)
    const toDelete = [];
    if (lvl.json_public_id) toDelete.push(lvl.json_public_id);
    if (lvl.image_public_ids && lvl.image_public_ids.length) toDelete.push(...lvl.image_public_ids);

    if (toDelete.length) {
      // raw resource_type for json
      // cloudinary.v2.api.delete_resources([...], {resource_type: 'raw'}) - but mixing types complicated.
      // We'll attempt to delete images (resource_type default 'image') and json separately.
      try {
        if (lvl.json_public_id) await cloudinary.v2.uploader.destroy(lvl.json_public_id, { resource_type: 'raw' });
      } catch(e){ console.warn("delete raw failed", e); }
      if (lvl.image_public_ids && lvl.image_public_ids.length) {
        for (const pid of lvl.image_public_ids) {
          try { await cloudinary.v2.uploader.destroy(pid); } catch(e){ console.warn("delete image failed", e); }
        }
      }
    }

    await lvl.remove();
    res.json({ success:true });
  } catch(e){ console.error(e); res.status(500).json({ success:false, message: "server error" }); }
});

// Delete user (admin only)
app.delete("/api/users/:username", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "admin") return res.status(403).json({ success:false, message: "forbidden" });
    const username = req.params.username;
    // delete user's levels and their cloudinary files
    const levels = await Level.find({ creator: username });
    for (const lvl of levels) {
      if (lvl.json_public_id) {
        try { await cloudinary.v2.uploader.destroy(lvl.json_public_id, { resource_type: 'raw' }); } catch(e){ }
      }
      if (lvl.image_public_ids && lvl.image_public_ids.length) {
        for (const pid of lvl.image_public_ids) {
          try { await cloudinary.v2.uploader.destroy(pid); } catch(e){ }
        }
      }
      await lvl.remove();
    }
    // delete user
    await User.deleteOne({ username });
    res.json({ success:true });
  } catch(e){ console.error(e); res.status(500).json({ success:false, message: "server error" }); }
});

// Serve frontend static files if present (assumes frontend at ../frontend)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "../frontend")));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "../frontend/index.html")));

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log(`Server running on port ${PORT}`));
