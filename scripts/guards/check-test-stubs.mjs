#!/usr/bin/env node
// check-test-stubs.mjs — fails when an ACTIVE acceptance test asserts nothing real.
//
// Why: G0 shipped acceptance tests whose bodies only checked
// `typeof mod.fn === "function"`. Flipping `describe.skip` → `describe` then
// turned CI green without testing any behaviour. This guard makes that
// impossible: every test inside a non-skipped `describe("[ID] …")` in
// tests/game/*.test.ts must contain at least one `expect(` that is not an
// existence check (`typeof … ).toBe("function")`, `.toBeDefined()`).
//
// Skipped suites are ignored — they are allowed to be placeholders until
// their task rewrites them with G0-reviewed assertions.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "tests/game";
const EXISTENCE = [/typeof\s+[^)]*\)\s*\.toBe\(\s*["']function["']\s*\)/, /\.toBeDefined\(\)/];

function testBlocks(src) {
  // Split at each test( / test.each(...)( / it( start; good enough for our files.
  const starts = [...src.matchAll(/\n\s*(?:test|it)(?:\.each\([\s\S]*?\]\))?\(\s*[`"']([^`"']*)/g)];
  return starts.map((m, i) => ({
    name: m[1],
    body: src.slice(m.index, i + 1 < starts.length ? starts[i + 1].index : src.length),
  }));
}

const failures = [];
for (const f of readdirSync(DIR).filter((n) => n.endsWith(".test.ts"))) {
  const src = readFileSync(join(DIR, f), "utf-8");
  if (!/\bdescribe\(\s*["']\[/.test(src)) continue; // only active [ID] suites
  for (const { name, body } of testBlocks(src)) {
    const expects = body.split(/\n/).filter((l) => /expect\(/.test(l) || /\)\.(rejects|resolves)\./.test(l));
    const real = expects.filter((l) => !EXISTENCE.some((re) => re.test(l)));
    if (real.length === 0) failures.push(`${f}: "${name}" has no behavioural assertion`);
  }
}

if (failures.length) {
  console.log("❌  stub tests in active acceptance suites:");
  for (const f of failures) console.log("    " + f);
  console.log("\nAn active [ID] test must assert behaviour, not just that an export exists.");
  process.exit(1);
}
console.log("✅  no stub tests in active acceptance suites");
