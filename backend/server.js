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
  creator: String,
  title: String,
  description: String,
  images: [String],
  jsonUrl: String,
});

const User = mongoose.model("User", userSchema);
const Level = mongoose.model("Level", levelSchema);

// === Routes ===
app.get("/", (req, res) => res.send("🚀 BECT API en ligne"));

// REGISTER
app.post("/api/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    const exists = await User.findOne({ username });
    if (exists) return res.json({ success: false, message: "Nom déjà utilisé" });

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

// CLOUDINARY UPLOAD
app.post("/api/upload", async (req, res) => {
  try {
    const { image } = req.body;
    const upload = await cloudinary.v2.uploader.upload(image, { resource_type: "auto" });
    res.json({ success: true, url: upload.secure_url });
  } catch {
    res.json({ success: false, message: "Échec du téléversement" });
  }
});

// PUBLISH LEVEL
app.post("/api/level", async (req, res) => {
  try {
    const { creator, title, description, images, jsonUrl } = req.body;
    const level = new Level({ creator, title, description, images, jsonUrl });
    await level.save();
    res.json({ success: true });
  } catch {
    res.json({ success: false, message: "Erreur lors de la publication" });
  }
});

// GET LEVELS
app.get("/api/levels", async (req, res) => {
  const levels = await Level.find({});
  res.json(levels);
});

// GET USER LEVELS
app.get("/api/user/:username", async (req, res) => {
  const levels = await Level.find({ creator: req.params.username });
  res.json(levels);
});

// ADMIN DELETE USER
app.delete("/api/admin/user/:username", async (req, res) => {
  if (req.headers.admin_key !== process.env.ADMIN_KEY)
    return res.status(403).json({ success: false, message: "Clé admin invalide" });
  await User.deleteOne({ username: req.params.username });
  await Level.deleteMany({ creator: req.params.username });
  res.json({ success: true });
});

// === Start server ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Serveur en ligne sur le port ${PORT}`));
