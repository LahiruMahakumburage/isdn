import app from './app';
import { env } from './config/env';
import { pool } from './db/connection';
import { logger } from './utils/logger';

const PORT = env.PORT;

// Only start the HTTP server when NOT running as a Vercel serverless function
if (!process.env.VERCEL) {
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
}

export default app;

