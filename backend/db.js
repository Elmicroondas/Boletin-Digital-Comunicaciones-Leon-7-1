const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'cheadminbd',        // ajustá según tu XAMPP
  password: '-*WMUzIT891b3)a[',        // ajustá si tenés contraseña
  database: 'boletin_digital',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;

