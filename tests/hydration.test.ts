import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Hydration guards.
 *
 * These failures share a nasty property: they are invisible to whoever wrote
 * the code. A hydration mismatch only throws for users whose environment
 * differs from the developer's, so it survives every round of local testing
 * and shows up as a console error on someone else's machine.
 */

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

describe("hydration safety", () => {
  const files = sourceFiles("src");

  test("no component branches on framer-motion's raw useReducedMotion", () => {
    /**
     * `useReducedMotion` returns false on the server and the user's real
     * setting in the browser. Any JSX branching on it renders differently on
     * the two sides and React discards the tree — but only for users who have
     * "reduce motion" enabled at the OS level.
     */
    const offenders = files.filter((file) => {
      if (file.endsWith("use-safe-reduced-motion.ts")) return false;
      const text = readFileSync(file, "utf8");
      return /from ["']framer-motion["']/.test(text) && /\buseReducedMotion\b/.test(text);
    });

    assert.deepEqual(
      offenders,
      [],
      `these import useReducedMotion directly; use useSafeReducedMotion instead:\n  ${offenders.join("\n  ")}`,
    );
  });

  test("no render path formats dates or numbers in the ambient locale", () => {
    /**
     * A UTC server and an IST browser disagree on both the day and the
     * formatted string. Passing an explicit locale — `toLocaleString("en-IN")`
     * — is deterministic and fine; omitting it inherits whatever locale the
     * runtime happens to have, which is not.
     */
    const ambient = /\.toLocale(?:Date|Time)?String\(\s*(?:\)|\{)/;
    const offenders: string[] = [];

    for (const file of files) {
      // Strip comments so prose about the hazard is not mistaken for it.
      const text = readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");

      if (ambient.test(text)) offenders.push(file);
    }

    assert.deepEqual(
      offenders,
      [],
      `these format without an explicit locale, so server and client can disagree:\n  ${offenders.join("\n  ")}`,
    );
  });
});
