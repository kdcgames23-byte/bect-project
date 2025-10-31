const API_URL = "https://bect-backend.onrender.com"; // à changer après Render déploiement

// --- Register ---
const registerForm = document.getElementById("registerForm");
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("username").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    const res = await fetch(`${API_URL}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    });

    const data = await res.json();
    alert(data.message);
    if (data.success) window.location = "login.html";
  });
}

// --- Login ---
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    const res = await fetch(`${API_URL}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (data.success) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("username", data.username);
      localStorage.setItem("role", data.role);
      if (data.role === "admin") window.location = "admin.html";
      else window.location = "user.html";
    } else {
      alert(data.message);
    }
  });
}

// --- User / Admin ---
const logout = document.getElementById("logout");
if (logout) {
  logout.addEventListener("click", () => {
    localStorage.clear();
    window.location = "login.html";
  });
}

const welcome = document.getElementById("welcome");
if (welcome) {
  welcome.innerText = `Bienvenue, ${localStorage.getItem("username")} !`;
}
