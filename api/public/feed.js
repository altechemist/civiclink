// Public home feed: open issues and active alerts (FR-38), cached by Vercel's CDN (NFR-13). Same handler as the command API.
import http from '../../functions/lib/http.js';

export default http.handleHttp;
