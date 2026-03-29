// Vercel serverless function entry point.
// The TypeScript build compiles server/src → server/dist.
// This file is committed so Vercel's function validator can find it at
// build time; it re-exports the compiled Express app as the handler.
module.exports = require('../server/dist/index.js');
