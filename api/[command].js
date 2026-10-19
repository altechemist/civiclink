// Vercel serverless entry for every command (ADR-0006). The CommonJS bundle is built by `npm run build -w functions`.
import http from '../functions/lib/http.js';

export default http.handleHttp;
