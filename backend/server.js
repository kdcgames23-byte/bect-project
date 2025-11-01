import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import cloudinary from "cloudinary";
import multer from "multer";
import streamifier from "streamifier";
import path from "path";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json({ limit: "6mb" }));
app.use(express.static("public")); // front-end

// === Cloudinary Config ===
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// === MongoDB ===
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("MongoDB connecté"))
.catch(err => console.error("Erreur MongoDB :", err));

// === Models ===
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

// === Middleware JWT ===
function auth(req, res, next){
  const token = req.headers.authorization?.split(" ")[1];
  if(!token) return res.status(401).json({success:false,message:"Token manquant"});
  try{
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  }catch(e){
    return res.status(401).json({success:false,message:"Token invalide"});
  }
}

// === Multer ===
const storage = multer.memoryStorage();
const upload = multer({ storage });

// === Routes front-end ===
app.get('/', (req,res)=> res.sendFile(path.join(process.cwd(),'public/index.html')));

// --- REGISTER ---
app.post('/api/register', async(req,res)=>{
  try{
    const {username,password} = req.body;
    if(!username||!password) return res.status(400).json({success:false,message:'Champs manquants'});
    const exists = await User.findOne({username});
    if(exists) return res.json({success:false,message:'Nom déjà utilisé'});
    const hashed = await bcrypt.hash(password,10);
    const user = new User({username,password:hashed});
    await user.save();
    res.json({success:true,message:'Inscription réussie'});
  }catch(e){
    console.error(e);
    res.status(500).json({success:false,message:'Erreur serveur'});
  }
});

// --- LOGIN ---
app.post('/api/login', async(req,res)=>{
  try{
    const {username,password} = req.body;
    const user = await User.findOne({username});
    if(!user) return res.json({success:false,message:'Utilisateur introuvable'});
    const valid = await bcrypt.compare(password,user.password);
    if(!valid) return res.json({success:false,message:'Mot de passe incorrect'});
    const token = jwt.sign({id:user._id,role:user.role,username:user.username},process.env.JWT_SECRET,{expiresIn:'30d'});
    res.json({success:true,token,username:user.username,role:user.role});
  }catch(e){
    console.error(e);
    res.status(500).json({success:false,message:'Erreur serveur'});
  }
});

// === Upload Cloudinary ===
function uploadBufferToCloudinary(buffer,filename,resource_type='auto'){
  return new Promise((resolve,reject)=>{
    const uploadStream = cloudinary.v2.uploader.upload_stream({resource_type,public_id:`bect/${Date.now()}_${filename}`},(error,result)=>{
      if(error) return reject(error);
      resolve(result.secure_url);
    });
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}

// --- PUBLISH LEVEL ---
app.post('/api/publish', auth, upload.fields([
  {name:'jsonFile', maxCount:1},
  {name:'image1', maxCount:1},
  {name:'image2', maxCount:1},
  {name:'image3', maxCount:1}
]), async(req,res)=>{
  try{
    const {title,description} = req.body;
    if(!title||!req.files||!req.files['jsonFile']) return res.status(400).json({success:false,message:'Champs obligatoires manquants'});

    const jsonUrl = await uploadBufferToCloudinary(req.files['jsonFile'][0].buffer,'level_json','raw');

    const images=[];
    for(let key of ['image1','image2','image3']){
      if(req.files[key]){
        const url = await uploadBufferToCloudinary(req.files[key][0].buffer,key,'image');
        images.push(url);
      }
    }

    const level = new Level({creator:req.user.username,title,description,images,jsonUrl});
    await level.save();
    res.json({success:true,levelId:level._id});
  }catch(e){
    console.error('Publish error',e);
    res.status(500).json({success:false,message:'Erreur lors de la publication'});
  }
});

// --- GET LEVELS ---
app.get('/api/levels', async(req,res)=>{
  try{
    const levels = await Level.find({}).sort({createdAt:-1});
    res.json({success:true,levels});
  }catch(e){
    res.status(500).json({success:false,message:'Erreur serveur'});
  }
});

// --- SEARCH ---
app.get('/api/search', async(req,res)=>{
  try{
    const query = req.query.query;
    if(!query) return res.json([]);
    const results = await Level.find({
      $or:[
        {title:{$regex:query,$options:"i"}},
        {creator:{$regex:query,$options:"i"}}
      ]
    }).limit(50);
    res.json(results);
  }catch(e){
    res.status(500).json({success:false,message:'Erreur serveur'});
  }
});

// --- Lancer serveur ---
const PORT = process.env.PORT || 3000;
app.listen(PORT,()=>console.log(`✅ Serveur en ligne sur port ${PORT}`));
