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
app.use(express.json({ limit: "5mb" })); // JSON + images encodées base64

// --- Cloudinary Config ---
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// --- MongoDB ---
if (!process.env.MONGO_URI) {
  console.error("MONGO_URI non défini dans les variables d'environnement !");
  process.exit(1);
}

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB connecté"))
.catch((err) => console.error("❌ Erreur MongoDB :", err));

// --- Schemas ---
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,
  role: { type: String, default: "user" },
});

const levelSchema = new mongoose.Schema({
  title: String,
  desc: String,
  username: String,
  images: [String],
  jsonData: String,
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", userSchema);
const Level = mongoose.model("Level", levelSchema);

// --- Middleware auth ---
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Non autorisé" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: "Token invalide" });
  }
};

// --- Routes ---

// TEST ROUTE
app.get("/", (req, res) => res.send("🚀 BECT API en ligne via Render"));

// REGISTER
app.post("/api/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.json({ success: false, message: "Champs manquants" });

    const exist = await User.findOne({ username });
    if (exist) return res.json({ success: false, message: "Nom déjà utilisé" });

    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashed });
    await user.save();

    res.json({ success: true, message: "Inscription réussie" });
  } catch (e) {
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

// LOGIN
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.json({ success: false, message: "Utilisateur introuvable" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.json({ success: false, message: "Mot de passe incorrect" });

  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET);
  res.json({ success: true, token, username: user.username, role: user.role });
});

// UPLOAD LEVEL
app.post("/api/upload", auth, async (req, res) => {
  try {
    const { title, desc, images, jsonData } = req.body;

    // Limite 3Mo
    const totalSize = Buffer.byteLength(jsonData || "") + (images || []).reduce((a, b) => a + (b.length || 0), 0);
    if (totalSize > 3 * 1024 * 1024) return res.json({ success: false, message: "Taille max 3Mo" });

    const level = new Level({
      title,
      desc,
      username: req.user.role === "admin" ? "admin" : req.user.id,
      images,
      jsonData,
    });
    await level.save();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Erreur upload" });
  }
});

// GET ALL LEVELS
app.get("/api/levels", async (req, res) => {
  const levels = await Level.find().sort({ createdAt: -1 });
  res.json(levels);
});

// GET LEVELS BY USER
app.get("/api/levels/:username", async (req, res) => {
  const levels = await Level.find({ username: req.params.username }).sort({ createdAt: -1 });
  res.json(levels);
});

// --- ADMIN ROUTES ---
app.get("/api/admin/users", auth, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Accès refusé" });
  const users = await User.find();
  res.json(users);
});

app.delete("/api/admin/user/:id", auth, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ message: "Accès refusé" });
  await User.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

// --- Lancer serveur ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Serveur en ligne sur le port ${PORT}`));
