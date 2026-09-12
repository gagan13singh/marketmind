import "server-only";

/**
 * Build a `Cookie` request header from a response's `Set-Cookie` headers.
 *
 * This exists because getting it wrong is silent, and it was wrong in two
 * places. The broken version joined the whole `getSetCookie()` array into one
 * string with "; ", then split that on commas and took the part before the
 * first semicolon of each piece. On a response carrying three cookies:
 *
 *   getSetCookie() -> ["nsit=abc; Path=/; HttpOnly",
 *                      "nseappid=xyz; Path=/; Secure",
 *                      "bm_sv=dead; Path=/"]
 *   joined         -> "nsit=abc; Path=/; HttpOnly; nseappid=xyz; Path=/; ..."
 *   split(";")[0]  -> "nsit=abc"
 *
 * Every cookie after the first is discarded. The request then goes out with a
 * partial jar and the server answers 401 — which looks exactly like bad
 * credentials or an IP block, and is neither. NSE needs both `nsit` and
 * `nseappid`; Yahoo needs its consent cookies alongside the crumb.
 *
 * The correct handling is to treat each `Set-Cookie` header as its own cookie,
 * and only fall back to comma-splitting for the legacy single-header case
 * where several cookies really are folded into one value.
 */

/** Attributes that are cookie metadata, not cookies. */
const ATTRIBUTES = /^(path|expires|domain|max-age|secure|httponly|samesite|priority|partitioned)=?$/i;

/**
 * Splitting a folded `Set-Cookie` value is genuinely ambiguous, because
 * `Expires` contains a comma ("Expires=Wed, 09 Jun 2027"). The lookahead
 * requires a `name=` to follow the comma, which the day-of-week in a date does
 * not satisfy.
 */
const FOLDED_SEPARATOR = /,(?=\s*[^;=\s]+\s*=)/;

export function buildCookieJar(headers: Headers): string {
  // Node and the browser both expose getSetCookie(); older runtimes do not.
  const individual = headers.getSetCookie?.() ?? [];
  const rawEntries = individual.length > 0 ? individual : [headers.get("set-cookie") ?? ""];

  /**
   * Split each header value as well as iterating them.
   *
   * `getSetCookie()` returns one element per Set-Cookie header, which is
   * usually one cookie each — but a proxy is free to fold several into a
   * single header, and then the whole set arrives as one element. Iterating
   * without also splitting handles the first case and loses everything after
   * the first cookie in the second, which is the same silent truncation this
   * module exists to prevent. Doing both is correct for either shape.
   */
  const entries = rawEntries.flatMap((value) => value.split(FOLDED_SEPARATOR));

  const seen = new Map<string, string>();

  for (const entry of entries) {
    const pair = entry.split(";")[0]?.trim();
    if (!pair || !pair.includes("=")) continue;
    if (ATTRIBUTES.test(pair.split("=")[0].trim())) continue;

    const name = pair.slice(0, pair.indexOf("=")).trim();
    if (!name) continue;

    // A later header for the same name supersedes an earlier one, which is how
    // a server rotates a session cookie within a single response.
    seen.set(name, pair);
  }

  return [...seen.values()].join("; ");
}
