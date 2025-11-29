// =======================
// script.js COMPLET (Version Finale)
// =======================

// L'URL de base de votre API Render
export const API_URL = "https://bect-project.onrender.com/api"; 
export let user = JSON.parse(localStorage.getItem("bect_user"));


// DOM Elements
const btnLogin = document.getElementById("btn-login");
const btnRegister = document.getElementById("btn-register");
const btnLogout = document.getElementById("btn-logout");
const btnPublish = document.getElementById("btn-publish");
const btnAdmin = document.getElementById("btn-admin");
const usernameDisplay = document.getElementById("username-display");
const userInfo = document.getElementById("user-info");

// --- UPDATE HEADER ---
export function updateHeader(){
  user = JSON.parse(localStorage.getItem("bect_user"));
  
  if (user){
    // Connecté
    if(btnLogin) btnLogin.style.display = "none";
    if(btnRegister) btnRegister.style.display = "none";
    if(btnPublish) btnPublish.style.display = "inline";
    if(userInfo) userInfo.style.display = "inline-flex";
    if(usernameDisplay) {
      usernameDisplay.textContent = user.username;
      // Clic sur le nom -> Profil
      usernameDisplay.onclick = () => window.location.href = `utilisateur.html?username=${user.username}`;
    }

    // Afficher bouton Admin SI l'user est admin
    if(btnAdmin) {
      if(user.role === "admin") {
        btnAdmin.style.display = "inline";
        btnAdmin.textContent = "Admin Panel";
        // Si déjà admin, clic = aller au panel
        btnAdmin.onclick = () => window.location.href = "admin.html";
      } else {
        // Sinon bouton pour DEVENIR admin (visible uniquement si l'utilisateur est connecté)
        btnAdmin.style.display = "inline";
        btnAdmin.textContent = "Activer Admin";
        btnAdmin.onclick = activateAdminMode;
      }
    }

  } else {
    // Déconnecté
    if(btnLogin) btnLogin.style.display = "inline";
    if(btnRegister) btnRegister.style.display = "inline";
    if(btnPublish) btnPublish.style.display = "none";
    if(btnAdmin) btnAdmin.style.display = "none";
    if(userInfo) userInfo.style.display = "none";
  }
}

// --- FONCTION ACTIVATION ADMIN (appel API pour mettre à jour le rôle) ---
async function activateAdminMode() {
  if (!user || !user.token) {
    alert("Vous devez être connecté pour activer le mode Admin.");
    return;
  }

  const key = prompt("Entrez la clé ADMIN :");
  if (!key) return;

  try {
    const res = await fetch(`${API_URL}/become-admin`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${user.token}` // Envoie le token actuel
      },
      body: JSON.stringify({ key })
    });

    // Vérification pour éviter l'erreur "Unexpected token <" (si le serveur renvoie du HTML)
    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("json")) {
        throw new Error(`Erreur serveur (${res.status} ${res.statusText}). Le serveur n'a pas renvoyé de JSON.`);
    }

    const data = await res.json();

    if (data.success) {
      alert("✅ Mode Admin activé !");
      // Mettre à jour le localStorage avec le NOUVEAU rôle et token
      user.role = "admin";
      user.token = data.token;
      localStorage.setItem("bect_user", JSON.stringify(user));
      window.location.href = "admin.html"; // Redirection vers le panel
    } else {
      alert("❌ " + (data.message || "Erreur de validation de la clé."));
    }
  } catch(e) {
    console.error("Erreur dans activateAdminMode:", e);
    alert(`Erreur de connexion serveur : ${e.message}`);
  }
}

// --- LOGOUT ---
if(btnLogout){
  btnLogout.addEventListener("click", ()=>{
    localStorage.removeItem("bect_user");
    window.location.href = "index.html";
  });
}

// --- REDIRECTIONS BASIQUES ---
if(btnLogin) btnLogin.onclick = () => window.location.href="connexion.html";
if(btnRegister) btnRegister.onclick = () => window.location.href="inscription.html";
if(btnPublish) btnPublish.onclick = () => window.location.href="publier.html";

// Initialisation
document.addEventListener("DOMContentLoaded", updateHeader);