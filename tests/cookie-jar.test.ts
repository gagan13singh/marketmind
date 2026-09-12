import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildCookieJar } from "@/lib/data/cookie-jar";

/**
 * Regression tests for a bug whose only symptom was a 401.
 *
 * The broken version joined every Set-Cookie header into one string and then
 * split it on commas, keeping the part before the first semicolon. That kept
 * the FIRST cookie and silently discarded the rest, so requests went out with
 * a partial jar and the server refused them — which reads as bad credentials
 * or an IP block, and is neither. It affected both the NSE client and the
 * Yahoo client, so the fundamentals page had two independent reasons to fall
 * back to sample data.
 */
describe("cookie jar", () => {
  function headersWith(...cookies: string[]): Headers {
    const h = new Headers();
    for (const c of cookies) h.append("set-cookie", c);
    return h;
  }

  it("keeps every cookie, not just the first", () => {
    const jar = buildCookieJar(
      headersWith(
        "nsit=abc123; Path=/; HttpOnly",
        "nseappid=xyz789; Path=/; Secure",
        "bm_sv=deadbeef; Path=/",
      ),
    );

    assert.ok(jar.includes("nsit=abc123"), "first cookie missing");
    assert.ok(jar.includes("nseappid=xyz789"), "second cookie missing — this is the bug");
    assert.ok(jar.includes("bm_sv=deadbeef"), "third cookie missing — this is the bug");
    assert.equal(jar.split(";").length, 3, `expected 3 pairs, got "${jar}"`);
  });

  it("drops attributes rather than sending them as cookies", () => {
    const jar = buildCookieJar(
      headersWith("session=1; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=3600"),
    );
    assert.equal(jar, "session=1");
    for (const attr of ["Path", "HttpOnly", "Secure", "SameSite", "Max-Age"]) {
      assert.ok(!jar.includes(attr), `${attr} leaked into the jar`);
    }
  });

  it("survives an Expires date, which contains a comma", () => {
    // The legacy single-header path splits on commas. A date like
    // "Wed, 09 Jun 2027" must not be mistaken for a cookie boundary.
    const h = new Headers();
    h.set("set-cookie", "a=1; Expires=Wed, 09 Jun 2027 10:18:14 GMT; Path=/, b=2; Path=/");
    const jar = buildCookieJar(h);

    assert.ok(jar.includes("a=1"), "first cookie lost to the date comma");
    assert.ok(jar.includes("b=2"), "second cookie lost");
    assert.ok(!/Jun|GMT|Expires/.test(jar), `date fragment leaked: "${jar}"`);
  });

  it("lets a later header supersede an earlier one for the same name", () => {
    const jar = buildCookieJar(headersWith("session=old; Path=/", "session=new; Path=/"));
    assert.equal(jar, "session=new");
  });

  it("returns an empty string when nothing was set", () => {
    assert.equal(buildCookieJar(new Headers()), "");
  });
});
