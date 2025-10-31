const API = "https://bect-project.onrender.com/api";
let token = localStorage.getItem("token");
let username = localStorage.getItem("username");

// Rediriger si non connecté
function requireLogin() {
  if (!token) window.location.href = "connexion.html";
}

// Connexion
async function loginUser(usernameInput, password) {
  const res = await fetch(`${API}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: usernameInput, password }),
  });
  const data = await res.json();
  if (data.success) {
    localStorage.setItem("token", data.token);
    localStorage.setItem("username", data.username);
    window.location.href = "index.html";
  } else alert(data.message);
}

// Inscription
async function registerUser(usernameInput, password) {
  const res = await fetch(`${API}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: usernameInput, password }),
  });
  const data = await res.json();
  if (data.success) {
    alert("Inscription réussie !");
    window.location.href = "connexion.html";
  } else alert(data.message);
}

// Logout
function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("username");
  window.location.href = "connexion.html";
}

// Fetch all levels
async function fetchLevels() {
  const res = await fetch(`${API}/levels`);
  const data = await res.json();
  return data.success ? data.levels : [];
}

// Fetch user levels
async function fetchUserLevels(user) {
  const res = await fetch(`${API}/levels/${user}`);
  const data = await res.json();
  return data.success ? data.levels : [];
}

// Upload level
async function uploadLevel(title, description, images) {
  if (!token) return alert("Connecte-toi !");
  if (!title || !images.length) return alert("Remplis titre et images !");
  if (images.reduce((acc, i) => acc + i.size, 0) > 3e6) return alert("Trop lourd, max 3 Mo");

  // Convertir images en base64
  const imageBase64 = [];
  for (let file of images) {
    imageBase64.push(await toBase64(file));
  }

  const res = await fetch(`${API}/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": token },
    body: JSON.stringify({ title, description, images: imageBase64 }),
  });
  const data = await res.json();
  if (data.success) window.location.href = "index.html";
  else alert(data.message);
}

// Convertir fichier en base64
function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

// Télécharger JSON
function downloadJSON(level) {
  const blob = new Blob([JSON.stringify(level)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${level.title}.json`;
  link.click();
}
