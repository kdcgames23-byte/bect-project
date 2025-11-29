// =======================================================
// server.js VERSION FINALE CORRIGÉE (avec express.Router)
// =======================================================

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import cloudinary from "cloudinary";
import multer from "multer";
import path from "path";
import { fileURLToPath } from 'url';

dotenv.config();

// Configuration pour gérer les chemins de fichiers (fix pour modules ES6)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const apiRouter = express.Router(); // 🚩 NOUVEAU: ROUTEUR DÉDIÉ POUR TOUTES LES ROUTES API

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// 1. CONFIGURATION CLOUDINARY
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 2. MONGODB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connecté"))
  .catch(err => console.error("❌ Erreur Mongo:", err));

// 3. SCHEMAS
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,
  role: { type: String, default: "user" },
});

const levelSchema = new mongoose.Schema({
  creator: String,
  title: String,
  description: String,
  images: [String],
  jsonUrl: String,
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model("User", userSchema);
const Level = mongoose.model("Level", levelSchema);

// 4. MIDDLEWARE AUTH
function auth(req, res, next){
  const token = req.headers.authorization?.split(" ")[1];
  
  // Log de débogage pour voir si le token arrive pour les routes protégées
  console.log(`[AUTH] Checking path: ${req.path}. Token present: ${!!token}`); 

  if (!token) return res.status(401).json({ success:false, message:"Token manquant" });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (e) {
    console.error(`[AUTH] Token verification failed: ${e.message}`);
    return res.status(401).json({ success:false, message:"Token invalide" });
  }
}

// 5. UPLOAD & NETTOYAGE
const storage = multer.memoryStorage();
const upload = multer({ storage });

function uploadToCloudinary(buffer, resourceType = "auto"){
  return new Promise((resolve, reject) => {
    cloudinary.v2.uploader.upload_stream(
      { resource_type: resourceType },
      (err, result) => {
        if (err) return reject(err);
        resolve(result.secure_url);
      }
    ).end(buffer);
  });
}

async function deleteCloudinaryFiles(level) {
  try {
    if(level.images) {
      for (const imgUrl of level.images) {
        const publicId = imgUrl.split("/").pop().split(".")[0];
        await cloudinary.v2.uploader.destroy(publicId);
      }
    }
    if(level.jsonUrl) {
      const publicId = level.jsonUrl.split("/").pop().split(".")[0];
      await cloudinary.v2.uploader.destroy(publicId, { resource_type: "raw" });
    }
  } catch (e) { console.error("Erreur nettoyage:", e); }
}

// =======================================================
// 6. DÉFINITION DES ROUTES SUR LE ROUTEUR (SANS LE /api)
// =======================================================

// --- AUTH ---
apiRouter.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (await User.findOne({ username })) return res.json({ success:false, message:"Pseudo pris" });
    const hashed = await bcrypt.hash(password, 10);
    await new User({ username, password:hashed }).save();
    res.json({ success:true, message: "Compte créé" });
  } catch(e) { res.status(500).json({ success:false, error: e.message }); }
});

apiRouter.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.json({ success:false, message:"Erreur identifiants" });
    }
    const token = jwt.sign(
      { id: user._id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );
    res.json({ success:true, token, username: user.username, role: user.role });
  } catch(e) { res.status(500).json({ success:false }); }
});

// ROUTE ADMIN KEY
apiRouter.post("/become-admin", auth, async (req, res) => {
  const { key } = req.body;
  // Utilisation de la variable d'environnement ADMIN_KEY
  const ADMIN_KEY = process.env.ADMIN_KEY; 

  if (key !== ADMIN_KEY) return res.status(403).json({ success: false, message: "Clé incorrecte" });

  const user = await User.findOneAndUpdate(
    { username: req.user.username },
    { role: "admin" },
    { new: true }
  );

  const newToken = jwt.sign(
    { id: user._id, username: user.username, role: "admin" },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  );

  res.json({ success: true, token: newToken, role: "admin" });
});

