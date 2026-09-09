import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { base32Decode, generateTotp, secondsUntilNextWindow } from "@/lib/data/angel/totp";
import { __toInstrumentForTests as toInstrument, resetInstruments } from "@/lib/data/angel/instruments";
import {
  angelStatus,
  isWeekday,
  istNow,
  parseExchangeTime,
  sessionHasOpened,
  todaySessionOpen,
  withTodayBar,
} from "@/lib/data/angel";
import type { Candle } from "@/types";

/**
 * The Angel One integration cannot be exercised end to end without live
 * credentials, so these tests pin down the parts that are pure: the TOTP
 * algorithm, the scrip-master filter, and the behaviour when nothing is
 * configured. Those are also the three places a silent mistake would be
 * hardest to notice — a wrong TOTP just looks like "login failed".
 */

describe("TOTP", () => {
  test("decodes base32, padding and spacing tolerated", () => {
    // "Hello!" in base32 is JBSWY3DPEHPK3PXP -> known byte sequence.
    assert.deepEqual(Array.from(base32Decode("MZXW6===")), [0x66, 0x6f, 0x6f]); // "foo"
    assert.deepEqual(Array.from(base32Decode("mzxw6")), [0x66, 0x6f, 0x6f]);
    assert.deepEqual(Array.from(base32Decode("MZXW 6")), [0x66, 0x6f, 0x6f]);
  });

  test("rejects characters outside the base32 alphabet", () => {
    assert.throws(() => base32Decode("ABC1!"), /Invalid base32/);
  });

  test("matches the RFC 6238 reference vectors", () => {
    // RFC 6238 uses the ASCII secret "12345678901234567890", which is
    // GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ in base32. The published SHA-1 vectors
    // are 8 digits; the first 6 of ours must agree with the last 6 of theirs.
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    const vectors: [number, string][] = [
      [59, "94287082"],
      [1111111109, "07081804"],
      [1111111111, "14050471"],
      [1234567890, "89005924"],
      [2000000000, "69279037"],
    ];

    for (const [atSeconds, expected] of vectors) {
      const code = generateTotp(secret, { atSeconds });
      assert.equal(code, expected.slice(-6), `mismatch at t=${atSeconds}`);
    }
  });

  test("produces six digits, zero-padded", () => {
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    for (let t = 0; t < 20_000; t += 1_337) {
      const code = generateTotp(secret, { atSeconds: t });
      assert.match(code, /^\d{6}$/, `bad code "${code}" at t=${t}`);
    }
  });

  test("is stable within a window and changes across one", () => {
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    // Windows are aligned to multiples of the period, not to the sample time:
    // t=990..1019 is one window, t=1020.. is the next.
    assert.equal(generateTotp(secret, { atSeconds: 990 }), generateTotp(secret, { atSeconds: 1019 }));
    assert.notEqual(generateTotp(secret, { atSeconds: 1019 }), generateTotp(secret, { atSeconds: 1020 }));
  });

  test("rejects an empty secret rather than signing with nothing", () => {
    assert.throws(() => generateTotp(""), /empty/i);
  });

  test("reports time left in the window", () => {
    assert.equal(secondsUntilNextWindow(30, 1000), 20);
    assert.equal(secondsUntilNextWindow(30, 1019), 1);
    assert.equal(secondsUntilNextWindow(30, 1020), 30);
    assert.ok(secondsUntilNextWindow() > 0 && secondsUntilNextWindow() <= 30);
  });
});

describe("scrip master filtering", () => {
  beforeEach(() => resetInstruments());

  const base = { token: "2885", symbol: "RELIANCE-EQ", name: "RELIANCE", exch_seg: "NSE", lotsize: "1" };

  test("accepts NSE cash equities", () => {
    const parsed = toInstrument(base);
    assert.ok(parsed);
    assert.equal(parsed.ticker, "RELIANCE");
    assert.equal(parsed.token, "2885");
    assert.equal(parsed.tradingSymbol, "RELIANCE-EQ");
  });

  test("keeps the trade-to-trade, surveillance and SME series", () => {
    // Excluding these is exactly how symbols went missing before.
    for (const series of ["BE", "BZ", "SM", "ST"]) {
      const parsed = toInstrument({ ...base, symbol: `SOMECO-${series}` });
      assert.ok(parsed, `${series} series should be kept`);
      assert.equal(parsed.ticker, "SOMECO");
    }
  });

  test("rejects other exchanges", () => {
    assert.equal(toInstrument({ ...base, exch_seg: "BSE" }), null);
    assert.equal(toInstrument({ ...base, exch_seg: "NFO" }), null);
  });

  test("rejects derivatives, which carry an expiry", () => {
    assert.equal(toInstrument({ ...base, symbol: "RELIANCE25SEPFUT", expiry: "25SEP2026" }), null);
  });

  test("rejects rows missing a token or symbol", () => {
    assert.equal(toInstrument({ ...base, token: undefined }), null);
    assert.equal(toInstrument({ ...base, symbol: undefined }), null);
  });

  test("rejects index and non-cash series", () => {
    assert.equal(toInstrument({ ...base, symbol: "NIFTY" }), null);
  });

  test("falls back to the ticker when the name is blank", () => {
    const parsed = toInstrument({ ...base, name: "  " });
    assert.equal(parsed?.name, "RELIANCE");
  });
});

