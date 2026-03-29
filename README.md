# ISDN — Island-wide Sales Distribution Management System

## Stack
- Frontend : React 18 + TypeScript + Vite
- Backend  : Node.js + Express + TypeScript
- Database : MySQL (via WAMP / mysql2 pool)
- Auth     : JWT + RBAC

## Quick start
1. Start WAMP and create `isdn_db` database
2. Run `database/schema.sql` then `database/seed.sql` in phpMyAdmin
3. Copy `.env.example` → `server/.env` and fill in values
4. `npm install --workspaces`
5. Terminal 1: `npm run dev:server`
6. Terminal 2: `npm run dev:client`
7. Open http://localhost:5173
