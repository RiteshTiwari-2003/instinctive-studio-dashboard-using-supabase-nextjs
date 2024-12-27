import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function testConnection() {
  try {
    console.log('Testing PostgreSQL connection...');
    const client = await pool.connect();
    console.log('Successfully connected to PostgreSQL!');

    // Test a simple query
    const result = await client.query('SELECT current_database()');
    console.log('Current database:', result.rows[0]);

    // Check schema permissions
    const schemaResult = await client.query(`
      SELECT schema_name, has_schema_privilege(current_user, schema_name, 'usage') as has_usage,
             has_schema_privilege(current_user, schema_name, 'create') as has_create
      FROM information_schema.schemata
      WHERE schema_name = 'public';
    `);
    console.log('Schema permissions:', schemaResult.rows[0]);

    // Check table permissions
    const tableResult = await client.query(`
      SELECT table_name, has_table_privilege(current_user, table_name, 'SELECT') as has_select,
             has_table_privilege(current_user, table_name, 'INSERT') as has_insert,
             has_table_privilege(current_user, table_name, 'UPDATE') as has_update,
             has_table_privilege(current_user, table_name, 'DELETE') as has_delete
      FROM information_schema.tables
      WHERE table_schema = 'public';
    `);
    console.log('Table permissions:', tableResult.rows);

    client.release();
  } catch (err) {
    console.error('Database connection error:', err);
  } finally {
    pool.end();
  }
}

testConnection();
