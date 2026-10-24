import db from '../config/database';

console.log('DB CONFIG:', {
  database: db.config.database,
  host: db.config.host,
  port: db.config.port,
  username: db.config.username,
});
