const users = JSON.parse(localStorage.getItem('users')) || [];

const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginMessage = document.getElementById('login-message');

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const user = loginUser.value.trim();
    const pass = loginPass.value;
    const found = users.find(u => u.user === user && u.pass === pass);
    if(found){
        localStorage.setItem('currentUser', user);
        window.location.href = 'index.html';
    } else {
        loginMessage.textContent = 'Credenciales inválidas';
    }
});

registerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const user = registerUser.value.trim();
    const pass = registerPass.value;
    if(users.find(u => u.user === user)){
        loginMessage.textContent = 'Usuario existente';
        return;
    }
    users.push({user, pass});
    localStorage.setItem('users', JSON.stringify(users));
    loginMessage.textContent = 'Registrado correctamente. Inicia sesión.';
    registerForm.reset();
});
