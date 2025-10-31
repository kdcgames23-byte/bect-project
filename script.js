// LOGIN
document.getElementById("loginBtn")?.addEventListener("click", async () => {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  if(data.success){
    localStorage.setItem("token", data.token);
    localStorage.setItem("username", data.username);
    window.location.href = "index.html";
  } else alert(data.message);
});

// REGISTER
document.getElementById("registerBtn")?.addEventListener("click", async () => {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  const res = await fetch("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  if(data.success) {
    alert("Inscription réussie");
    window.location.href = "connexion.html";
  } else alert(data.message);
});

// LOGOUT
document.getElementById("logoutBtn")?.addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "connexion.html";
});

// Affiche nom utilisateur
const userDisplay = document.getElementById("userDisplay");
if(userDisplay){
  const username = localStorage.getItem("username");
  if(username) userDisplay.textContent = username;
}

// Publier niveau
document.getElementById("publishBtn")?.addEventListener("click", async () => {
  const fileInput = document.getElementById("levelFile");
  const file = fileInput.files[0];
  if(!file) return alert("Sélectionnez un fichier !");
  if(file.size > 3*1024*1024) return alert("Limite 3 Mo !");

  const reader = new FileReader();
  reader.onload = async () => {
    const res = await fetch("/api/upload", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ image: reader.result })
    });
    const data = await res.json();
    if(data.success){
      const title = document.getElementById("title").value;
      const description = document.getElementById("description").value;
      const jsonUrl = document.getElementById("jsonFile").value;
      await fetch("/api/level", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          creator: localStorage.getItem("username"),
          title, description,
          images:[data.url],
          jsonUrl
        })
      });
      alert("Niveau publié !");
      window.location.href="index.html";
    } else alert("Erreur upload");
  };
  reader.readAsDataURL(file);
});
