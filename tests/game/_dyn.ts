// Dynamic import helper for G0 acceptance tests.
//
// The Wave-0 acceptance tests reference modules that do not exist yet
// (T1–T8/I1 build them later). To keep this file type-checking today we
// import by a runtime-only string that the TypeScript resolver cannot see.
// All tests that use this helper are also wrapped in `describe.skip`.
export function dyn(spec: string): Promise<unknown> {
  const importer = new Function("s", "return import(s)") as (
    s: string,
  ) => Promise<unknown>;
  return importer(spec);
}
