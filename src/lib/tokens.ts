const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

function randomChars(n: number): string {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < n; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

export function generateToken(): string {
  return `${randomChars(6)}-${randomChars(3)}`;
}
