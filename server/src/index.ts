import app from './app';
import { env } from './config/env';
import { pool } from './db/connection';
import { logger } from './utils/logger';

const PORT = env.PORT;

pool.getConnection()
  .then(conn => {
    conn.release();
    logger.info('MySQL connection pool established');
    app.listen(PORT, () => logger.info(`Server running on http://localhost:${PORT}`));
  })
  .catch(err => {
    logger.error('Failed to connect to MySQL:', err);
    process.exit(1);
  });
