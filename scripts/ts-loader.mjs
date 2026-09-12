import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Resolver hook that teaches plain Node what the bundler already knows.
 *
 * Next.js resolves two things that bare Node does not: the `@/*` -> `./src/*`
 * alias from tsconfig, and extensionless relative imports like
 * `./cookie-jar`. Anything running application modules outside Next — the unit
 * tests and the fundamentals ingest — needs both taught to it, or the import
 * fails with ERR_MODULE_NOT_FOUND on code that compiles and runs fine in the
 * app. Shared by `npm test` and `npm run ingest:fundamentals` so the two
 * cannot drift apart.
 */

const ROOT = path.resolve(import.meta.dirname, "..");  // repo root, from scripts/
const SRC = path.join(ROOT, "src");

/** Try a base path with the extensions bundlers add implicitly. */
function resolveFile(base) {
  const candidates = [`${base}.ts`, `${base}.tsx`, base, path.join(base, "index.ts"), path.join(base, "index.tsx")];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      try {
        // Skip directories — only return real files.
        if (!path.extname(candidate)) continue;
        return candidate;
      } catch {
        continue;
      }
    }
  }
  return null;
}

/**
 * `server-only` throws on import outside a React Server Component. That guard
 * is exactly what we want in the app and exactly what we do not want in a unit
 * test, so it resolves to an empty module here.
 */
const SERVER_ONLY_STUB = "data:text/javascript,export{}";

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only" || specifier === "client-only") {
    return { url: SERVER_ONLY_STUB, shortCircuit: true };
  }

  // "@/lib/foo" -> "<root>/src/lib/foo"
  if (specifier.startsWith("@/")) {
    const found = resolveFile(path.join(SRC, specifier.slice(2)));
    if (found) return { url: pathToFileURL(found).href, shortCircuit: true };
  }

  // "./universe" -> "./universe.ts" (bundlers infer the extension; Node does not)
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && !path.extname(specifier)) {
    const parentPath = context.parentURL ? path.dirname(new URL(context.parentURL).pathname) : ROOT;
    const found = resolveFile(path.resolve(parentPath, specifier));
    if (found) return { url: pathToFileURL(found).href, shortCircuit: true };
  }

  return nextResolve(specifier, context);
}
