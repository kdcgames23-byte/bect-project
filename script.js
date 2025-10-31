// Vérifier si connecté
const token = localStorage.getItem("token");
const username = localStorage.getItem("username");

// Redirection si non connecté
if (window.location.pathname !== "/connexion.html" && !token) {
  window.location.href = "connexion.html";
}

// Logout
document.getElementById("logout-btn")?.addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "connexion.html";
});

// Afficher nom utilisateur
if (username) document.getElementById("username-display")?.textContent = username;

// TODO: Ajouter fetch niveaux, upload, register, login, recherche, admin...
