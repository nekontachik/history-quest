// Dynamic import helper for acceptance tests.
//
// Tests import by a runtime-only string so TypeScript's resolver cannot see
// the target (modules may not exist yet at compile time — later tasks build
// them). We go through vitest's import mechanism so its dynamic-import hook
// stays registered and `@/*` aliases resolve.
export function dyn(spec: string): Promise<unknown> {
  return import(/* @vite-ignore */ spec);
}
