// backend/app.js
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const pool = require('./db');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

/**
 * Ruta de prueba para verificar que el backend está vivo
 */
app.get('/api/ping', (req, res) => {
  res.json({ ok: true, message: 'Boletín Digital API operativa' });
});

/* ========================================================================
 *  REGISTRO Y LOGIN
 * ===================================================================== */

/**
 * POST /api/register
 * Registrar usuario DESDE el panel de administración
 * Permite crear admin, alumnado y alumno.
 */
app.post('/api/register', async (req, res) => {
  try {
    const {
      usuario,
      password,
      dni,
      email,
      nombreCompleto,
      rol,
      curso,
      estadoCuenta
    } = req.body;

    // Validaciones básicas
    if (!usuario || !password || !dni || !email || !nombreCompleto || !rol) {
      return res.status(400).json({
        ok: false,
        message: 'Faltan datos obligatorios (usuario, contraseña, DNI, email, nombre completo y rol).'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        ok: false,
        message: 'La contraseña debe tener al menos 8 caracteres.'
      });
    }

    // Roles permitidos desde el panel de administración
    const ROLES_PERMITIDOS = ['admin', 'alumnado', 'alumno'];
    if (!ROLES_PERMITIDOS.includes(rol)) {
      return res.status(400).json({
        ok: false,
        message: 'Rol inválido para creación de usuario desde administración.'
      });
    }

    // Resolver curso -> id_curso (solo obligatorio para alumnos)
    let idCurso = null;

    if (rol === 'alumno') {
      if (!curso) {
        return res.status(400).json({
          ok: false,
          message: 'Para el rol "alumno" el curso es obligatorio.'
        });
      }

      const [rowsCurso] = await pool.execute(
        'SELECT id_curso FROM cursos WHERE nombre_curso = ?',
        [curso]
      );

      if (rowsCurso.length === 0) {
        return res.status(400).json({
          ok: false,
          message: `El curso "${curso}" no existe en la tabla cursos.`
        });
      }

      idCurso = rowsCurso[0].id_curso;
    }

    // Determinar estado de cuenta final
    const ESTADOS_VALIDOS = ['pendiente', 'aprobado', 'deshabilitado'];
    let estadoFinal = 'aprobado'; // desde admin, por defecto aprobada

    if (estadoCuenta && ESTADOS_VALIDOS.includes(estadoCuenta)) {
      estadoFinal = estadoCuenta;
    }

    // Hashear contraseña
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Insertar usuario
    const sql = `
      INSERT INTO usuarios 
        (usuario, contrasena_hash, nombre_completo, email, dni, rol, id_curso, estado_cuenta)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      usuario,
      passwordHash,
      nombreCompleto,
      email,
      dni,
      rol,
      idCurso,
      estadoFinal
    ];

    await pool.execute(sql, params);

    return res.status(201).json({
      ok: true,
      message: 'Usuario creado correctamente desde administración.'
    });
  } catch (err) {
    console.error('Error en /api/register:', err);

    // Manejo de claves únicas duplicadas
    if (err.code === 'ER_DUP_ENTRY') {
      let detalle = 'Ya existe un registro con alguno de los datos únicos.';
      if (err.message.includes('usuario')) detalle = 'El nombre de usuario ya está en uso.';
      else if (err.message.includes('email')) detalle = 'El email ya está en uso.';
      else if (err.message.includes('dni')) detalle = 'El DNI ya está registrado.';

      return res.status(409).json({ ok: false, message: detalle });
    }

    return res.status(500).json({
      ok: false,
      message: 'Error interno del servidor.'
    });
  }
});
/**
 * PUT /api/usuarios/:id/password-self
 * Cambio de contraseña hecho por el propio usuario (requiere contraseña actual).
 */
app.put('/api/usuarios/:id/password-self', async (req, res) => {
  try {
    const idUsuario = req.params.id;
    const { passwordActual, passwordNueva } = req.body;

    if (!passwordActual || !passwordNueva) {
      return res.status(400).json({
        ok: false,
        message: 'Debés completar la contraseña actual y la nueva contraseña.'
      });
    }

    if (passwordNueva.length < 8) {
      return res.status(400).json({
        ok: false,
        message: 'La nueva contraseña debe tener al menos 8 caracteres.'
      });
    }

    // Buscar usuario
    const [rows] = await pool.execute(
      'SELECT contrasena_hash FROM usuarios WHERE id_usuario = ? LIMIT 1',
      [idUsuario]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: 'Usuario no encontrado.'
      });
    }

    const user = rows[0];

    // Verificar contraseña actual
    const coincide = await bcrypt.compare(passwordActual, user.contrasena_hash);
    if (!coincide) {
      return res.status(400).json({
        ok: false,
        message: 'La contraseña actual no es correcta.'
      });
    }

    // Hashear nueva contraseña
    const passwordHash = await bcrypt.hash(passwordNueva, 10);

    // Actualizar
    const sqlUpdate = `
      UPDATE usuarios
      SET contrasena_hash = ?
      WHERE id_usuario = ?
    `;

    const [result] = await pool.execute(sqlUpdate, [passwordHash, idUsuario]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        ok: false,
        message: 'Usuario no encontrado al actualizar la contraseña.'
      });
    }

    return res.json({
      ok: true,
      message: 'Contraseña actualizada correctamente.'
    });
  } catch (err) {
    console.error('Error en PUT /api/usuarios/:id/password-self:', err);
    return res.status(500).json({
      ok: false,
      message: 'Error interno al cambiar la contraseña.'
    });
  }
});

/**
 * POST /api/register-alumno
 * Registro exclusivo para alumnos desde la página principal.
 * El rol se fuerza a 'alumno' y el estado a 'pendiente'.
 */
app.post('/api/register-alumno', async (req, res) => {
  try {
    const {
      usuario,
      password,
      dni,
      email,
      nombreCompleto,
      curso
    } = req.body;

    if (!usuario || !password || !dni || !email || !nombreCompleto || !curso) {
      return res.status(400).json({
        ok: false,
        message: 'Faltan datos obligatorios.'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        ok: false,
        message: 'La contraseña debe tener al menos 8 caracteres.'
      });
    }

    // Resolver curso -> id_curso
    const [rowsCurso] = await pool.execute(
      'SELECT id_curso FROM cursos WHERE nombre_curso = ?',
      [curso]
    );

    if (rowsCurso.length === 0) {
      return res.status(400).json({
        ok: false,
        message: `El curso "${curso}" no existe en la tabla cursos.`
      });
    }

    const idCurso = rowsCurso[0].id_curso;

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const sql = `
      INSERT INTO usuarios 
        (usuario, contrasena_hash, nombre_completo, email, dni, rol, id_curso, estado_cuenta)
      VALUES (?, ?, ?, ?, ?, 'alumno', ?, 'pendiente')
    `;

    await pool.execute(sql, [
      usuario,
      passwordHash,
      nombreCompleto,
      email,
      dni,
      idCurso
    ]);

    return res.status(201).json({
      ok: true,
      message: 'Usuario registrado correctamente. Pendiente de aprobación.'
    });
  } catch (err) {
    console.error('Error en /api/register-alumno:', err);

    if (err.code === 'ER_DUP_ENTRY') {
      let detalle = 'Ya existe un registro con alguno de los datos únicos.';
      if (err.message.includes('usuario')) detalle = 'El nombre de usuario ya está en uso.';
      else if (err.message.includes('email')) detalle = 'El email ya está en uso.';
      else if (err.message.includes('dni')) detalle = 'El DNI ya está registrado.';

      return res.status(409).json({ ok: false, message: detalle });
    }

    return res.status(500).json({
      ok: false,
      message: 'Error interno del servidor.'
    });
  }
});

/**
 * POST /api/login
 * Iniciar sesión
 */
app.post('/api/login', async (req, res) => {
  try {
    const { usuario, password } = req.body;

    // Validación básica
    if (!usuario || !password) {
      return res.status(400).json({
        ok: false,
        message: 'Usuario y contraseña son obligatorios.'
      });
    }

    // Buscar usuario
    const sql = `
      SELECT id_usuario, usuario, contrasena_hash, rol, estado_cuenta
      FROM usuarios
      WHERE usuario = ?
      LIMIT 1
    `;
    const [rows] = await pool.execute(sql, [usuario]);

    if (rows.length === 0) {
      return res.status(400).json({
        ok: false,
        message: 'Usuario o contraseña incorrectos.'
      });
    }

    const user = rows[0];

    // Verificar contraseña
    const passwordMatch = await bcrypt.compare(password, user.contrasena_hash);

    if (!passwordMatch) {
      return res.status(400).json({
        ok: false,
        message: 'Usuario o contraseña incorrectos.'
      });
    }

    // Verificar estado de la cuenta
    if (user.estado_cuenta === 'pendiente') {
      return res.status(403).json({
        ok: false,
        message: 'Tu cuenta está pendiente de aprobación. Consultá con el Departamento de Alumnado o el administrador.'
      });
    }

    if (user.estado_cuenta === 'deshabilitado') {
      return res.status(403).json({
        ok: false,
        message: 'Tu cuenta está deshabilitada. Consultá con el Departamento de Alumnado o el administrador.'
      });
    }

    if (user.estado_cuenta !== 'aprobado') {
      return res.status(403).json({
        ok: false,
        message: `Cuenta en estado "${user.estado_cuenta}". Consulte con el administrador.`
      });
    }

    // Si llegó hasta acá, login OK
    return res.json({
      ok: true,
      message: 'Login correcto.',
      idUsuario: user.id_usuario,
      rol: user.rol
    });
  } catch (err) {
    console.error('Error en /api/login:', err);
    return res.status(500).json({
      ok: false,
      message: 'Error interno del servidor.'
    });
  }
});

/* ========================================================================
 *  CURSOS
 * ===================================================================== */

/**
 * GET /api/cursos
 * Lista de cursos
 */
app.get('/api/cursos', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id_curso, nombre_curso FROM cursos ORDER BY nombre_curso ASC'
    );

    return res.json({ ok: true, data: rows });
  } catch (err) {
    console.error('Error en GET /api/cursos:', err);
    return res.status(500).json({
      ok: false,
      message: 'Error al obtener la lista de cursos.'
    });
  }
});

/**
 * POST /api/cursos
 * Crear curso
 */
app.post('/api/cursos', async (req, res) => {
  try {
    const { nombreCurso } = req.body;

    if (!nombreCurso || !nombreCurso.trim()) {
      return res.status(400).json({
        ok: false,
        message: 'El nombre de curso es obligatorio.'
      });
    }

    const sql = 'INSERT INTO cursos (nombre_curso) VALUES (?)';
    const [result] = await pool.execute(sql, [nombreCurso.trim()]);

    return res.status(201).json({
      ok: true,
      message: 'Curso creado correctamente.',
      id_curso: result.insertId
    });
  } catch (err) {
    console.error('Error en POST /api/cursos:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        ok: false,
        message: 'Ya existe un curso con ese nombre.'
      });
    }
    return res.status(500).json({
      ok: false,
      message: 'Error al crear el curso.'
    });
  }
});

/**
 * PUT /api/cursos/:id
 * Actualizar curso
 */
app.put('/api/cursos/:id', async (req, res) => {
  try {
    const idCurso = req.params.id;
    const { nombreCurso } = req.body;

    if (!nombreCurso || !nombreCurso.trim()) {
      return res.status(400).json({
        ok: false,
        message: 'El nombre de curso es obligatorio.'
      });
    }

    const sql = `
      UPDATE cursos
      SET nombre_curso = ?
      WHERE id_curso = ?
    `;
    const [result] = await pool.execute(sql, [nombreCurso.trim(), idCurso]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        ok: false,
        message: 'Curso no encontrado.'
      });
    }

    return res.json({
      ok: true,
      message: 'Curso actualizado correctamente.'
    });
  } catch (err) {
    console.error('Error en PUT /api/cursos/:id:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        ok: false,
        message: 'Ya existe otro curso con ese nombre.'
      });
    }
    return res.status(500).json({
      ok: false,
      message: 'Error al actualizar el curso.'
    });
  }
});

/**
 * DELETE /api/cursos/:id
 * Eliminar curso
 */
app.delete('/api/cursos/:id', async (req, res) => {
  try {
    const idCurso = req.params.id;

    const sql = 'DELETE FROM cursos WHERE id_curso = ?';
    const [result] = await pool.execute(sql, [idCurso]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        ok: false,
        message: 'Curso no encontrado.'
      });
    }

    return res.json({
      ok: true,
      message: 'Curso eliminado correctamente.'
    });
  } catch (err) {
    console.error('Error en DELETE /api/cursos/:id:', err);

    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
      return res.status(409).json({
        ok: false,
        message: 'No se puede eliminar el curso porque hay alumnos asociados.'
      });
    }

    return res.status(500).json({
      ok: false,
      message: 'Error al eliminar el curso.'
    });
  }
});

/* ========================================================================
 *  USUARIOS (ADMIN)
 * ===================================================================== */

/**
 * GET /api/usuarios
 * Lista todos los usuarios
 */
app.get('/api/usuarios', async (req, res) => {
  try {
    const sql = `
      SELECT 
        u.id_usuario,
        u.usuario,
        u.nombre_completo,
        u.email,
        u.dni,
        u.rol,
        c.nombre_curso AS curso,
        u.estado_cuenta
      FROM usuarios u
      LEFT JOIN cursos c ON u.id_curso = c.id_curso
      ORDER BY u.id_usuario ASC
    `;
    const [rows] = await pool.execute(sql);

    return res.json({
      ok: true,
      data: rows
    });
  } catch (err) {
    console.error('Error en GET /api/usuarios:', err);
    return res.status(500).json({
      ok: false,
      message: 'Error al obtener la lista de usuarios.'
    });
  }
});

/**
 * PUT /api/usuarios/:id
 * Actualizar datos de usuario
 */
app.put('/api/usuarios/:id', async (req, res) => {
  try {
    const idUsuario = req.params.id;
    const {
      nombreCompleto,
      email,
      dni,
      rol,
      curso,
      estadoCuenta
    } = req.body;

    if (!nombreCompleto || !email || !dni || !rol || !estadoCuenta) {
      return res.status(400).json({
        ok: false,
        message: 'Faltan datos obligatorios para la actualización.'
      });
    }

    let idCurso = null;

    if (rol === 'alumno') {
      if (curso) {
        const [rowsCurso] = await pool.execute(
          'SELECT id_curso FROM cursos WHERE nombre_curso = ?',
          [curso]
        );

        if (rowsCurso.length === 0) {
          return res.status(400).json({
            ok: false,
            message: `El curso "${curso}" no existe en la tabla cursos.`
          });
        }

        idCurso = rowsCurso[0].id_curso;
      }
    }

    const sql = `
      UPDATE usuarios
      SET 
        nombre_completo = ?,
        email = ?,
        dni = ?,
        rol = ?,
        id_curso = ?,
        estado_cuenta = ?
      WHERE id_usuario = ?
    `;

    const params = [
      nombreCompleto,
      email,
      dni,
      rol,
      idCurso,
      estadoCuenta,
      idUsuario
    ];

    const [result] = await pool.execute(sql, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        ok: false,
        message: 'Usuario no encontrado.'
      });
    }

    return res.json({
      ok: true,
      message: 'Usuario actualizado correctamente.'
    });
  } catch (err) {
    console.error('Error en PUT /api/usuarios/:id:', err);

    if (err.code === 'ER_DUP_ENTRY') {
      let detalle = 'Ya existe un registro con alguno de los datos únicos.';
      if (err.message.includes('email')) detalle = 'El email ya está en uso.';
      else if (err.message.includes('dni')) detalle = 'El DNI ya está registrado.';
      return res.status(409).json({ ok: false, message: detalle });
    }

    return res.status(500).json({
      ok: false,
      message: 'Error al actualizar el usuario.'
    });
  }
});

/**
 * DELETE /api/usuarios/:id
 * Eliminar usuario
 */
app.delete('/api/usuarios/:id', async (req, res) => {
  try {
    const idUsuario = req.params.id;

    const sql = `
      DELETE FROM usuarios
      WHERE id_usuario = ?
    `;
    const [result] = await pool.execute(sql, [idUsuario]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        ok: false,
        message: 'Usuario no encontrado.'
      });
    }

    return res.json({
      ok: true,
      message: 'Usuario eliminado correctamente.'
    });
  } catch (err) {
    console.error('Error en DELETE /api/usuarios/:id:', err);
    return res.status(500).json({
      ok: false,
      message: 'Error al eliminar el usuario.'
    });
  }
});

/**
 * PUT /api/usuarios/:id/password
 * Cambiar contraseña a un valor concreto (usando body.password)
 * (ej: para el panel admin)
 */
app.put('/api/usuarios/:id/password', async (req, res) => {
  try {
    const idUsuario = req.params.id;
    const { password } = req.body;

    if (!password || password.length < 8) {
      return res.status(400).json({
        ok: false,
        message: 'La contraseña nueva es obligatoria y debe tener al menos 8 caracteres.'
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const sql = `
      UPDATE usuarios
      SET contrasena_hash = ?
      WHERE id_usuario = ?
    `;

    const [result] = await pool.execute(sql, [passwordHash, idUsuario]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        ok: false,
        message: 'Usuario no encontrado.'
      });
    }

    return res.json({
      ok: true,
      message: 'Contraseña reiniciada correctamente.'
    });
  } catch (err) {
    console.error('Error en PUT /api/usuarios/:id/password:', err);
    return res.status(500).json({
      ok: false,
      message: 'Error al reiniciar la contraseña.'
    });
  }
});

/**
 * POST /api/usuarios/:id/reset-password
 * Reinicio rápido de contraseña (contraseña temporal generada por el sistema).
 */
app.post('/api/usuarios/:id/reset-password', async (req, res) => {
  try {
    const idUsuario = req.params.id;

    // Contraseña temporal simple
    const nuevaPassPlano = 'Temp' + Math.floor(100000 + Math.random() * 900000);

    const passwordHash = await bcrypt.hash(nuevaPassPlano, 10);

    const sql = `
      UPDATE usuarios
      SET contrasena_hash = ?
      WHERE id_usuario = ?
    `;

    const [result] = await pool.execute(sql, [passwordHash, idUsuario]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        ok: false,
        message: 'Usuario no encontrado.'
      });
    }

    return res.json({
      ok: true,
      message: `Contraseña reiniciada. Nueva contraseña temporal: ${nuevaPassPlano}`
    });
  } catch (err) {
    console.error('Error en POST /api/usuarios/:id/reset-password:', err);
    return res.status(500).json({
      ok: false,
      message: 'Error al reiniciar la contraseña.'
    });
  }
});

/* ========================================================================
 *  ALUMNOS (LISTADO PARA DEPARTAMENTO DE ALUMNADO)
 * ===================================================================== */

/**
 * GET /api/alumnos
 * Lista todos los usuarios con rol 'alumno'
 */
app.get('/api/alumnos', async (req, res) => {
  try {
    const sql = `
      SELECT 
        u.id_usuario,
        u.usuario,
        u.nombre_completo,
        u.dni,
        c.nombre_curso AS curso,
        u.estado_cuenta
      FROM usuarios u
      LEFT JOIN cursos c ON u.id_curso = c.id_curso
      WHERE u.rol = 'alumno'
      ORDER BY c.nombre_curso, u.nombre_completo
    `;

    const [rows] = await pool.execute(sql);

    return res.json({
      ok: true,
      data: rows
    });
  } catch (err) {
    console.error('Error en GET /api/alumnos:', err);
    return res.status(500).json({
      ok: false,
      message: 'Error al obtener la lista de alumnos.'
    });
  }
});

/**
 * GET /api/alumnos/:idUsuario
 * Datos de un alumno (para el panel del propio alumno)
 */
app.get('/api/alumnos/:idUsuario', async (req, res) => {
  try {
    const idUsuario = req.params.idUsuario;

    const sql = `
      SELECT 
        u.id_usuario,
        u.usuario,
        u.nombre_completo,
        u.dni,
        c.nombre_curso AS curso,
        u.estado_cuenta
      FROM usuarios u
      LEFT JOIN cursos c ON u.id_curso = c.id_curso
      WHERE u.rol = 'alumno' AND u.id_usuario = ?
      LIMIT 1
    `;

    const [rows] = await pool.execute(sql, [idUsuario]);

    if (rows.length === 0) {
      return res.status(404).json({
        ok: false,
        message: 'Alumno no encontrado.'
      });
    }

    return res.json({
      ok: true,
      data: rows[0]
    });
  } catch (err) {
    console.error('Error en GET /api/alumnos/:idUsuario:', err);
    return res.status(500).json({
      ok: false,
      message: 'Error al obtener los datos del alumno.'
    });
  }
});

/* ========================================================================
 *  MATERIAS
 * ===================================================================== */

/**
 * GET /api/materias
 * Lista todas las materias
 */
app.get('/api/materias', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id_materia, nombre_materia FROM materias ORDER BY nombre_materia ASC'
    );

    return res.json({ ok: true, data: rows });
  } catch (err) {
    console.error('Error en GET /api/materias:', err);
    return res.status(500).json({
      ok: false,
      message: 'Error al obtener la lista de materias.'
    });
  }
});

/**
 * POST /api/materias
 * Crear materia
 */
app.post('/api/materias', async (req, res) => {
  try {
    const { nombreMateria } = req.body;

    if (!nombreMateria || !nombreMateria.trim()) {
      return res.status(400).json({
        ok: false,
        message: 'El nombre de la materia es obligatorio.'
      });
    }

    const sql = 'INSERT INTO materias (nombre_materia) VALUES (?)';
    const [result] = await pool.execute(sql, [nombreMateria.trim()]);

    return res.status(201).json({
      ok: true,
      message: 'Materia creada correctamente.',
      id_materia: result.insertId
    });
  } catch (err) {
    console.error('Error en POST /api/materias:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        ok: false,
        message: 'Ya existe una materia con ese nombre.'
      });
    }
    return res.status(500).json({
      ok: false,
      message: 'Error al crear la materia.'
    });
  }
});

/**
 * PUT /api/materias/:id
 * Actualizar materia
 */
app.put('/api/materias/:id', async (req, res) => {
  try {
    const idMateria = req.params.id;
    const { nombreMateria } = req.body;

    if (!nombreMateria || !nombreMateria.trim()) {
      return res.status(400).json({
        ok: false,
        message: 'El nombre de la materia es obligatorio.'
      });
    }

    const sql = `
      UPDATE materias
      SET nombre_materia = ?
      WHERE id_materia = ?
    `;
    const [result] = await pool.execute(sql, [nombreMateria.trim(), idMateria]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        ok: false,
        message: 'Materia no encontrada.'
      });
    }

    return res.json({
      ok: true,
      message: 'Materia actualizada correctamente.'
    });
  } catch (err) {
    console.error('Error en PUT /api/materias/:id:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        ok: false,
        message: 'Ya existe otra materia con ese nombre.'
      });
    }
    return res.status(500).json({
      ok: false,
      message: 'Error al actualizar la materia.'
    });
  }
});

/**
 * DELETE /api/materias/:id
 * Eliminar materia
 */
app.delete('/api/materias/:id', async (req, res) => {
  try {
    const idMateria = req.params.id;

    const sql = 'DELETE FROM materias WHERE id_materia = ?';
    const [result] = await pool.execute(sql, [idMateria]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        ok: false,
        message: 'Materia no encontrada.'
      });
    }

    return res.json({
      ok: true,
      message: 'Materia eliminada correctamente.'
    });
  } catch (err) {
    console.error('Error en DELETE /api/materias/:id:', err);
    return res.status(500).json({
      ok: false,
      message: 'Error al eliminar la materia.'
    });
  }
});

/* ========================================================================
 *  BOLETINES
 * ===================================================================== */

/**
 * GET /api/boletines/:idUsuario?anio=YYYY
 * Obtener boletín de un alumno para un año lectivo
 */
app.get('/api/boletines/:idUsuario', async (req, res) => {
  try {
    const idUsuario = req.params.idUsuario;
    const anio = req.query.anio || new Date().getFullYear();

    const sql = `
      SELECT 
        b.id_boletin,
        b.id_materia,
        m.nombre_materia,
        b.anio_lectivo,
        b.p1_1c,
        b.p2_1c,
        b.nf_1c,
        b.p1_2c,
        b.p2_2c,
        b.nf_2c,
        b.nota_anual,
        b.diciembre_acreditacion,
        b.feb_mar_recuperatorio,
        b.nota_definitiva
      FROM boletines b
      INNER JOIN materias m ON b.id_materia = m.id_materia
      WHERE b.id_usuario = ? AND b.anio_lectivo = ?
      ORDER BY m.nombre_materia
    `;

    const [rows] = await pool.execute(sql, [idUsuario, anio]);

    return res.json({
      ok: true,
      anio: Number(anio),
      data: rows
    });
  } catch (err) {
    console.error('Error en GET /api/boletines/:idUsuario:', err);
    return res.status(500).json({
      ok: false,
      message: 'Error al obtener el boletín del alumno.'
    });
  }
});

/**
 * PUT /api/boletines/:idUsuario
 * Guardar/actualizar boletín completo de un año para un alumno
 */
app.put('/api/boletines/:idUsuario', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const idUsuario = req.params.idUsuario;
    const { anio, materias } = req.body;

    if (!anio || !Array.isArray(materias) || materias.length === 0) {
      return res.status(400).json({
        ok: false,
        message: 'Se requiere el año lectivo y al menos una materia.'
      });
    }

    await connection.beginTransaction();

    const sql = `
      INSERT INTO boletines (
        id_usuario,
        id_materia,
        anio_lectivo,
        p1_1c,
        p2_1c,
        nf_1c,
        p1_2c,
        p2_2c,
        nf_2c,
        nota_anual,
        diciembre_acreditacion,
        feb_mar_recuperatorio,
        nota_definitiva
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
      ON DUPLICATE KEY UPDATE
        p1_1c = VALUES(p1_1c),
        p2_1c = VALUES(p2_1c),
        nf_1c = VALUES(nf_1c),
        p1_2c = VALUES(p1_2c),
        p2_2c = VALUES(p2_2c),
        nf_2c = VALUES(nf_2c),
        nota_anual = VALUES(nota_anual),
        diciembre_acreditacion = VALUES(diciembre_acreditacion),
        feb_mar_recuperatorio = VALUES(feb_mar_recuperatorio),
        nota_definitiva = VALUES(nota_definitiva)
    `;

    for (const m of materias) {
      const params = [
        idUsuario,
        m.id_materia,
        anio,
        m.p1_1c ?? null,
        m.p2_1c ?? null,
        m.nf_1c ?? null,
        m.p1_2c ?? null,
        m.p2_2c ?? null,
        m.nf_2c ?? null,
        m.nota_anual ?? null,
        m.diciembre_acreditacion ?? null,
        m.feb_mar_recuperatorio ?? null,
        m.nota_definitiva ?? null
      ];
      await connection.execute(sql, params);
    }

    await connection.commit();

    return res.json({
      ok: true,
      message: 'Boletín guardado/actualizado correctamente.'
    });
  } catch (err) {
    await connection.rollback();
    console.error('Error en PUT /api/boletines/:idUsuario:', err);
    return res.status(500).json({
      ok: false,
      message: 'Error al guardar el boletín del alumno.'
    });
  } finally {
    connection.release();
  }
});

/* ========================================================================
 *  ADMIN INICIAL Y ARRANQUE DEL SERVIDOR
 * ===================================================================== */

/**
 * Crea un usuario administrador inicial si no existe ninguno
 */
async function asegurarAdminInicial() {
  try {
    const [rows] = await pool.execute(
      "SELECT id_usuario FROM usuarios WHERE rol = 'admin' LIMIT 1"
    );

    if (rows.length > 0) {
      console.log('Admin inicial: ya existe al menos un usuario admin.');
      return;
    }

    const usuario = 'admin';
    const passwordPlano = 'Admin123!';
    const nombreCompleto = 'Administrador del sistema';
    const email = 'admin@boletin.local';
    const dni = '00000000';
    const rol = 'admin';

    const passwordHash = await bcrypt.hash(passwordPlano, 10);

    const sql = `
      INSERT INTO usuarios
        (usuario, contrasena_hash, nombre_completo, email, dni, rol, id_curso, estado_cuenta)
      VALUES
        (?, ?, ?, ?, ?, ?, NULL, 'aprobado')
    `;

    await pool.execute(sql, [
      usuario,
      passwordHash,
      nombreCompleto,
      email,
      dni,
      rol
    ]);

    console.log('Admin inicial creado.');
    console.log(`Usuario: ${usuario} | Contraseña: ${passwordPlano}`);
  } catch (err) {
    console.error('Error al asegurar admin inicial:', err);
  }
}

/**
 * Iniciar servidor
 */
async function iniciarServidor() {
  await asegurarAdminInicial();

  app.listen(PORT, () => {
    console.log(`API Boletín Digital escuchando en http://localhost:${PORT}`);
  });
}

iniciarServidor();
