// frontend/js/cursos_materias.js
const API_BASE_URL = 'http://localhost:3000';

document.addEventListener('DOMContentLoaded', () => {
  // Elementos DOM - Cursos
  const formNuevoCurso = document.getElementById('formNuevoCurso');
  const inputNuevoCurso = document.getElementById('nuevoCurso');
  const cursosTableBody = document.getElementById('cursosTableBody');
  const cursosMessage = document.getElementById('cursosMessage');

  // Elementos DOM - Materias
  const formNuevaMateria = document.getElementById('formNuevaMateria');
  const inputNuevaMateria = document.getElementById('nuevaMateria');
  const materiasTableBody = document.getElementById('materiasTableBody');
  const materiasMessage = document.getElementById('materiasMessage');

  let cursos = [];
  let materias = [];

  // (Opcional) Verificar rol para restringir acceso
  controlarAcceso();

  // Carga inicial
  cargarCursos();
  cargarMaterias();

  // ====================
  //   CURSOS
  // ====================

  if (formNuevoCurso) {
    formNuevoCurso.addEventListener('submit', async (e) => {
      e.preventDefault();
      cursosMessage.textContent = '';

      const nombreCurso = (inputNuevoCurso.value || '').trim();
      if (!nombreCurso) {
        cursosMessage.textContent = 'Ingresá un nombre de curso.';
        cursosMessage.style.color = '#b12929';
        return;
      }

      try {
        const resp = await fetch(`${API_BASE_URL}/api/cursos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombreCurso })
        });

        const data = await resp.json();

        if (!resp.ok || !data.ok) {
          cursosMessage.textContent = data.message || 'Error al crear el curso.';
          cursosMessage.style.color = '#b12929';
          return;
        }

        cursosMessage.textContent = 'Curso creado correctamente.';
        cursosMessage.style.color = '#197c3a';
        inputNuevoCurso.value = '';
        await cargarCursos();
      } catch (err) {
        console.error(err);
        cursosMessage.textContent = 'No se pudo conectar con el servidor.';
        cursosMessage.style.color = '#b12929';
      }
    });
  }

  if (cursosTableBody) {
    cursosTableBody.addEventListener('click', async (e) => {
      const target = e.target;
      const tr = target.closest('tr');
      if (!tr) return;
      const idCurso = tr.dataset.id;

      // Guardar cambios
      if (target.classList.contains('btn-save-curso')) {
        const inputNombre = tr.querySelector('.input-nombre-curso');
        const nombreCurso = (inputNombre.value || '').trim();
        if (!nombreCurso) {
          cursosMessage.textContent = 'El nombre del curso no puede estar vacío.';
          cursosMessage.style.color = '#b12929';
          return;
        }

        try {
          const resp = await fetch(`${API_BASE_URL}/api/cursos/${idCurso}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombreCurso })
          });
          const data = await resp.json();

          if (!resp.ok || !data.ok) {
            cursosMessage.textContent = data.message || 'Error al actualizar el curso.';
            cursosMessage.style.color = '#b12929';
            return;
          }

          cursosMessage.textContent = 'Curso actualizado correctamente.';
          cursosMessage.style.color = '#197c3a';
          await cargarCursos();
        } catch (err) {
          console.error(err);
          cursosMessage.textContent = 'No se pudo conectar con el servidor.';
          cursosMessage.style.color = '#b12929';
        }
      }

      // Eliminar curso
      if (target.classList.contains('btn-delete-curso')) {
        const nombre = tr.querySelector('.input-nombre-curso')?.value || '';
        const confirmar = window.confirm(
          `¿Seguro que querés eliminar el curso "${nombre}"?\n` +
          'Si hay alumnos asociados, no se permitirá borrar.'
        );
        if (!confirmar) return;

        try {
          const resp = await fetch(`${API_BASE_URL}/api/cursos/${idCurso}`, {
            method: 'DELETE'
          });
          const data = await resp.json();

          if (!resp.ok || !data.ok) {
            cursosMessage.textContent = data.message || 'Error al eliminar el curso.';
            cursosMessage.style.color = '#b12929';
            return;
          }

          cursosMessage.textContent = 'Curso eliminado correctamente.';
          cursosMessage.style.color = '#197c3a';
          await cargarCursos();
        } catch (err) {
          console.error(err);
          cursosMessage.textContent = 'No se pudo conectar con el servidor.';
          cursosMessage.style.color = '#b12929';
        }
      }
    });
  }

  async function cargarCursos() {
    try {
      const resp = await fetch(`${API_BASE_URL}/api/cursos`);
      const data = await resp.json();

      if (!resp.ok || !data.ok) {
        cursosTableBody.innerHTML = `
          <tr><td colspan="3">Error al cargar cursos.</td></tr>
        `;
        return;
      }

      cursos = data.data || [];
      renderCursos();
    } catch (err) {
      console.error(err);
      cursosTableBody.innerHTML = `
        <tr><td colspan="3">No se pudo conectar con el servidor.</td></tr>
      `;
    }
  }

  function renderCursos() {
    cursosTableBody.innerHTML = '';

    if (cursos.length === 0) {
      cursosTableBody.innerHTML = `
        <tr><td colspan="3">No hay cursos cargados.</td></tr>
      `;
      return;
    }

    const fragment = document.createDocumentFragment();

    cursos.forEach((c) => {
      const tr = document.createElement('tr');
      tr.dataset.id = c.id_curso;

      tr.innerHTML = `
        <td>${c.id_curso}</td>
        <td>
          <input type="text" class="input-nombre-curso" value="${c.nombre_curso || ''}">
        </td>
        <td>
          <button class="btn-small btn-save-curso">Guardar</button>
          <button class="btn-small btn-delete-curso">Eliminar</button>
        </td>
      `;

      fragment.appendChild(tr);
    });

    cursosTableBody.appendChild(fragment);
  }

  // ====================
  //   MATERIAS
  // ====================

  if (formNuevaMateria) {
    formNuevaMateria.addEventListener('submit', async (e) => {
      e.preventDefault();
      materiasMessage.textContent = '';

      const nombreMateria = (inputNuevaMateria.value || '').trim();
      if (!nombreMateria) {
        materiasMessage.textContent = 'Ingresá un nombre de materia.';
        materiasMessage.style.color = '#b12929';
        return;
      }

      try {
        const resp = await fetch(`${API_BASE_URL}/api/materias`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nombreMateria })
        });
        const data = await resp.json();

        if (!resp.ok || !data.ok) {
          materiasMessage.textContent = data.message || 'Error al crear la materia.';
          materiasMessage.style.color = '#b12929';
          return;
        }

        materiasMessage.textContent = 'Materia creada correctamente.';
        materiasMessage.style.color = '#197c3a';
        inputNuevaMateria.value = '';
        await cargarMaterias();
      } catch (err) {
        console.error(err);
        materiasMessage.textContent = 'No se pudo conectar con el servidor.';
        materiasMessage.style.color = '#b12929';
      }
    });
  }

  if (materiasTableBody) {
    materiasTableBody.addEventListener('click', async (e) => {
      const target = e.target;
      const tr = target.closest('tr');
      if (!tr) return;
      const idMateria = tr.dataset.id;

      // Guardar cambios
      if (target.classList.contains('btn-save-materia')) {
        const inputNombre = tr.querySelector('.input-nombre-materia');
        const nombreMateria = (inputNombre.value || '').trim();
        if (!nombreMateria) {
          materiasMessage.textContent = 'El nombre de la materia no puede estar vacío.';
          materiasMessage.style.color = '#b12929';
          return;
        }

        try {
          const resp = await fetch(`${API_BASE_URL}/api/materias/${idMateria}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombreMateria })
          });
          const data = await resp.json();

          if (!resp.ok || !data.ok) {
            materiasMessage.textContent = data.message || 'Error al actualizar la materia.';
            materiasMessage.style.color = '#b12929';
            return;
          }

          materiasMessage.textContent = 'Materia actualizada correctamente.';
          materiasMessage.style.color = '#197c3a';
          await cargarMaterias();
        } catch (err) {
          console.error(err);
          materiasMessage.textContent = 'No se pudo conectar con el servidor.';
          materiasMessage.style.color = '#b12929';
        }
      }

      // Eliminar materia
      if (target.classList.contains('btn-delete-materia')) {
        const nombre = tr.querySelector('.input-nombre-materia')?.value || '';
        const confirmar = window.confirm(
          `¿Seguro que querés eliminar la materia "${nombre}"?\n` +
          'Esto puede eliminar también sus notas asociadas.'
        );
        if (!confirmar) return;

        try {
          const resp = await fetch(`${API_BASE_URL}/api/materias/${idMateria}`, {
            method: 'DELETE'
          });
          const data = await resp.json();

          if (!resp.ok || !data.ok) {
            materiasMessage.textContent = data.message || 'Error al eliminar la materia.';
            materiasMessage.style.color = '#b12929';
            return;
          }

          materiasMessage.textContent = 'Materia eliminada correctamente.';
          materiasMessage.style.color = '#197c3a';
          await cargarMaterias();
        } catch (err) {
          console.error(err);
          materiasMessage.textContent = 'No se pudo conectar con el servidor.';
          materiasMessage.style.color = '#b12929';
        }
      }
    });
  }

  async function cargarMaterias() {
    try {
      const resp = await fetch(`${API_BASE_URL}/api/materias`);
      const data = await resp.json();

      if (!resp.ok || !data.ok) {
        materiasTableBody.innerHTML = `
          <tr><td colspan="3">Error al cargar materias.</td></tr>
        `;
        return;
      }

      materias = data.data || [];
      renderMaterias();
    } catch (err) {
      console.error(err);
      materiasTableBody.innerHTML = `
        <tr><td colspan="3">No se pudo conectar con el servidor.</td></tr>
      `;
    }
  }

  function renderMaterias() {
    materiasTableBody.innerHTML = '';

    if (materias.length === 0) {
      materiasTableBody.innerHTML = `
        <tr><td colspan="3">No hay materias cargadas.</td></tr>
      `;
      return;
    }

    const fragment = document.createDocumentFragment();

    materias.forEach((m) => {
      const tr = document.createElement('tr');
      tr.dataset.id = m.id_materia;

      tr.innerHTML = `
        <td>${m.id_materia}</td>
        <td>
          <input type="text" class="input-nombre-materia" value="${m.nombre_materia || ''}">
        </td>
        <td>
          <button class="btn-small btn-save-materia">Guardar</button>
          <button class="btn-small btn-delete-materia">Eliminar</button>
        </td>
      `;

      fragment.appendChild(tr);
    });

    materiasTableBody.appendChild(fragment);
  }

  // ====================
  //   CONTROL DE ACCESO
  // ====================

  function controlarAcceso() {
    try {
      const raw = localStorage.getItem('usuarioActual');
      if (!raw) return; // si no hay nada, por ahora no bloqueamos

      const usuarioActual = JSON.parse(raw);
      if (!usuarioActual || !usuarioActual.rol) return;

      // Solo admin o alumnado deberían usar esta página
      if (usuarioActual.rol !== 'admin' && usuarioActual.rol !== 'alumnado') {
        alert('No tenés permisos para acceder a la gestión de cursos y materias.');
        window.location.href = 'index.html';
      }
    } catch (e) {
      console.error('Error al controlar acceso:', e);
    }
  }
});
