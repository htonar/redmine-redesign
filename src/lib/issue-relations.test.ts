import { describe, expect, it } from "vitest";
import {
  RELATION_TYPE_LABELS,
  RELATION_TYPE_OPTIONS,
  describeIssueRelation,
} from "@/lib/issue-relations";

describe("describeIssueRelation", () => {
  it.each(RELATION_TYPE_OPTIONS)(
    "прямое направление ($value) - собственный лейбл",
    ({ value }) => {
      expect(describeIssueRelation(value, true)).toBe(
        RELATION_TYPE_LABELS[value],
      );
    },
  );

  it("blocks в обратную сторону показывается как blocked", () => {
    expect(describeIssueRelation("blocks", false)).toBe(
      RELATION_TYPE_LABELS.blocked,
    );
  });

  it("blocked в обратную сторону показывается как blocks", () => {
    expect(describeIssueRelation("blocked", false)).toBe(
      RELATION_TYPE_LABELS.blocks,
    );
  });

  it("relates в обратную сторону остаётся relates (симметричный тип)", () => {
    expect(describeIssueRelation("relates", false)).toBe(
      RELATION_TYPE_LABELS.relates,
    );
  });

  it("duplicates/duplicated зеркалятся в обратную сторону", () => {
    expect(describeIssueRelation("duplicates", false)).toBe(
      RELATION_TYPE_LABELS.duplicated,
    );
    expect(describeIssueRelation("duplicated", false)).toBe(
      RELATION_TYPE_LABELS.duplicates,
    );
  });

  it("precedes/follows зеркалятся в обратную сторону", () => {
    expect(describeIssueRelation("precedes", false)).toBe(
      RELATION_TYPE_LABELS.follows,
    );
    expect(describeIssueRelation("follows", false)).toBe(
      RELATION_TYPE_LABELS.precedes,
    );
  });

  it("copied_to/copied_from зеркалятся в обратную сторону", () => {
    expect(describeIssueRelation("copied_to", false)).toBe(
      RELATION_TYPE_LABELS.copied_from,
    );
    expect(describeIssueRelation("copied_from", false)).toBe(
      RELATION_TYPE_LABELS.copied_to,
    );
  });
});
