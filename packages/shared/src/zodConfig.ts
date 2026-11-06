import { z } from 'zod';

/**
 * NFR-14: the web app's Content Security Policy forbids `eval`. zod probes it with `new Function` when an
 * object schema is *constructed* (caught, but reported as a CSP violation), so jitless must be set before any
 * schema module is evaluated: this module is the first import of index.ts and schemas.ts (DEF-15).
 * Browser only: on the server eval is allowed and zod keeps its faster compiled validators.
 */
if (typeof window !== 'undefined') z.config({ jitless: true });
