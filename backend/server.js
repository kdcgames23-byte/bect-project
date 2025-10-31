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
app.use(express.json({ limit: "5mb" })); // limite pour les fichiers image/json

// === Cloudinary Config ===
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, // ex: dxhzgqzmy
  api_key: process.env.CLOUDINARY_API_KEY,       // ex: 646229348284982
  api_secret: process.env.CLOUDINARY_API_SECRET // ex: ZKM0QvmJ3pOdN1U-FMIbxX_bCcs
});

// === MongoDB ===
if (!process.env.MONGO_URI) {
  console.error("MONGO_URI non défini dans les variables d'environnement !");
  process.exit(1);
}

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("MongoDB connecté"))
.catch((err) => console.error("Erreur MongoDB :", err));

// === Models ===
const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  role: { type: String, default: "user" },
});

const levelSchema = new mongoose.Schema({
  title: String,
  creator: String,
  creatorId: String,
  description: String,
  rating: Number,
  image: String,
  jsonData: String,
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", userSchema);
const Level = mongoose.model("Level", levelSchema);

// === Routes ===

// TEST ROUTE
app.get("/", (req, res) => res.send("BECT API en ligne via Render"));

// REGISTER
app.post("/api/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashed });
    await user.save();
    res.json({ success: true, message: "Inscription réussie" });
  } catch (e) {
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

// LOGIN
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.json({ success: false, message: "Utilisateur introuvable" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.json({ success: false, message: "Mot de passe incorrect" });

  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
  res.json({ success: true, token, username: user.username, role: user.role });
});

// CLOUDINARY UPLOAD (image ou JSON)
app.post("/api/upload", async (req, res) => {
  try {
    const { file, type } = req.body; // file: base64, type: "image" ou "json"
    const uploadOptions = { resource_type: type === "json" ? "raw" : "image" };
    const upload = await cloudinary.v2.uploader.upload(file, uploadOptions);
    res.json({ success: true, url: upload.secure_url });
  } catch (e) {
    console.error(e);
    res.json({ success: false, message: "Échec du téléversement" });
  }
});

// CRÉER UN NIVEAU
app.post("/api/levels", async (req, res) => {
  try {
    const { title, creator, creatorId, description, rating, image, jsonData } = req.body;
    const level = new Level({ title, creator, creatorId, description, rating, image, jsonData });
    await level.save();
    res.json({ success: true, message: "Niveau créé", level });
  } catch (e) {
    console.error(e);
    res.json({ success: false, message: "Erreur serveur" });
  }
});

// LISTE DES NIVEAUX
app.get("/api/levels", async (req, res) => {
  try {
    const levels = await Level.find().sort({ createdAt: -1 });
    res.json({ success: true, levels });
  } catch (e) {
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

// === Lancer le serveur ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur en ligne sur le port ${PORT}`));
