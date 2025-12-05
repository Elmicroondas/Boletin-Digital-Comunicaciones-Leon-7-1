const API_BASE_URL = 'http://localhost:3000';

document.addEventListener("DOMContentLoaded", () => {
  const showRegisterBtn = document.getElementById("showRegisterBtn");
  const registerCard = document.getElementById("registerCard");
  const cancelRegisterBtn = document.getElementById("cancelRegisterBtn");

  const cursoGroup = document.getElementById("cursoGroup");
  const regCurso = document.getElementById("regCurso");

  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");

  const loginError = document.getElementById("loginError");
  const registerError = document.getElementById("registerError");
  const registerSuccess = document.getElementById("registerSuccess");

  let cursosCache = [];

  // Estado inicial del selector de curso
  if (cursoGroup) cursoGroup.hidden = true;
  if (regCurso) {
    regCurso.disabled = true;
    if (!regCurso.innerHTML.trim()) {
      regCurso.innerHTML = '<option value="">Seleccionar curso</option>';
    }
  }

  // Mostrar tarjeta de registro (solo alumnos) y cargar cursos
  if (showRegisterBtn && registerCard) {
    showRegisterBtn.addEventListener("click", async () => {
      registerCard.hidden = false;
      registerCard.scrollIntoView({ behavior: "smooth" });

      // Registro público: siempre alumno → siempre mostrar curso
      if (cursoGroup) cursoGroup.hidden = false;
      if (regCurso) {
        regCurso.disabled = false;

        // Cargar cursos una sola vez
        if (cursosCache.length === 0) {
          await cargarCursosEnSelectRegistro();
        }
      }
    });
  }

  // Cancelar registro
  if (cancelRegisterBtn && registerCard) {
    cancelRegisterBtn.addEventListener("click", () => {
      registerCard.hidden = true;

      if (registerForm) registerForm.reset();

      if (cursoGroup) cursoGroup.hidden = true;
      if (regCurso) {
        regCurso.disabled = true;
        regCurso.value = "";
      }

      if (registerError) registerError.textContent = "";
      if (registerSuccess) registerSuccess.textContent = "";
    });
  }

  // ======================
  //   LOGIN -> /api/login
  // ======================
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (loginError) loginError.textContent = "";

      const usuario = loginForm.usuario.value.trim();
      const password = loginForm.password.value.trim();

      if (!usuario || !password) {
        if (loginError) loginError.textContent = "Completá usuario y contraseña.";
        return;
      }

      try {
        const resp = await fetch(`${API_BASE_URL}/api/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ usuario, password })
        });

        const data = await resp.json();

        if (!resp.ok || !data.ok) {
          if (loginError) {
            loginError.textContent = data.message || "Error al iniciar sesión.";
          }
          return;
        }

        // Guardar usuario actual (para otras páginas)
        localStorage.setItem(
          "usuarioActual",
          JSON.stringify({
            idUsuario: data.idUsuario,
            rol: data.rol
          })
        );

        // Redirección según rol
        if (data.rol === 'admin') {
          window.location.href = 'admin.html';
        } else if (data.rol === 'alumnado') {
          window.location.href = 'alumnado.html';
        } else if (data.rol === 'alumno') {
          window.location.href = 'alumno.html';
        } else {
          if (loginError) {
            loginError.textContent = 'Rol no reconocido. Consulte con el administrador.';
          }
        }
      } catch (err) {
        console.error(err);
        if (loginError) {
          loginError.textContent = "No se pudo conectar con el servidor.";
        }
      }
    });
  }

  // ======================================
  //   REGISTRO PÚBLICO DE ALUMNOS
  //   -> /api/register-alumno
  // ======================================
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (registerError) registerError.textContent = "";
      if (registerSuccess) registerSuccess.textContent = "";

      const formData = new FormData(registerForm);
      const rawData = Object.fromEntries(formData.entries());

      // Hacemos trim a los campos de texto
      const data = {
        usuario: (rawData.usuario || "").trim(),
        password: (rawData.password || "").trim(),
        dni: (rawData.dni || "").trim(),
        email: (rawData.email || "").trim(),
        nombreCompleto: (rawData.nombreCompleto || "").trim(),
        curso: (rawData.curso || "").trim()
      };

      // Validaciones básicas
      if (!data.usuario || !data.password || !data.dni || !data.email || !data.nombreCompleto) {
        if (registerError) {
          registerError.textContent = "Completá todos los campos obligatorios.";
        }
        return;
      }

      // Curso obligatorio
      if (!data.curso) {
        if (registerError) {
          registerError.textContent = "El curso es obligatorio.";
        }
        return;
      }

      // El rol no se envía desde el formulario público; el backend lo fuerza a 'alumno'
      // (por las dudas, nos aseguramos de no mandar nada raro)
      delete rawData.rol;

      try {
        const resp = await fetch(`${API_BASE_URL}/api/register-alumno`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data)
        });

        const result = await resp.json();

        if (!resp.ok || !result.ok) {
          if (registerError) {
            registerError.textContent = result.message || "Error al registrar la cuenta.";
          }
          return;
        }

        if (registerSuccess) {
          registerSuccess.textContent = result.message || "Registro correcto.";
          registerSuccess.style.color = "#197c3a";
        }

        registerForm.reset();

        // Dejar el selector de curso oculto y deshabilitado de nuevo
        if (cursoGroup) cursoGroup.hidden = true;
        if (regCurso) {
          regCurso.disabled = true;
          regCurso.value = "";
        }
      } catch (err) {
        console.error(err);
        if (registerError) {
          registerError.textContent = "No se pudo conectar con el servidor.";
        }
      }
    });
  }

  // ======================
  //   FUNCIONES AUXILIARES
  // ======================

  async function cargarCursosEnSelectRegistro() {
    if (!regCurso) return;

    try {
      const resp = await fetch(`${API_BASE_URL}/api/cursos`);
      const data = await resp.json();

      if (!resp.ok || !data.ok) {
        console.error('Error al cargar cursos:', data.message);
        return;
      }

      cursosCache = data.data || [];

      regCurso.innerHTML = '<option value="">Seleccionar curso</option>';

      cursosCache.forEach((c) => {
        const opt = document.createElement('option');
        opt.value = c.nombre_curso;       // lo que se manda al backend
        opt.textContent = c.nombre_curso; // lo que se muestra
        regCurso.appendChild(opt);
      });
    } catch (err) {
      console.error('No se pudo conectar con /api/cursos:', err);
    }
  }
});
