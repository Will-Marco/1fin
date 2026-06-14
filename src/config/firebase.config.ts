import { registerAs } from '@nestjs/config';

/**
 * Normalize a PEM private key coming from an environment variable.
 *
 * Handles the two most common ways the key gets mangled:
 *  - surrounding quotes accidentally kept as part of the value ("...." or '....')
 *  - line breaks stored as the literal two characters `\n` instead of real newlines
 *
 * A malformed key is what triggers firebase-admin's
 * `error:1E08010C:DECODER routines::unsupported` on startup.
 */
export function normalizeFirebasePrivateKey(input?: string): string | undefined {
  if (!input) return undefined;

  let key = input.trim();

  // Strip a single layer of surrounding quotes if present.
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }

  // Convert escaped newlines to real newlines. Also normalize CRLF.
  key = key.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r\n/g, '\n');

  // Trim again so a trailing newline (escaped or real) doesn't vary the output.
  return key.trim();
}

/**
 * Resolve the Firebase private key from the environment.
 *
 * Preferred: FIREBASE_PRIVATE_KEY_BASE64 — the whole PEM base64-encoded, which
 * sidesteps every newline/quoting problem. Falls back to FIREBASE_PRIVATE_KEY
 * with normalization.
 */
export function resolveFirebasePrivateKey(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  if (env.FIREBASE_PRIVATE_KEY_BASE64) {
    return Buffer.from(env.FIREBASE_PRIVATE_KEY_BASE64.trim(), 'base64').toString(
      'utf8',
    );
  }
  return normalizeFirebasePrivateKey(env.FIREBASE_PRIVATE_KEY);
}

export default registerAs('firebase', () => ({
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: resolveFirebasePrivateKey(),
}));
