// Scheduled SLA escalation and auto-close (FR-13, FR-14). Called by Vercel Cron (daily) and GitHub Actions (hourly).
import http from '../../functions/lib/http.js';

export default http.handleHttp;
