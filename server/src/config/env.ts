import dotenv from 'dotenv';
dotenv.config();

export const env = {
  PORT:                parseInt(process.env.PORT || '5000', 10),
  DB_HOST:             process.env.DB_HOST     || 'localhost',
  DB_PORT:             parseInt(process.env.DB_PORT || '3306', 10),
  DB_USER:             process.env.DB_USER     || 'root',
  DB_PASSWORD:         process.env.DB_PASSWORD || '',
  DB_NAME:             process.env.DB_NAME     || 'isdn_db',
  JWT_SECRET:          process.env.JWT_SECRET  || 'dev_secret',
  JWT_REFRESH_SECRET:  process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret',
  JWT_EXPIRES_IN:      process.env.JWT_EXPIRES_IN     || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  NODE_ENV:            process.env.NODE_ENV    || 'development',
};
