const fs = require('fs');
const path = require('path');
require('dotenv').config();

const mysql = require('mysql2/promise');

const run = async () => {
  const schemaPath = path.join(__dirname, '..', 'sql', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true
  });

  try {
    await connection.query(schema);
    console.log('Database schema initialized successfully.');
  } finally {
    await connection.end();
  }
};

run().catch((error) => {
  console.error('Failed to initialize database:', error.message);
  process.exit(1);
});
