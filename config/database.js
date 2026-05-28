const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PGHOST,
  port: parseInt(process.env.PGPORT),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: { rejectUnauthorized: false }
});

// Log connection details (for debugging)
console.log('🔄 Connecting to PostgreSQL...');
console.log(`   Host: ${process.env.PGHOST}`);
console.log(`   Port: ${process.env.PGPORT}`);
console.log(`   User: ${process.env.PGUSER}`);
console.log(`   Database: ${process.env.PGDATABASE}`);

// Test connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database Connection FAILED:', err.message);
    console.error('Error Code:', err.code);
  } else {
    console.log('✅ Database Connected Successfully!');
    console.log('   Time:', res.rows[0].now);
  }
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client:', err.message);
});

module.exports = pool;
