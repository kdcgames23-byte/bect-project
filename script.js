const user = JSON.parse(localStorage.getItem('bect_user'));

// Gestion des boutons header
window.addEventListener('DOMContentLoaded', () => {
  const btnLogin = document.getElementById('btn-login');
  const btnRegister = document.getElementById('btn-register');
  const btnLogout = document.getElementById('btn-logout');
  const userInfo = document.getElementById('user-info');
  const usernameDisplay = document.getElementById('username-display');
  const btnPublish = document.getElementById('btn-publish');
  const btnAdmin = document.getElementById('btn-admin');

  if(user){
    btnLogin.style.display = 'none';
    btnRegister.style.display = 'none';
    userInfo.style.display = 'inline';
    usernameDisplay.textContent = user.username;
    if(user.role === 'admin') btnAdmin.style.display = 'inline';
    btnPublish.style.display = 'inline';
  }

  btnLogout?.addEventListener('click', () => {
    localStorage.removeItem('bect_user');
    window.location.reload();
  });

  usernameDisplay?.addEventListener('click', () => {
    window.location.href = 'utilisateur.html';
  });
});

// Recherche
document.getElementById('btn-search')?.addEventListener('click', async () => {
  const query = document.getElementById('search-input').value.trim();
  if(!query) return;
  try{
    const res = await fetch(`https://bect-project.onrender.com/api/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    const container = document.getElementById('search-results');
    container.innerHTML = '';
    data.results.forEach(item => {
      const div = document.createElement('div');
      div.classList.add('search-item');
      div.innerHTML = `
        <h3>${item.title || item.username}</h3>
        <p>${item.description || ''}</p>
        ${item.jsonUrl ? `<a href="${item.jsonUrl}" download>Télécharger JSON</a>` : ''}
      `;
      container.appendChild(div);
    });
  } catch(err){ console.error(err); alert('Erreur serveur'); }
});
