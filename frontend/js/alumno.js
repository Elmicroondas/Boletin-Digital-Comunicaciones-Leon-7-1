// frontend/js/alumno.js
const API_BASE_URL = 'http://localhost:3000';
const ANIO_LECTIVO_ACTUAL = 2025; // mismo año que uses en alumnado.js

document.addEventListener('DOMContentLoaded', () => {
  const tituloAlumno = document.getElementById('tituloAlumno');
  const subtituloAlumno = document.getElementById('subtituloAlumno');
  const boletinBody = document.getElementById('boletinAlumnoBody');
  const alumnoMessage = document.getElementById('alumnoMessage');

  // Encabezado del boletín
  const spanNombreAlumno = document.getElementById('boletinNombreAlumno');
  const spanCursoAlumno = document.getElementById('boletinCursoAlumno');
  const spanAnioBoletin = document.getElementById('boletinAnio');

  // Botón y card del formulario de cambio de contraseña
  const btnMostrarFormPassword = document.getElementById('btnMostrarFormPassword');
  const cardCambiarPassword = document.getElementById('cardCambiarPassword');

  // Formulario cambio de contraseña
  const formCambiarPassword = document.getElementById('formCambiarPassword');
  const passActualInput = document.getElementById('passActual');
  const passNuevaInput = document.getElementById('passNueva');
  const passNueva2Input = document.getElementById('passNueva2');
  const alumnoPassMessage = document.getElementById('alumnoPassMessage');

  let usuarioActual = null;
  let materias = [];

  // Año lectivo en el encabezado
  if (spanAnioBoletin) {
    spanAnioBoletin.textContent = ANIO_LECTIVO_ACTUAL;
  }

  // 1) Verificar usuario logueado
  const raw = localStorage.getItem('usuarioActual');
  if (!raw) {
    alumnoMessage.textContent = 'No hay sesión iniciada. Volvé a la página de inicio de sesión.';
    alumnoMessage.style.color = '#b12929';
    return;
  }

  try {
    usuarioActual = JSON.parse(raw);
  } catch (e) {
    console.error('Error parseando usuarioActual:', e);
    alumnoMessage.textContent = 'Error con la sesión almacenada. Volvé a iniciar sesión.';
    alumnoMessage.style.color = '#b12929';
    return;
  }

  if (!usuarioActual || !usuarioActual.idUsuario) {
    alumnoMessage.textContent = 'Datos de sesión incompletos. Volvé a iniciar sesión.';
    alumnoMessage.style.color = '#b12929';
    return;
  }

  if (usuarioActual.rol !== 'alumno') {
    alumnoMessage.textContent = 'Este panel es solo para alumnos.';
    alumnoMessage.style.color = '#b12929';
    return;
  }

  // 2) Configurar botón mostrar/ocultar formulario de contraseña
  configurarMostrarFormularioPassword();

  // 3) Configurar envío del formulario de cambio de contraseña
  configurarCambioPassword();

  // 4) Cargar datos del alumno + materias + boletín
  cargarDatos();

  // ==========================
  //   BOTÓN MOSTRAR/OCULTAR FORMULARIO
  // ==========================

  function configurarMostrarFormularioPassword() {
    if (!btnMostrarFormPassword || !cardCambiarPassword) return;

    cardCambiarPassword.hidden = true;

    btnMostrarFormPassword.addEventListener('click', () => {
      const estabaOculto = cardCambiarPassword.hidden;
      cardCambiarPassword.hidden = !estabaOculto;

      if (cardCambiarPassword.hidden) {
        btnMostrarFormPassword.textContent = 'Cambiar contraseña';
      } else {
        btnMostrarFormPassword.textContent = 'Ocultar formulario de contraseña';
        cardCambiarPassword.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  // ==========================
  //   CAMBIO DE CONTRASEÑA
  // ==========================

  function configurarCambioPassword() {
    if (!formCambiarPassword) return;

    formCambiarPassword.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (alumnoPassMessage) alumnoPassMessage.textContent = '';

      const passwordActual = (passActualInput?.value || '').trim();
      const passwordNueva = (passNuevaInput?.value || '').trim();
      const passwordNueva2 = (passNueva2Input?.value || '').trim();

      if (!passwordActual || !passwordNueva || !passwordNueva2) {
        if (alumnoPassMessage) {
          alumnoPassMessage.textContent = 'Completá todos los campos.';
          alumnoPassMessage.style.color = '#b12929';
        }
        return;
      }

      if (passwordNueva.length < 8) {
        if (alumnoPassMessage) {
          alumnoPassMessage.textContent = 'La nueva contraseña debe tener al menos 8 caracteres.';
          alumnoPassMessage.style.color = '#b12929';
        }
        return;
      }

      if (passwordNueva !== passwordNueva2) {
        if (alumnoPassMessage) {
          alumnoPassMessage.textContent = 'Las nuevas contraseñas no coinciden.';
          alumnoPassMessage.style.color = '#b12929';
        }
        return;
      }

      try {
        const resp = await fetch(
          `${API_BASE_URL}/api/usuarios/${usuarioActual.idUsuario}/password-self`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ passwordActual, passwordNueva })
          }
        );

        const data = await resp.json();

        if (!resp.ok || !data.ok) {
          if (alumnoPassMessage) {
            alumnoPassMessage.textContent = data.message || 'Error al cambiar la contraseña.';
            alumnoPassMessage.style.color = '#b12929';
          }
          return;
        }

        if (alumnoPassMessage) {
          alumnoPassMessage.textContent = data.message || 'Contraseña actualizada correctamente.';
          alumnoPassMessage.style.color = '#197c3a';
        }

        if (passActualInput) passActualInput.value = '';
        if (passNuevaInput) passNuevaInput.value = '';
        if (passNueva2Input) passNueva2Input.value = '';
      } catch (err) {
        console.error(err);
        if (alumnoPassMessage) {
          alumnoPassMessage.textContent = 'No se pudo conectar con el servidor.';
          alumnoPassMessage.style.color = '#b12929';
        }
      }
    });
  }

  // ==========================
  //   CARGA DE DATOS
  // ==========================

  async function cargarDatos() {
    try {
      // 1) Datos del alumno (nombre, curso)
      const respA = await fetch(
        `${API_BASE_URL}/api/alumnos/${usuarioActual.idUsuario}`
      );
      const dataA = await respA.json();

      if (!respA.ok || !dataA.ok || !dataA.data) {
        alumnoMessage.textContent =
          dataA.message || 'Error al cargar los datos del alumno.';
        alumnoMessage.style.color = '#b12929';
        return;
      }

      const infoAlumno = dataA.data;

      if (spanNombreAlumno) {
        spanNombreAlumno.textContent = infoAlumno.nombre_completo || '-';
      }
      if (spanCursoAlumno) {
        spanCursoAlumno.textContent = infoAlumno.curso || 'Sin curso';
      }

      // Opcional: ajustar subtítulo
      if (subtituloAlumno) {
        subtituloAlumno.textContent =
          `Boletín del ciclo lectivo ${ANIO_LECTIVO_ACTUAL}.`;
      }

      // 2) Materias
      const respM = await fetch(`${API_BASE_URL}/api/materias`);
      const dataM = await respM.json();

      if (!respM.ok || !dataM.ok) {
        alumnoMessage.textContent = dataM.message || 'Error al cargar las materias.';
        alumnoMessage.style.color = '#b12929';
        return;
      }

      materias = dataM.data || [];

      // 3) Boletín del alumno
      const respB = await fetch(
        `${API_BASE_URL}/api/boletines/${usuarioActual.idUsuario}?anio=${ANIO_LECTIVO_ACTUAL}`
      );
      const dataB = await respB.json();

      if (!respB.ok || !dataB.ok) {
        alumnoMessage.textContent = dataB.message || 'Error al cargar el boletín.';
        alumnoMessage.style.color = '#b12929';
        return;
      }

      const boletinRows = dataB.data || [];
      const boletinPorMateria = {};
      boletinRows.forEach(row => {
        boletinPorMateria[row.id_materia] = row;
      });

      renderTablaBoletin(materias, boletinPorMateria);
    } catch (err) {
      console.error(err);
      alumnoMessage.textContent = 'No se pudo conectar con el servidor.';
      alumnoMessage.style.color = '#b12929';
    }
  }

  function renderTablaBoletin(listaMaterias, boletinPorMateria) {
    boletinBody.innerHTML = '';

    if (!listaMaterias || listaMaterias.length === 0) {
      boletinBody.innerHTML = `
        <tr>
          <td colspan="11">No hay materias configuradas.</td>
        </tr>
      `;
      return;
    }

    const fragment = document.createDocumentFragment();

    listaMaterias.forEach((m) => {
      const rowData = boletinPorMateria[m.id_materia] || {};

      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td>${m.nombre_materia}</td>
        <td>${valorCelda(rowData.p1_1c)}</td>
        <td>${valorCelda(rowData.p2_1c)}</td>
        <td>${valorCelda(rowData.nf_1c)}</td>
        <td>${valorCelda(rowData.p1_2c)}</td>
        <td>${valorCelda(rowData.p2_2c)}</td>
        <td>${valorCelda(rowData.nf_2c)}</td>
        <td>${valorCelda(rowData.diciembre_acreditacion)}</td>
        <td>${valorCelda(rowData.feb_mar_recuperatorio)}</td>
        <td>${valorCelda(rowData.nota_definitiva)}</td>
      `;

      fragment.appendChild(tr);
    });

    boletinBody.appendChild(fragment);
  }

  function valorCelda(v) {
    return (v === null || v === undefined) ? '-' : v;
  }
});
