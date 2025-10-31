import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import bodyParser from "body-parser";
import cloudinary from "cloudinary";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Répertoire actuel
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cloudinary Configuration
cloudinary.v2.config({
  cloud_name: "dxhzgqzmy",
  api_key: "646229348284982",
  api_secret: "ZKM0QvmJ3pOdN1U-FMIbxX_bCcs",
});

// MongoDB Connection (Render ou local)
const MONGO_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://admin:admin@cluster0.mongodb.net/bectapp?retryWrites=true&w=majority";

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// User Schema
const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password: String,
});

const User = mongoose.model("User", userSchema);

// Auth Routes
app.post("/api/signup", async (req, res) => {
  const { username, email, password } = req.body;

  const existing = await User.findOne({ email });
  if (existing) return res.status(400).json({ message: "Email déjà utilisé" });

  const hashed = await bcrypt.hash(password, 10);
  const user = new User({ username, email, password: hashed });
  await user.save();

  res.json({ message: "Inscription réussie " });
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });

  if (!user) return res.status(400).json({ message: "Utilisateur introuvable" });

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(400).json({ message: "Mot de passe incorrect" });

  const token = jwt.sign({ id: user._id }, "secretkey", { expiresIn: "7d" });
  res.json({
    message: "Connexion réussie ",
    token,
    username: user.username,
  });
});

// Upload Route (Cloudinary)
app.post("/api/upload", async (req, res) => {
  try {
    const file = req.body.image; // URL base64 envoyée par le frontend
    const result = await cloudinary.v2.uploader.upload(file, {
      folder: "bect_uploads",
    });
    res.json({ url: result.secure_url });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur lors du chargement" });
  }
});

// Health Check
app.get("/healthz", (req, res) => res.send("OK"));

// Servir le frontend
app.use(express.static(path.join(__dirname, "../frontend")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// Start Server
app.listen(PORT, () => console.log(`🔥 Server running on port ${PORT}`));
