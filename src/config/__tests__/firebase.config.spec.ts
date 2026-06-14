import {
  normalizeFirebasePrivateKey,
  resolveFirebasePrivateKey,
} from '../firebase.config';

// Canonical normalized form (no trailing newline — normalization trims it,
// which is harmless: firebase-admin parses the PEM either way).
const PEM = '-----BEGIN PRIVATE KEY-----\nMIIEabc\nDEFghi\n-----END PRIVATE KEY-----';

describe('normalizeFirebasePrivateKey', () => {
  it('returns undefined for empty input', () => {
    expect(normalizeFirebasePrivateKey(undefined)).toBeUndefined();
    expect(normalizeFirebasePrivateKey('')).toBeUndefined();
  });

  it('converts literal \\n into real newlines', () => {
    const raw =
      '-----BEGIN PRIVATE KEY-----\\nMIIEabc\\nDEFghi\\n-----END PRIVATE KEY-----\\n';
    expect(normalizeFirebasePrivateKey(raw)).toBe(PEM);
  });

  it('strips surrounding double quotes kept in the value', () => {
    const raw =
      '"-----BEGIN PRIVATE KEY-----\\nMIIEabc\\nDEFghi\\n-----END PRIVATE KEY-----\\n"';
    expect(normalizeFirebasePrivateKey(raw)).toBe(PEM);
  });

  it('strips surrounding single quotes kept in the value', () => {
    const raw =
      "'-----BEGIN PRIVATE KEY-----\\nMIIEabc\\nDEFghi\\n-----END PRIVATE KEY-----\\n'";
    expect(normalizeFirebasePrivateKey(raw)).toBe(PEM);
  });

  it('leaves an already-valid PEM (real newlines) untouched', () => {
    expect(normalizeFirebasePrivateKey(PEM)).toBe(PEM);
  });

  it('normalizes escaped CRLF (\\r\\n) to \\n', () => {
    const raw =
      '-----BEGIN PRIVATE KEY-----\\r\\nMIIEabc\\r\\nDEFghi\\r\\n-----END PRIVATE KEY-----\\r\\n';
    expect(normalizeFirebasePrivateKey(raw)).toBe(PEM);
  });
});

describe('resolveFirebasePrivateKey', () => {
  it('prefers the base64 key when provided', () => {
    const env = {
      FIREBASE_PRIVATE_KEY_BASE64: Buffer.from(PEM, 'utf8').toString('base64'),
      FIREBASE_PRIVATE_KEY: 'ignored-garbage',
    } as unknown as NodeJS.ProcessEnv;

    expect(resolveFirebasePrivateKey(env)).toBe(PEM);
  });

  it('falls back to the normalized raw key', () => {
    const env = {
      FIREBASE_PRIVATE_KEY:
        '-----BEGIN PRIVATE KEY-----\\nMIIEabc\\nDEFghi\\n-----END PRIVATE KEY-----\\n',
    } as unknown as NodeJS.ProcessEnv;

    expect(resolveFirebasePrivateKey(env)).toBe(PEM);
  });

  it('returns undefined when nothing is configured', () => {
    expect(resolveFirebasePrivateKey({} as NodeJS.ProcessEnv)).toBeUndefined();
  });
});
