import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import cloudinary from "cloudinary";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json({ limit: "4mb" })); // limite upload 3 Mo

// === Cloudinary ===
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// === MongoDB ===
if (!process.env.MONGO_URI) {
  console.error("MONGO_URI non défini !");
  process.exit(1);
}

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("MongoDB connecté"))
.catch(err => console.error("Erreur MongoDB :", err));

// === Models ===
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  role: { type: String, default: "user" },
});

const levelSchema = new mongoose.Schema({
  title: String,
  description: String,
  images: [String],
  creator: String,
  date: { type: Date, default: Date.now }
});

const User = mongoose.model("User", userSchema);
const Level = mongoose.model("Level", levelSchema);

// === Middleware ===
const auth = (req, res, next) => {
  const token = req.headers["authorization"];
  if (!token) return res.status(401).json({ success: false, message: "Token manquant" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Token invalide" });
  }
};

// === Routes ===
// Test
app.get("/", (req, res) => res.send("🚀 BECT API en ligne via Render"));

// Register
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.json({ success: false, message: "Remplis tous les champs" });

  const exists = await User.findOne({ username });
  if (exists) return res.json({ success: false, message: "Nom déjà utilisé" });

  const hashed = await bcrypt.hash(password, 10);
  const user = new User({ username, password: hashed });
  await user.save();
  res.json({ success: true, message: "Inscription réussie" });
});

// Login
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.json({ success: false, message: "Utilisateur introuvable" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.json({ success: false, message: "Mot de passe incorrect" });

  const token = jwt.sign({ id: user._id, role: user.role, username: user.username }, process.env.JWT_SECRET);
  res.json({ success: true, token, username: user.username, role: user.role });
});

// Upload level
app.post("/api/upload", auth, async (req, res) => {
  try {
    const { title, description, images } = req.body;
    if (!title || !images || images.length === 0) return res.json({ success: false, message: "Données manquantes" });

    // upload images sur Cloudinary
    const uploadedImages = [];
    for (let img of images) {
      const upload = await cloudinary.v2.uploader.upload(img, { folder: "bect_levels" });
      uploadedImages.push(upload.secure_url);
    }

    const level = new Level({ title, description, images: uploadedImages, creator: req.user.username });
    await level.save();
    res.json({ success: true, level });
  } catch (e) {
    res.json({ success: false, message: "Erreur upload" });
  }
});

// Get all levels
app.get("/api/levels", async (req, res) => {
  const levels = await Level.find().sort({ date: -1 });
  res.json({ success: true, levels });
});

// Get user levels
app.get("/api/levels/:username", async (req, res) => {
  const levels = await Level.find({ creator: req.params.username }).sort({ date: -1 });
  res.json({ success: true, levels });
});

// Delete user (admin only)
app.delete("/api/user/:username", auth, async (req, res) => {
  if (req.user.role !== "admin" && req.headers["adminkey"] !== process.env.ADMIN_KEY) return res.status(403).json({ success: false });
  await User.deleteOne({ username: req.params.username });
  await Level.deleteMany({ creator: req.params.username });
  res.json({ success: true });
});

// Delete level (admin or creator)
app.delete("/api/level/:id", auth, async (req, res) => {
  const level = await Level.findById(req.params.id);
  if (!level) return res.status(404).json({ success: false });
  if (req.user.username !== level.creator && req.user.role !== "admin") return res.status(403).json({ success: false });
  await Level.deleteOne({ _id: req.params.id });
  res.json({ success: true });
});

// Serve
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Serveur en ligne sur le port ${PORT}`));