describe("index instruments", () => {
  beforeEach(() => resetInstruments());

  /**
   * The dashboard benchmark is `^NSEI`. Angel One calls the same thing
   * "Nifty 50" and gives it no series suffix, so an equity-only filter drops
   * it — which showed up not as an error but as the benchmark quietly
   * rendering generated data. These pin the reconciliation.
   */
  const index = {
    token: "99926000",
    symbol: "Nifty 50",
    name: "NIFTY",
    exch_seg: "NSE",
    instrumenttype: "AMXIDX",
    lotsize: "1",
  };

  test("recognises an index marked AMXIDX", () => {
    const parsed = toInstrument(index);
    assert.ok(parsed);
    assert.equal(parsed.kind, "index");
    assert.equal(parsed.token, "99926000");
    // Spacing and case are collapsed so lookups are stable.
    assert.equal(parsed.ticker, "NIFTY50");
  });

  test("recognises an index by its 99926 token prefix alone", () => {
    const parsed = toInstrument({ ...index, instrumenttype: "" });
    assert.equal(parsed?.kind, "index");
  });

  test("does not mistake an equity for an index", () => {
    const parsed = toInstrument({
      token: "2885",
      symbol: "RELIANCE-EQ",
      name: "RELIANCE",
      exch_seg: "NSE",
      lotsize: "1",
    });
    assert.equal(parsed?.kind, "equity");
  });

  test("still rejects index futures, which carry an expiry", () => {
    assert.equal(toInstrument({ ...index, symbol: "NIFTY25SEPFUT", expiry: "25SEP2026" }), null);
  });
});

describe("angel status when unconfigured", () => {
  test("reports every missing variable by name", () => {
    const saved = {
      ANGEL_API_KEY: process.env.ANGEL_API_KEY,
      ANGEL_CLIENT_CODE: process.env.ANGEL_CLIENT_CODE,
      ANGEL_PIN: process.env.ANGEL_PIN,
      ANGEL_TOTP_SECRET: process.env.ANGEL_TOTP_SECRET,
    };
    for (const key of Object.keys(saved)) delete process.env[key];

    try {
      const status = angelStatus();
      assert.equal(status.configured, false);
      assert.deepEqual(status.missing.sort(), [
        "ANGEL_API_KEY",
        "ANGEL_CLIENT_CODE",
        "ANGEL_PIN",
        "ANGEL_TOTP_SECRET",
      ]);
      // Never throws, even with nothing set — the health endpoint depends on it.
      assert.equal(typeof status.rateLimitHeadroom, "number");
    } finally {
      for (const [key, value] of Object.entries(saved)) {
        if (value !== undefined) process.env[key] = value;
      }
    }
  });

  test("treats blank strings as unset", () => {
    const saved = process.env.ANGEL_API_KEY;
    process.env.ANGEL_API_KEY = "   ";
    try {
      assert.ok(angelStatus().missing.includes("ANGEL_API_KEY"));
    } finally {
      if (saved === undefined) delete process.env.ANGEL_API_KEY;
      else process.env.ANGEL_API_KEY = saved;
    }
  });
});

