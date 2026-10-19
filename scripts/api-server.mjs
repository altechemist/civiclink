// Local Node API server (same handler as Vercel, ADR-0006). Use with `VITE_API_BASE=/api`; Vite proxies /api here.
import { createServer } from 'node:http';
import http from '../functions/lib/http.js';

const port = Number(process.env.API_PORT ?? 8787);
createServer((req, res) => void http.handleHttp(req, res)).listen(port, '127.0.0.1', () => console.log(`CivicLink API on http://127.0.0.1:${port}/api`));
