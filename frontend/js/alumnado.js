// frontend/js/alumnado.js
const API_BASE_URL = 'http://localhost:3000';
const ANIO_LECTIVO_ACTUAL = 2025; // ajustá acá el ciclo lectivo que estés usando

document.addEventListener('DOMContentLoaded', () => {
  // Elementos del DOM
  const filtroAlumno = document.getElementById('filtroAlumno');
  const filtroCurso = document.getElementById('filtroCurso');
  const alumnosLista = document.getElementById('alumnosLista');

  const tituloBoletin = document.getElementById('tituloBoletin');
  const boletinBody = document.getElementById('boletinBody');
  const btnGuardarBoletin = document.getElementById('btnGuardarBoletin');
  const alumnadoMessage = document.getElementById('alumnadoMessage');

  let alumnos = [];              // lista completa de alumnos (SOLO aprobados)
  let alumnosFiltrados = [];     // resultado de los filtros
  let materias = [];             // lista de materias (se carga una sola vez)
  let alumnoSeleccionado = null; // { id_usuario, nombre_completo, curso, ... }
  let cursosCache = [];          // cursos desde /api/cursos

  // Carga inicial
  cargarCursosEnFiltro(); // llena el select de curso con lo que haya en la BD
  cargarAlumnos();        // carga lista de alumnos

  // Filtros de alumnos
  if (filtroAlumno) {
    filtroAlumno.addEventListener('input', aplicarFiltrosAlumnos);
  }
  if (filtroCurso) {
    filtroCurso.addEventListener('change', aplicarFiltrosAlumnos);
  }

  // Click en lista de alumnos: seleccionar y cargar boletín automáticamente
  if (alumnosLista) {
    alumnosLista.addEventListener('click', async (e) => {
      const item = e.target.closest('.alumno-item');
      if (!item) return;

      const id = item.dataset.id;
      const alumno = alumnos.find(a => String(a.id_usuario) === String(id));
      if (!alumno) return;

      alumnoSeleccionado = alumno;

      // Marcar visualmente el seleccionado
      document.querySelectorAll('.alumno-item').forEach(el => {
        el.classList.toggle('selected', el.dataset.id === String(id));
      });

      // Actualizar título del boletín
      tituloBoletin.textContent = `Boletín - ${alumno.nombre_completo} (${alumno.curso || 'Sin curso'})`;

      alumnadoMessage.textContent = '';
      alumnadoMessage.style.color = '';

      // Mostrar que se está cargando algo en la tabla
      boletinBody.innerHTML = `
        <tr>
          <td colspan="11">Cargando boletín...</td>
        </tr>
      `;

      // Deshabilitar botón de guardar mientras se carga
      if (btnGuardarBoletin) {
        btnGuardarBoletin.disabled = true;
      }

      try {
        // Asegurar que las materias estén cargadas
        if (materias.length === 0) {
          await cargarMaterias();
        }

        await cargarBoletinAlumno(alumnoSeleccionado.id_usuario);

        // Si todo fue bien, habilitar guardar
        if (btnGuardarBoletin) {
          btnGuardarBoletin.disabled = false;
        }
      } catch (err) {
        console.error(err);
        alumnadoMessage.textContent = 'Error al cargar el boletín del alumno.';
        alumnadoMessage.style.color = '#b12929';
        boletinBody.innerHTML = `
          <tr>
            <td colspan="11">No se pudo cargar el boletín.</td>
          </tr>
        `;
        if (btnGuardarBoletin) {
          btnGuardarBoletin.disabled = true;
        }
      }
    });
  }

  // Botón Guardar boletín
  if (btnGuardarBoletin) {
    btnGuardarBoletin.addEventListener('click', async () => {
      alumnadoMessage.textContent = '';

      if (!alumnoSeleccionado) {
        alumnadoMessage.textContent = 'Seleccioná un alumno primero.';
        alumnadoMessage.style.color = '#b12929';
        return;
      }

      try {
        const payloadMaterias = construirPayloadBoletinDesdeTabla();
        if (!payloadMaterias) {
          // Si hubo error de validación, la función ya mostró el mensaje
          return;
        }

        const resp = await fetch(`${API_BASE_URL}/api/boletines/${alumnoSeleccionado.id_usuario}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            anio: ANIO_LECTIVO_ACTUAL,
            materias: payloadMaterias
          })
        });

        const data = await resp.json();

        if (!resp.ok || !data.ok) {
          alumnadoMessage.textContent = data.message || 'Error al guardar el boletín.';
          alumnadoMessage.style.color = '#b12929';
          return;
        }

        alumnadoMessage.textContent = 'Boletín guardado correctamente.';
        alumnadoMessage.style.color = '#197c3a';
      } catch (err) {
        console.error(err);
        alumnadoMessage.textContent = 'No se pudo conectar con el servidor.';
        alumnadoMessage.style.color = '#b12929';
      }
    });
  }

  // Navegación con flechas entre inputs de notas
  if (boletinBody) {
    boletinBody.addEventListener('keydown', (e) => {
      if (!e.target.matches('input[type="number"].nota-input')) return;
      manejarNavegacionConFlechas(e);
    });
  }

  // ==========================
  //   FUNCIONES AUXILIARES
  // ==========================

  // Cargar cursos para el filtro (select filtroCurso)
  async function cargarCursosEnFiltro() {
    if (!filtroCurso) return;

    try {
      const resp = await fetch(`${API_BASE_URL}/api/cursos`);
      const data = await resp.json();

      if (!resp.ok || !data.ok) {
        console.error('Error al cargar cursos en filtro:', data.message);
        filtroCurso.innerHTML = '<option value="">Todos</option>';
        return;
      }

      cursosCache = data.data || [];

      filtroCurso.innerHTML = '<option value="">Todos</option>';

      cursosCache.forEach((c) => {
        const opt = document.createElement('option');
        opt.value = c.nombre_curso;
        opt.textContent = c.nombre_curso;
        filtroCurso.appendChild(opt);
      });
    } catch (err) {
      console.error('No se pudo conectar con /api/cursos para filtro:', err);
      filtroCurso.innerHTML = '<option value="">Todos</option>';
    }
  }

  async function cargarAlumnos() {
    try {
      const resp = await fetch(`${API_BASE_URL}/api/alumnos`);
      const data = await resp.json();

      if (!resp.ok || !data.ok) {
        alumnosLista.innerHTML = '<p>Error al cargar alumnos.</p>';
        return;
      }

      // SOLO alumnos con estado_cuenta 'aprobado'
      // Ejemplo: si vienen 10 alumnos y 4 tienen 'pendiente' o 'deshabilitado',
      // acá se quedan solo los 6 aprobados.
      alumnos = (data.data || []).filter(a => a.estado_cuenta === 'aprobado');

      aplicarFiltrosAlumnos();
    } catch (err) {
      console.error(err);
      alumnosLista.innerHTML = '<p>No se pudo conectar con el servidor.</p>';
    }
  }

  function aplicarFiltrosAlumnos() {
    const texto = (filtroAlumno?.value || '').toLowerCase();
    const curso = filtroCurso?.value || '';

    alumnosFiltrados = alumnos.filter((a) => {
      let coincideTexto = true;
      let coincideCurso = true;

      if (texto) {
        const combinacion = `${a.nombre_completo} ${a.usuario} ${a.dni}`.toLowerCase();
        coincideTexto = combinacion.includes(texto);
      }

      if (curso) {
        coincideCurso = a.curso === curso; // a.curso viene como nombre_curso desde /api/alumnos
      }

      return coincideTexto && coincideCurso;
    });

    renderAlumnosLista();
  }

  function renderAlumnosLista() {
    alumnosLista.innerHTML = '';

    if (alumnosFiltrados.length === 0) {
      alumnosLista.innerHTML = '<p>No se encontraron alumnos.</p>';
      return;
    }

    const fragment = document.createDocumentFragment();

    alumnosFiltrados.forEach((a) => {
      const btn = document.createElement('button');
      btn.className = 'alumno-item';
      btn.dataset.id = a.id_usuario;
      btn.type = 'button';

      btn.innerHTML = `
        <div><strong>${a.nombre_completo}</strong></div>
        <div class="small-text">
          Usuario: ${a.usuario} · DNI: ${a.dni} · Curso: ${a.curso || 'Sin curso'}
        </div>
        <div class="small-text">
          Estado: ${a.estado_cuenta}
        </div>
      `;

      if (alumnoSeleccionado && alumnoSeleccionado.id_usuario === a.id_usuario) {
        btn.classList.add('selected');
      }

      fragment.appendChild(btn);
    });

    alumnosLista.appendChild(fragment);
  }

  async function cargarMaterias() {
    const resp = await fetch(`${API_BASE_URL}/api/materias`);
    const data = await resp.json();

    if (!resp.ok || !data.ok) {
      throw new Error(data.message || 'Error al cargar materias');
    }

    materias = data.data || [];
  }

  async function cargarBoletinAlumno(idUsuario) {
    const resp = await fetch(
      `${API_BASE_URL}/api/boletines/${idUsuario}?anio=${ANIO_LECTIVO_ACTUAL}`
    );
    const data = await resp.json();

    if (!resp.ok || !data.ok) {
      throw new Error(data.message || 'Error al obtener boletín');
    }

    const boletinRows = data.data || [];
    const boletinPorMateria = {};

    boletinRows.forEach((row) => {
      boletinPorMateria[row.id_materia] = row;
    });

    renderTablaBoletin(materias, boletinPorMateria);
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
      tr.dataset.idMateria = m.id_materia;

      tr.innerHTML = `
        <td>${m.nombre_materia}</td>
        <td><input type="number" class="nota-input" name="p1_1c" min="1" max="10" value="${valorInput(rowData.p1_1c)}"></td>
        <td><input type="number" class="nota-input" name="p2_1c" min="1" max="10" value="${valorInput(rowData.p2_1c)}"></td>
        <td><input type="number" class="nota-input" name="nf_1c" min="1" max="10" value="${valorInput(rowData.nf_1c)}"></td>
        <td><input type="number" class="nota-input" name="p1_2c" min="1" max="10" value="${valorInput(rowData.p1_2c)}"></td>
        <td><input type="number" class="nota-input" name="p2_2c" min="1" max="10" value="${valorInput(rowData.p2_2c)}"></td>
        <td><input type="number" class="nota-input" name="nf_2c" min="1" max="10" value="${valorInput(rowData.nf_2c)}"></td>
        <td><input type="number" class="nota-input" name="diciembre_acreditacion" min="1" max="10" value="${valorInput(rowData.diciembre_acreditacion)}"></td>
        <td><input type="number" class="nota-input" name="feb_mar_recuperatorio" min="1" max="10" value="${valorInput(rowData.feb_mar_recuperatorio)}"></td>
        <td><input type="number" class="nota-input" name="nota_definitiva" min="1" max="10" value="${valorInput(rowData.nota_definitiva)}"></td>
      `;

      fragment.appendChild(tr);
    });

    boletinBody.appendChild(fragment);
  }

  function valorInput(v) {
    return (v === null || v === undefined) ? '' : v;
  }

  function construirPayloadBoletinDesdeTabla() {
    const filas = boletinBody.querySelectorAll('tr');
    const materiasPayload = [];
    alumnadoMessage.textContent = '';

    for (const tr of filas) {
      const idMateria = Number(tr.dataset.idMateria);
      if (!idMateria) continue;

      const campos = [
        'p1_1c',
        'p2_1c',
        'nf_1c',
        'p1_2c',
        'p2_2c',
        'nf_2c',
        'diciembre_acreditacion',
        'feb_mar_recuperatorio',
        'nota_definitiva'
      ];

      const objNotas = { id_materia: idMateria };

      for (const campo of campos) {
        const input = tr.querySelector(`input[name="${campo}"]`);
        if (!input) continue;

        const valStr = input.value.trim();
        if (valStr === '') {
          objNotas[campo] = null;
        } else {
          const valNum = parseInt(valStr, 10);
          if (Number.isNaN(valNum) || valNum < 1 || valNum > 10) {
            alumnadoMessage.textContent =
              'Todas las notas deben estar vacías o entre 1 y 10.';
            alumnadoMessage.style.color = '#b12929';
            return null;
          }
          objNotas[campo] = valNum;
        }
      }

      materiasPayload.push(objNotas);
    }

    if (materiasPayload.length === 0) {
      alumnadoMessage.textContent = 'No hay materias para guardar.';
      alumnadoMessage.style.color = '#b12929';
      return null;
    }

    return materiasPayload;
  }

  // Navegación con flechas dentro de la tabla de notas
  function manejarNavegacionConFlechas(e) {
    const key = e.key;
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) return;

    const input = e.target;
    const td = input.closest('td');
    const tr = td?.parentElement;
    if (!td || !tr) return;

    const cellIndex = td.cellIndex; // índice de la celda dentro de la fila
    let targetInput = null;

    if (key === 'ArrowLeft') {
      let prevTd = td.previousElementSibling;
      while (prevTd) {
        const candidate = prevTd.querySelector('input');
        if (candidate) {
          targetInput = candidate;
          break;
        }
        prevTd = prevTd.previousElementSibling;
      }
    } else if (key === 'ArrowRight') {
      let nextTd = td.nextElementSibling;
      while (nextTd) {
        const candidate = nextTd.querySelector('input');
        if (candidate) {
          targetInput = candidate;
          break;
        }
        nextTd = nextTd.nextElementSibling;
      }
    } else if (key === 'ArrowUp') {
      let prevTr = tr.previousElementSibling;
      while (prevTr) {
        const candidateCell = prevTr.cells[cellIndex];
        if (candidateCell) {
          const candidate = candidateCell.querySelector('input');
          if (candidate) {
            targetInput = candidate;
            break;
          }
        }
        prevTr = prevTr.previousElementSibling;
      }
    } else if (key === 'ArrowDown') {
      let nextTr = tr.nextElementSibling;
      while (nextTr) {
        const candidateCell = nextTr.cells[cellIndex];
        if (candidateCell) {
          const candidate = candidateCell.querySelector('input');
          if (candidate) {
            targetInput = candidate;
            break;
          }
        }
        nextTr = nextTr.nextElementSibling;
      }
    }

    if (targetInput) {
      e.preventDefault(); // evita que la flecha cambie el valor del number
      targetInput.focus();
      targetInput.select();
    }
  }
});
