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
app.use(express.json());

// === Cloudinary Config ===
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// === MongoDB ===
mongoose.connect(process.env.MONGO_URI || "mongodb+srv://YOUR_URL_HERE", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// === Models ===
const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
  role: { type: String, default: "user" },
});

const User = mongoose.model("User", userSchema);

// === Routes ===

// TEST ROUTE
app.get("/", (req, res) => res.send("🚀 BECT API en ligne via Render"));

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

  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET);
  res.json({ success: true, token, username: user.username, role: user.role });
});

// CLOUDINARY UPLOAD
app.post("/api/upload", async (req, res) => {
  try {
    const { image } = req.body;
    const upload = await cloudinary.v2.uploader.upload(image);
    res.json({ success: true, url: upload.secure_url });
  } catch {
    res.json({ success: false, message: "Échec du téléversement" });
  }
});

// === Lancer le serveur ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Serveur en ligne sur le port ${PORT}`));