describe("today's bar", () => {
  /**
   * Angel One's historical feed serves settled candles and can lag the current
   * session by hours — which is why the app showed yesterday's date late in
   * the evening. Today's bar is rebuilt from the quote endpoint instead, and
   * these pin the three cases that must not go wrong.
   */
  const DAY = 24 * 60 * 60 * 1000;
  const bar = (time: number, close: number, volume = 1000): Candle => ({
    time,
    open: close - 2,
    high: close + 3,
    low: close - 4,
    close,
    volume,
  });

  test("appends a genuinely new session", () => {
    const settled = [bar(0, 100), bar(DAY, 101)];
    const out = withTodayBar(settled, bar(2 * DAY, 105));

    assert.equal(out.length, 3);
    assert.equal(out[2].close, 105);
  });

  test("replaces today's bar rather than stacking a second one", () => {
    // An open session keeps moving; a bar written once must not sit frozen.
    const settled = [bar(0, 100), bar(DAY, 101)];
    const out = withTodayBar(settled, bar(DAY, 109));

    assert.equal(out.length, 2, "must not append a duplicate session");
    assert.equal(out[1].close, 109, "must reflect the newer price");
  });

  test("ignores a stale quote on a market holiday", () => {
    // With nothing trading, the quote endpoint keeps returning the previous
    // session's numbers. Stamping those with today's date would invent a bar.
    const yesterday = bar(DAY, 101);
    const stale = { ...yesterday, time: 2 * DAY };

    assert.deepEqual(withTodayBar([bar(0, 100), yesterday], stale), [bar(0, 100), yesterday]);
  });

  test("leaves settled history alone when there is no quote", () => {
    const settled = [bar(0, 100), bar(DAY, 101)];
    assert.equal(withTodayBar(settled, undefined), settled);
  });

  test("never rewinds history that is ahead of the quote", () => {
    const settled = [bar(0, 100), bar(2 * DAY, 105)];
    assert.equal(withTodayBar(settled, bar(DAY, 99)), settled);
  });
});

describe("IST session arithmetic", () => {
  test("reads the civil date in IST, not UTC", () => {
    // 19:00 UTC on 8 Sep is already 00:30 on 9 Sep in India. Getting this
    // wrong is precisely how an evening user sees yesterday's date.
    const parts = istNow(new Date("2026-09-08T19:00:00Z"));
    assert.equal(parts.day, 9);
    assert.equal(parts.month, 9);
  });

  test("today's session opens at 09:15 IST", () => {
    const open = todaySessionOpen(new Date("2026-09-09T17:30:00Z")); // 23:00 IST
    assert.equal(new Date(open).toISOString(), "2026-09-09T03:45:00.000Z");
  });

  test("knows the weekend is not a trading day", () => {
    assert.equal(isWeekday(new Date("2026-09-12T06:00:00Z")), false); // Saturday
    assert.equal(isWeekday(new Date("2026-09-13T06:00:00Z")), false); // Sunday
    assert.equal(isWeekday(new Date("2026-09-09T06:00:00Z")), true); // Wednesday
  });

  test("waits for the opening bell before expecting a bar", () => {
    assert.equal(sessionHasOpened(new Date("2026-09-09T03:00:00Z")), false); // 08:30 IST
    assert.equal(sessionHasOpened(new Date("2026-09-09T03:45:00Z")), true); // 09:15 IST
    assert.equal(sessionHasOpened(new Date("2026-09-09T17:30:00Z")), true); // 23:00 IST
  });
});

describe("exchange feed timestamps", () => {
  /**
   * Dating today's bar from the exchange's own timestamp, rather than the
   * server clock, is what stops a quote served after hours from being stamped
   * with the wrong session.
   */
  test("parses SmartAPI's DD-Mon-YYYY form", () => {
    assert.deepEqual(parseExchangeTime("09-Sep-2026 15:30:00"), { year: 2026, month: 9, day: 9 });
    assert.deepEqual(parseExchangeTime("21-Mar-2024 10:51:22"), { year: 2024, month: 3, day: 21 });
  });

  test("accepts a single-digit day and any month casing", () => {
    assert.deepEqual(parseExchangeTime("1-jan-2026 09:15:00"), { year: 2026, month: 1, day: 1 });
    assert.deepEqual(parseExchangeTime("05-DEC-2025 15:30:00"), { year: 2025, month: 12, day: 5 });
  });

  test("also accepts an ISO timestamp", () => {
    assert.deepEqual(parseExchangeTime("2026-09-09T15:30:00+05:30"), { year: 2026, month: 9, day: 9 });
  });

  test("returns null rather than guessing", () => {
    assert.equal(parseExchangeTime(undefined), null);
    assert.equal(parseExchangeTime(""), null);
    assert.equal(parseExchangeTime("not a date"), null);
    // An unknown month name must not silently become January.
    assert.equal(parseExchangeTime("09-Xyz-2026 15:30:00"), null);
  });
});
