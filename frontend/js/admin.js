// frontend/js/admin.js
const API_BASE_URL = 'http://localhost:3000';

document.addEventListener('DOMContentLoaded', () => {
  // Filtros
  const filtroTexto = document.getElementById('filtroTexto');
  const filtroRol = document.getElementById('filtroRol');
  const filtroEstado = document.getElementById('filtroEstado');
  const btnAplicarFiltros = document.getElementById('btnAplicarFiltros');
  const btnLimpiarFiltros = document.getElementById('btnLimpiarFiltros');

  // Tabla
  const usuariosTableBody = document.getElementById('usuariosTableBody');
  const adminMessage = document.getElementById('adminMessage');

  // Alta de usuario (formulario nuevo)
  const btnMostrarCrearUsuario = document.getElementById('btnMostrarCrearUsuario');
  const crearUsuarioPanel = document.getElementById('crearUsuarioPanel');
  const crearUsuarioForm = document.getElementById('crearUsuarioForm');
  const btnCancelarCrearUsuario = document.getElementById('btnCancelarCrearUsuario');

  const nuevoRol = document.getElementById('nuevoRol');
  const nuevoCursoGroup = document.getElementById('nuevoCursoGroup');
  const nuevoCurso = document.getElementById('nuevoCurso');

  const crearUsuarioError = document.getElementById('crearUsuarioError');
  const crearUsuarioSuccess = document.getElementById('crearUsuarioSuccess');

  let usuarios = [];           // lista completa desde el servidor
  let usuariosFiltrados = [];  // lista filtrada
  let cursosDisponibles = [];  // cursos para selects

  // Estado inicial del panel de alta
  if (crearUsuarioPanel) crearUsuarioPanel.hidden = true;

  // Carga inicial de usuarios
  cargarUsuarios();

  // =========================
  //   BOTONES DE FILTRO
  // =========================
  if (btnAplicarFiltros) {
    btnAplicarFiltros.addEventListener('click', aplicarFiltros);
  }

  if (btnLimpiarFiltros) {
    btnLimpiarFiltros.addEventListener('click', () => {
      filtroTexto.value = '';
      filtroRol.value = '';
      filtroEstado.value = '';
      aplicarFiltros();
    });
  }

  // =========================
  //   FORMULARIO NUEVO USUARIO
  // =========================

  // Mostrar panel de creación
  if (btnMostrarCrearUsuario && crearUsuarioPanel) {
    btnMostrarCrearUsuario.addEventListener('click', async () => {
      if (crearUsuarioError) crearUsuarioError.textContent = '';
      if (crearUsuarioSuccess) crearUsuarioSuccess.textContent = '';

      crearUsuarioPanel.hidden = false;
      crearUsuarioPanel.scrollIntoView({ behavior: 'smooth' });

      // Cargar cursos para el select (una sola vez)
      await cargarCursosDisponibles();
      llenarSelectNuevoCurso();
    });
  }

  // Cancelar creación
  if (btnCancelarCrearUsuario && crearUsuarioPanel && crearUsuarioForm) {
    btnCancelarCrearUsuario.addEventListener('click', () => {
      crearUsuarioPanel.hidden = true;
      crearUsuarioForm.reset();
      if (crearUsuarioError) crearUsuarioError.textContent = '';
      if (crearUsuarioSuccess) crearUsuarioSuccess.textContent = '';
      if (nuevoCursoGroup) nuevoCursoGroup.hidden = false; // lo dejamos visible por defecto
    });
  }

  // Mostrar / ocultar curso según rol
  if (nuevoRol && nuevoCursoGroup && nuevoCurso) {
    nuevoRol.addEventListener('change', () => {
      const rol = nuevoRol.value;
      if (rol === 'alumno') {
        nuevoCursoGroup.hidden = false;
      } else {
        nuevoCursoGroup.hidden = true;
        nuevoCurso.value = '';
      }
    });
  }

  // Enviar formulario de creación de usuario -> /api/register
  if (crearUsuarioForm) {
    crearUsuarioForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (crearUsuarioError) crearUsuarioError.textContent = '';
      if (crearUsuarioSuccess) crearUsuarioSuccess.textContent = '';

      const formData = new FormData(crearUsuarioForm);
      const raw = Object.fromEntries(formData.entries());

      const data = {
        usuario: (raw.usuario || '').trim(),
        password: (raw.password || '').trim(),
        dni: (raw.dni || '').trim(),
        email: (raw.email || '').trim(),
        nombreCompleto: (raw.nombreCompleto || '').trim(),
        rol: (raw.rol || '').trim(),
        curso: (raw.curso || '').trim() || null,
        // Estado fijo para usuarios creados desde administración:
        estadoCuenta: 'aprobado'
      };

      // Validaciones básicas
      if (!data.usuario || !data.password || !data.dni || !data.email || !data.nombreCompleto || !data.rol) {
        if (crearUsuarioError) {
          crearUsuarioError.textContent = 'Completá todos los campos obligatorios.';
        }
        return;
      }

      if (data.password.length < 8) {
        if (crearUsuarioError) {
          crearUsuarioError.textContent = 'La contraseña debe tener al menos 8 caracteres.';
        }
        return;
      }

      // Si es alumno, curso obligatorio
      if (data.rol === 'alumno' && !data.curso) {
        if (crearUsuarioError) {
          crearUsuarioError.textContent = 'Para el rol Alumno el curso es obligatorio.';
        }
        return;
      }

      try {
        const resp = await fetch(`${API_BASE_URL}/api/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        const result = await resp.json();

        if (!resp.ok || !result.ok) {
          if (crearUsuarioError) {
            crearUsuarioError.textContent = result.message || 'Error al crear el usuario.';
          }
          return;
        }

        if (crearUsuarioSuccess) {
          crearUsuarioSuccess.textContent = result.message || 'Usuario creado correctamente.';
          crearUsuarioSuccess.style.color = '#197c3a';
        }

        crearUsuarioForm.reset();
        if (nuevoCursoGroup && nuevoRol) {
          // volvemos a mostrar el campo curso por defecto
          nuevoCursoGroup.hidden = (nuevoRol.value !== 'alumno');
        }

        // Recargar la tabla
        await cargarUsuarios();
      } catch (err) {
        console.error(err);
        if (crearUsuarioError) {
          crearUsuarioError.textContent = 'No se pudo conectar con el servidor.';
        }
      }
    });
  }

  // =========================
  //   ACCIONES EN LA TABLA
  // =========================
  if (usuariosTableBody) {
    usuariosTableBody.addEventListener('click', async (e) => {
      const target = e.target;
      const tr = target.closest('tr');
      if (!tr) return;
      const idUsuario = tr.dataset.id;

      // GUARDAR CAMBIOS
      if (target.classList.contains('btn-save')) {
        const nombreInput = tr.querySelector('.input-nombre');
        const emailInput = tr.querySelector('.input-email');
        const dniInput = tr.querySelector('.input-dni');
        const rolSelect = tr.querySelector('.select-rol');
        const cursoSelect = tr.querySelector('.select-curso');
        const estadoSelect = tr.querySelector('.select-estado');

        const payload = {
          nombreCompleto: nombreInput.value.trim(),
          email: emailInput.value.trim(),
          dni: dniInput.value.trim(),
          rol: rolSelect.value,
          curso: cursoSelect.value || null,
          estadoCuenta: estadoSelect.value
        };

        try {
          const resp = await fetch(`${API_BASE_URL}/api/usuarios/${idUsuario}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          const data = await resp.json();

          if (!resp.ok || !data.ok) {
            adminMessage.textContent = data.message || 'Error al actualizar usuario.';
            adminMessage.style.color = '#b12929';
            return;
          }

          adminMessage.textContent = 'Usuario actualizado correctamente.';
          adminMessage.style.color = '#197c3a';

          await cargarUsuarios();
        } catch (err) {
          console.error(err);
          adminMessage.textContent = 'No se pudo conectar con el servidor.';
          adminMessage.style.color = '#b12929';
        }
      }

      // CAMBIAR CONTRASEÑA
      if (target.classList.contains('btn-reset')) {
        const usuarioNombre = tr.querySelector('.col-usuario')?.textContent || '';

        const nuevaPass = window.prompt(
          `Ingresá la nueva contraseña para el usuario "${usuarioNombre}" (mínimo 8 caracteres):`
        );

        if (nuevaPass === null) return; // canceló

        const password = (nuevaPass || '').trim();

        if (!password) {
          adminMessage.textContent = 'La contraseña no puede estar vacía.';
          adminMessage.style.color = '#b12929';
          return;
        }

        if (password.length < 8) {
          adminMessage.textContent = 'La contraseña debe tener al menos 8 caracteres.';
          adminMessage.style.color = '#b12929';
          return;
        }

        const confirmar = window.confirm(
          `¿Confirmás cambiar la contraseña de "${usuarioNombre}" por la que ingresaste?`
        );
        if (!confirmar) return;

        try {
          const resp = await fetch(`${API_BASE_URL}/api/usuarios/${idUsuario}/password`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
          });

          const data = await resp.json();

          if (!resp.ok || !data.ok) {
            adminMessage.textContent = data.message || 'Error al reiniciar la contraseña.';
            adminMessage.style.color = '#b12929';
            return;
          }

          adminMessage.textContent = data.message || 'Contraseña reiniciada correctamente.';
          adminMessage.style.color = '#197c3a';
          alert('Contraseña actualizada correctamente.');
        } catch (err) {
          console.error(err);
          adminMessage.textContent = 'No se pudo conectar con el servidor al reiniciar la contraseña.';
          adminMessage.style.color = '#b12929';
        }
      }

      // ELIMINAR USUARIO
      if (target.classList.contains('btn-delete')) {
        const usuario = tr.querySelector('.col-usuario')?.textContent || '';

        const confirmar = window.confirm(
          `¿Seguro que querés eliminar el usuario "${usuario}" (ID ${idUsuario})?`
        );
        if (!confirmar) return;

        try {
          const resp = await fetch(`${API_BASE_URL}/api/usuarios/${idUsuario}`, {
            method: 'DELETE'
          });

          const data = await resp.json();

          if (!resp.ok || !data.ok) {
            adminMessage.textContent = data.message || 'Error al eliminar usuario.';
            adminMessage.style.color = '#b12929';
            return;
          }

          adminMessage.textContent = 'Usuario eliminado correctamente.';
          adminMessage.style.color = '#197c3a';

          await cargarUsuarios();
        } catch (err) {
          console.error(err);
          adminMessage.textContent = 'No se pudo conectar con el servidor.';
          adminMessage.style.color = '#b12929';
        }
      }
    });
  }

  // ===========================
  //   FUNCIONES AUXILIARES
  // ===========================

  async function cargarUsuarios() {
    try {
      const resp = await fetch(`${API_BASE_URL}/api/usuarios`);
      const data = await resp.json();

      if (!resp.ok || !data.ok) {
        adminMessage.textContent = data.message || 'Error al cargar usuarios.';
        adminMessage.style.color = '#b12929';
        return;
      }

      usuarios = data.data || [];

      // Aseguramos tener cursos cargados para los selects
      await cargarCursosDisponibles();

      aplicarFiltros();
    } catch (err) {
      console.error(err);
      adminMessage.textContent = 'No se pudo conectar con el servidor.';
      adminMessage.style.color = '#b12929';
    }
  }

  async function cargarCursosDisponibles() {
    // Si ya los tenemos, no volvemos a pedir
    if (cursosDisponibles.length > 0) return;

    try {
      const resp = await fetch(`${API_BASE_URL}/api/cursos`);
      const data = await resp.json();

      if (!resp.ok || !data.ok) {
        console.error('Error al cargar cursos:', data.message);
        return;
      }

      cursosDisponibles = data.data || [];
    } catch (err) {
      console.error('No se pudo conectar con /api/cursos:', err);
    }
  }

  function llenarSelectNuevoCurso() {
    if (!nuevoCurso) return;

    nuevoCurso.innerHTML = '<option value="">Sin curso / seleccionar curso</option>';

    cursosDisponibles.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.nombre_curso;
      opt.textContent = c.nombre_curso;
      nuevoCurso.appendChild(opt);
    });
  }

  function aplicarFiltros() {
    const texto = (filtroTexto.value || '').toLowerCase();
    const rol = filtroRol.value;
    const estado = filtroEstado.value;

    usuariosFiltrados = usuarios.filter((u) => {
      let coincideTexto = true;
      let coincideRol = true;
      let coincideEstado = true;

      if (texto) {
        const combinacion = `${u.usuario} ${u.nombre_completo} ${u.dni}`.toLowerCase();
        coincideTexto = combinacion.includes(texto);
      }

      if (rol) {
        coincideRol = u.rol === rol;
      }

      if (estado) {
        coincideEstado = u.estado_cuenta === estado;
      }

      return coincideTexto && coincideRol && coincideEstado;
    });

    renderizarTabla();
  }

  function renderizarTabla() {
    usuariosTableBody.innerHTML = '';

    if (usuariosFiltrados.length === 0) {
      usuariosTableBody.innerHTML = `
        <tr>
          <td colspan="9">No se encontraron usuarios con los filtros aplicados.</td>
        </tr>
      `;
      return;
    }

    const fragment = document.createDocumentFragment();

    usuariosFiltrados.forEach((u) => {
      const tr = document.createElement('tr');
      tr.dataset.id = u.id_usuario;

      // Opciones de curso para este usuario
      let opcionesCurso = '<option value="">(Sin curso)</option>';
      cursosDisponibles.forEach((c) => {
        const seleccionado = (u.curso === c.nombre_curso) ? 'selected' : '';
        opcionesCurso += `
          <option value="${c.nombre_curso}" ${seleccionado}>
            ${c.nombre_curso}
          </option>
        `;
      });

      tr.innerHTML = `
        <td>${u.id_usuario}</td>
        <td class="col-usuario">${u.usuario}</td>
        <td>
          <input type="text" class="input-nombre" value="${u.nombre_completo || ''}">
        </td>
        <td>
          <input type="email" class="input-email" value="${u.email || ''}">
        </td>
        <td>
          <input type="text" class="input-dni" value="${u.dni || ''}">
        </td>
        <td>
          <select class="select-rol">
            <option value="admin" ${u.rol === 'admin' ? 'selected' : ''}>Admin</option>
            <option value="alumnado" ${u.rol === 'alumnado' ? 'selected' : ''}>Alumnado</option>
            <option value="alumno" ${u.rol === 'alumno' ? 'selected' : ''}>Alumno</option>
          </select>
        </td>
        <td>
          <select class="select-curso">
            ${opcionesCurso}
          </select>
        </td>
        <td>
          <select class="select-estado">
            <option value="pendiente" ${u.estado_cuenta === 'pendiente' ? 'selected' : ''}>Pendiente</option>
            <option value="aprobado" ${u.estado_cuenta === 'aprobado' ? 'selected' : ''}>Aprobado</option>
            <option value="deshabilitado" ${u.estado_cuenta === 'deshabilitado' ? 'selected' : ''}>Deshabilitado</option>
          </select>
        </td>
        <td>
          <div class="row-actions">
            <button class="btn-small btn-save">Guardar</button>
            <button class="btn-small btn-reset">Cambiar Contraseña</button>
            <button class="btn-small btn-delete">Eliminar</button>
          </div>
        </td>
      `;

      fragment.appendChild(tr);
    });

    usuariosTableBody.appendChild(fragment);
  }
});