// --- NIVEAUX ---
apiRouter.post("/publish", auth, upload.fields([
  { name:"jsonFile", maxCount:1 },
  { name:"image1", maxCount:1 },
  { name:"image2", maxCount:1 },
  { name:"image3", maxCount:1 }
]), async (req, res) => {
  try {
    const { title, description } = req.body;
    const jsonUrl = await uploadToCloudinary(req.files["jsonFile"][0].buffer, "raw");
    const images = [];
    if(req.files["image1"]) images.push(await uploadToCloudinary(req.files["image1"][0].buffer));
    if(req.files["image2"]) images.push(await uploadToCloudinary(req.files["image2"][0].buffer));
    if(req.files["image3"]) images.push(await uploadToCloudinary(req.files["image3"][0].buffer));

    const lvl = await new Level({
      creator: req.user.username,
      title, description, images, jsonUrl
    }).save();
    res.json({ success:true, id: lvl._id });
  } catch (e) { res.status(500).json({ success:false }); }
});

// GET LEVELS (AVEC FILTRE STRICT)
apiRouter.get("/levels", async (req, res) => {
  try {
    const filter = {};
    if (req.query.creator) {
      filter.creator = req.query.creator;
    }
    
    const levels = await Level.find(filter).sort({ createdAt:-1 });
    res.json({ success:true, levels });
  } catch (e) {
    res.status(500).json({ success:false, message: "Erreur serveur" });
  }
});

apiRouter.get("/levels/:id", async (req, res) => {
  try {
    const level = await Level.findById(req.params.id);
    if(!level) return res.status(404).json({ success:false });
    res.json({ success:true, level });
  } catch { res.status(404).json({ success:false }); }
});

apiRouter.delete("/levels/:id", auth, async (req, res) => {
  try {
    const level = await Level.findById(req.params.id);
    if (!level) return res.status(404).json({ success:false, message: "Niveau introuvable" });
    
    // Vérification : doit être le créateur OU un admin
    if (level.creator !== req.user.username && req.user.role !== "admin") {
      return res.status(403).json({ success:false, message:"Interdit" });
    }

    await deleteCloudinaryFiles(level);
    await Level.deleteOne({ _id: level._id });
    res.json({ success:true, message: "Suppression réussie" });
  } catch(e) { res.status(500).json({ success:false, message: "Erreur interne" }); }
});

apiRouter.get("/search", async (req, res) => {
  const q = req.query.query;
  if (!q) return res.json([]);
  const results = await Level.find({
    $or:[ { title:{ $regex:q, $options:"i" }}, { creator:{ $regex:q, $options:"i" }} ]
  }).limit(20);
  res.json(results);
});

// --- ADMIN ROUTES ---
apiRouter.get("/admin/users", auth, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ success:false });
  const users = await User.find({}, "username role");
  res.json({ success:true, users });
});

apiRouter.get("/admin/levels", auth, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ success:false });
  const levels = await Level.find({});
  res.json({ success:true, levels });
});

apiRouter.delete("/admin/users/:username", auth, async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ success:false });
  const target = req.params.username;
  const levels = await Level.find({ creator: target });
  for (const lvl of levels) await deleteCloudinaryFiles(lvl);
  await Level.deleteMany({ creator: target });
  await User.deleteOne({ username: target });
  res.json({ success:true });
});

// =======================================================
// 7. ENREGISTREMENT DU ROUTEUR ET FICHIERS STATIQUES
// =======================================================

// 🚩 7A. ENREGISTREMENT DU ROUTEUR API (AVANT TOUT FICHIER STATIQUE)
app.use("/api", apiRouter);

// 7B. FICHIERS STATIQUES
app.use(express.static(__dirname));

// 7C. ROUTE CATCH-ALL (DERNIÈRE)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// START
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ SERVEUR LANCÉ SUR PORT ${PORT}`));