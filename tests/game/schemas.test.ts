// Schema unit tests — not skipped. Every rule in validateDeck has one
// invalid fixture that must trip exactly that rule, by name.

import { describe, expect, test } from "vitest";

import { ROLES } from "@/constants/game";
import { validateDeck } from "@/shared/game/schemas";

import deckValid from "@/tests/fixtures/game/deck.valid.json";
import deckInvalidSize from "@/tests/fixtures/game/deck.invalid.size.json";
import deckInvalidEffectsRange from "@/tests/fixtures/game/deck.invalid.effects-range.json";
import deckInvalidEffectsCount from "@/tests/fixtures/game/deck.invalid.effects-count.json";
import deckInvalidConflictCap from "@/tests/fixtures/game/deck.invalid.conflict-cap.json";
import deckInvalidRealEvent from "@/tests/fixtures/game/deck.invalid.realevent-min.json";
import deckInvalidRole from "@/tests/fixtures/game/deck.invalid.role.json";
import deckInvalidNonInteger from "@/tests/fixtures/game/deck.invalid.non-integer.json";

describe("validateDeck", () => {
  test("valid 1648 deck passes", () => {
    const res = validateDeck(deckValid, ROLES);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.deck).toHaveLength(12);
    }
  });

  test("size rule: 11 cards fails with a size error", () => {
    const res = validateDeck(deckInvalidSize, ROLES);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.some((e) => /size/i.test(e))).toBe(true);
    }
  });

  test("effects range rule: effect of 30 fails with a range error", () => {
    const res = validateDeck(deckInvalidEffectsRange, ROLES);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.some((e) => /effects range/i.test(e))).toBe(true);
    }
  });

  test("effects count rule: 4 effects on one option fails with a count error", () => {
    const res = validateDeck(deckInvalidEffectsCount, ROLES);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.some((e) => /effects count/i.test(e))).toBe(true);
    }
  });

  test("conflict cap rule: 4 cards of the same conflictType fails", () => {
    const res = validateDeck(deckInvalidConflictCap, ROLES);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.some((e) => /conflict/i.test(e))).toBe(true);
    }
  });

  test("realEvent rule: fewer than 4 realEventRef cards fails", () => {
    const res = validateDeck(deckInvalidRealEvent, ROLES);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.some((e) => /realEvent/i.test(e))).toBe(true);
    }
  });

  test("role rule: a roleId outside ROLES fails", () => {
    const res = validateDeck(deckInvalidRole, ROLES);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.some((e) => /role/i.test(e))).toBe(true);
    }
  });

  test("effects integer rule: a non-integer effect fails", () => {
    const res = validateDeck(deckInvalidNonInteger, ROLES);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.some((e) => /integer/i.test(e))).toBe(true);
    }
  });

  test("grounding rule: every realEventRef must be a sourced event of the year", () => {
    const refs = Array.from(
      new Set(
        (deckValid as Array<{ realEventRef?: string }>)
          .map((c) => c.realEventRef)
          .filter((r): r is string => !!r),
      ),
    );
    expect(validateDeck(deckValid, ROLES, refs).ok).toBe(true);
    const res = validateDeck(deckValid, ROLES, refs.slice(1));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.some((e) => /grounding/i.test(e) && e.includes(refs[0]))).toBe(true);
    }
  });
});
