import "server-only";
import { createHmac } from "node:crypto";

/**
 * RFC 6238 TOTP, implemented directly on node:crypto.
 *
 * Angel One's login requires a six-digit TOTP alongside the client code and
 * PIN. Rather than pulling in an authenticator library for one HMAC, this
 * computes it from the base32 secret Angel One shows when you enable TOTP on
 * the account.
 *
 * The secret is the string behind the QR code — the same one you would paste
 * into Google Authenticator. Store it in `ANGEL_TOTP_SECRET`.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Decode a base32 secret (RFC 4648, padding and spacing tolerated). */
export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s-]/g, "").replace(/=+$/, "");
  if (clean.length === 0) return Buffer.alloc(0);

  let bits = 0;
  let value = 0;
  const out: number[] = [];

  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error(`Invalid base32 character "${char}" in TOTP secret.`);
    }
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
    }
  }

  return Buffer.from(out);
}

/**
 * Generate a TOTP code.
 *
 * `atSeconds` exists so the caller can generate the code for the previous or
 * next window. Angel One rejects a code whose window has just rolled over, and
 * retrying instantly with the same code fails again — so the client waits for
 * the next window rather than hammering.
 */
export function generateTotp(
  secret: string,
  { digits = 6, period = 30, atSeconds = Math.floor(Date.now() / 1000) } = {},
): string {
  const key = base32Decode(secret);
  if (key.length === 0) throw new Error("TOTP secret is empty.");

  const counter = Math.floor(atSeconds / period);

  // Counter as a big-endian 8-byte buffer.
  const message = Buffer.alloc(8);
  message.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  message.writeUInt32BE(counter >>> 0, 4);

  const digest = createHmac("sha1", key).update(message).digest();

  // Dynamic truncation (RFC 4226 section 5.4).
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return String(binary % 10 ** digits).padStart(digits, "0");
}

/** Seconds remaining in the current TOTP window. */
export function secondsUntilNextWindow(period = 30, atSeconds = Math.floor(Date.now() / 1000)): number {
  return period - (atSeconds % period);
}
