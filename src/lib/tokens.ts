const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

// Largest multiple of ALPHABET.length (36) that fits in a byte; rejection-sample
// above this threshold so the modulo is bias-free.
const REJECT_THRESHOLD = 256 - (256 % ALPHABET.length);

function randomChars(n: number): string {
  let out = "";
  while (out.length < n) {
    const buf = new Uint8Array(n - out.length);
    crypto.getRandomValues(buf);
    for (const b of buf) {
      if (b < REJECT_THRESHOLD) {
        out += ALPHABET[b % ALPHABET.length];
        if (out.length === n) break;
      }
    }
  }
  return out;
}

export function generateToken(): string {
  return `${randomChars(6)}-${randomChars(3)}`;
}
