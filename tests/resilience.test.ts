import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  attemptsFor,
  circuitSnapshot,
  isCircuitOpen,
  recordFailure,
  recordSuccess,
  resetCircuits,
} from "@/lib/data/circuit";
import { formatDate, formatShortDate, formatPercent, formatCompact } from "@/lib/utils/format";

describe("provider circuit breaker", () => {
  beforeEach(() => resetCircuits());

  test("starts closed with a full retry budget", () => {
    assert.equal(isCircuitOpen("angel-history"), false);
    assert.equal(attemptsFor("angel-history"), 3);
  });

  test("opens after repeated failures", () => {
    for (let i = 0; i < 4; i += 1) recordFailure("angel-history");
    assert.equal(isCircuitOpen("angel-history"), true);
  });

  test("stays closed while failures are sporadic", () => {
    recordFailure("angel-quote");
    recordFailure("angel-quote");
    recordSuccess("angel-quote");
    recordFailure("angel-quote");
    assert.equal(isCircuitOpen("angel-quote"), false);
  });

  test("shrinks the retry budget as confidence drops", () => {
    assert.equal(attemptsFor("angel-quote"), 3);
    recordFailure("angel-quote");
    assert.equal(attemptsFor("angel-quote"), 2);
    for (let i = 0; i < 3; i += 1) recordFailure("angel-quote");
    assert.equal(attemptsFor("angel-quote"), 1);
  });

  test("a success closes an open circuit", () => {
    for (let i = 0; i < 5; i += 1) recordFailure("yahoo-summary");
    assert.equal(isCircuitOpen("yahoo-summary"), true);
    recordSuccess("yahoo-summary");
    assert.equal(isCircuitOpen("yahoo-summary"), false);
    assert.equal(attemptsFor("yahoo-summary"), 3);
  });

  test("circuits are independent of each other", () => {
    for (let i = 0; i < 4; i += 1) recordFailure("angel-history");
    assert.equal(isCircuitOpen("angel-history"), true);
    assert.equal(isCircuitOpen("angel-quote"), false);
    assert.equal(isCircuitOpen("yahoo-summary"), false);
  });

  test("snapshot reports what health checks need", () => {
    for (let i = 0; i < 4; i += 1) recordFailure("angel-quote");
    const snap = circuitSnapshot();
    assert.equal(snap["angel-quote"].open, true);
    assert.equal(snap["angel-quote"].consecutiveFailures, 4);
  });
});

describe("hydration-safe formatting", () => {
  /**
   * These ran through `toLocaleDateString`, which formats in the runtime's
   * local timezone. A UTC server and an IST browser could then disagree by a
   * day on the same input, which React reports as a hydration mismatch.
   */
  const ORIGINAL_TZ = process.env.TZ;

  function inZone<T>(tz: string, fn: () => T): T {
    process.env.TZ = tz;
    try {
      return fn();
    } finally {
      process.env.TZ = ORIGINAL_TZ;
    }
  }

  test("formatDate is identical across timezones", () => {
    for (const iso of ["2026-08-13", "2026-01-01T00:00:00.000Z", "2025-12-31T23:59:00.000Z"]) {
      const utc = inZone("UTC", () => formatDate(iso));
      const ist = inZone("Asia/Kolkata", () => formatDate(iso));
      const la = inZone("America/Los_Angeles", () => formatDate(iso));
      assert.equal(utc, ist, `drift between UTC and IST for ${iso}`);
      assert.equal(utc, la, `drift between UTC and Los Angeles for ${iso}`);
    }
  });

  test("formatShortDate is identical across timezones", () => {
    const iso = "2026-08-13T00:00:00.000Z";
    assert.equal(
      inZone("UTC", () => formatShortDate(iso)),
      inZone("Pacific/Auckland", () => formatShortDate(iso)),
    );
  });

  test("formats a known date correctly", () => {
    assert.equal(formatDate("2026-08-13T00:00:00.000Z"), "13 Aug 2026");
    assert.equal(formatShortDate("2026-08-13T00:00:00.000Z"), "13 Aug");
  });

  test("passes through unparseable input rather than throwing", () => {
    assert.equal(formatDate("not a date"), "not a date");
  });

  test("null-tolerant helpers return an em dash", () => {
    assert.equal(formatPercent(null), "—");
    assert.equal(formatCompact(null), "—");
    assert.equal(formatPercent(Number.NaN), "—");
  });
});
