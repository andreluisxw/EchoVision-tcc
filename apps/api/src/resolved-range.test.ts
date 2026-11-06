import test from "node:test";
import assert from "node:assert/strict";
import { resolvedRange } from "./resolved-range.js";
test("intervalo usa dias inclusivos de São Paulo", () => {
  assert.deepEqual(
    resolvedRange({
      includeResolved: "true",
      resolvedFrom: "2026-11-08",
      resolvedTo: "2026-11-09",
    }),
    { from: "2026-11-08", to: "2026-11-09" },
  );
  assert.equal(resolvedRange({}), null);
});
test("rejeita datas inexistentes, inversão e mais de noventa dias", () => {
  for (const [from, to] of [
    ["2026-02-30", "2026-03-01"],
    ["2026-11-09", "2026-11-08"],
    ["2026-01-01", "2026-04-01"],
  ]) {
    assert.throws(() =>
      resolvedRange({
        includeResolved: "true",
        resolvedFrom: from,
        resolvedTo: to,
      }),
    );
  }
  assert.ok(
    resolvedRange({
      includeResolved: "true",
      resolvedFrom: "2026-01-01",
      resolvedTo: "2026-03-31",
    }),
  );
});
