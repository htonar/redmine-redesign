import { describe, expect, it } from "vitest";
import { diffFormValues, formatCustomFieldValue } from "@/lib/issue-form";
import type { CustomFieldDefinition } from "@/api/customFields";
import type { Issue } from "@/api/issues";
import type { IssueFormValues } from "@/components/issues/IssueFormFields";

function baseValues(): IssueFormValues {
  return {
    subject: "Тема",
    trackerId: 1,
    priorityId: 2,
    assignedToId: 3,
    categoryId: null,
    fixedVersionId: null,
    startDate: "",
    dueDate: "",
    doneRatio: 0,
    estimatedHours: "",
    description: "",
    customFields: [],
  };
}

describe("diffFormValues", () => {
  it("не включает в патч неизменённые поля", () => {
    const initial = baseValues();
    const current = baseValues();
    expect(diffFormValues(initial, current)).toEqual({});
  });

  it("включает изменённую тему", () => {
    const initial = baseValues();
    const current = { ...baseValues(), subject: "Новая тема" };
    expect(diffFormValues(initial, current)).toEqual({
      subject: "Новая тема",
    });
  });

  it("игнорирует trackerId/priorityId, если текущее значение null", () => {
    const initial = { ...baseValues(), trackerId: 1, priorityId: 2 };
    const current = { ...baseValues(), trackerId: null, priorityId: null };
    expect(diffFormValues(initial, current)).toEqual({});
  });

  it("включает trackerId/priorityId при реальном изменении", () => {
    const initial = { ...baseValues(), trackerId: 1, priorityId: 2 };
    const current = { ...baseValues(), trackerId: 5, priorityId: 7 };
    expect(diffFormValues(initial, current)).toEqual({
      trackerId: 5,
      priorityId: 7,
    });
  });

  it("пустая строка даты/описания превращается в null", () => {
    const initial = {
      ...baseValues(),
      startDate: "2026-01-01",
      dueDate: "2026-01-02",
      description: "было",
    };
    const current = {
      ...baseValues(),
      startDate: "",
      dueDate: "",
      description: "",
    };
    expect(diffFormValues(initial, current)).toEqual({
      startDate: null,
      dueDate: null,
      description: null,
    });
  });

  it("estimatedHours: запятая заменяется на точку, пустая строка - null", () => {
    const initial = baseValues();
    const current1 = { ...baseValues(), estimatedHours: "3,5" };
    expect(diffFormValues(initial, current1)).toEqual({
      estimatedHours: 3.5,
    });

    const initial2 = { ...baseValues(), estimatedHours: "3,5" };
    const current2 = { ...baseValues(), estimatedHours: "" };
    expect(diffFormValues(initial2, current2)).toEqual({
      estimatedHours: null,
    });
  });

  it("customFields: не включает в патч, если не изменились", () => {
    const cf = [{ id: 1, name: "Срочно?", value: "1" }];
    const initial = { ...baseValues(), customFields: cf };
    const current = { ...baseValues(), customFields: cf };
    expect(diffFormValues(initial, current)).toEqual({});
  });

  it("customFields: при изменении патч содержит только id/value", () => {
    const initial = {
      ...baseValues(),
      customFields: [
        {
          id: 1,
          name: "Срочно?",
          value: "0",
          fieldFormat: "bool",
          possibleValues: [{ value: "1", label: "Да" }],
        },
      ],
    };
    const current = {
      ...baseValues(),
      customFields: [
        {
          id: 1,
          name: "Срочно?",
          value: "1",
          fieldFormat: "bool",
          possibleValues: [{ value: "1", label: "Да" }],
        },
      ],
    };
    expect(diffFormValues(initial, current)).toEqual({
      customFields: [{ id: 1, value: "1" }],
    });
  });
});

describe("formatCustomFieldValue", () => {
  const boolDef: CustomFieldDefinition = {
    id: 1,
    name: "Срочно?",
    field_format: "bool",
  } as CustomFieldDefinition;

  const listDef: CustomFieldDefinition = {
    id: 2,
    name: "Окружение",
    field_format: "list",
    possible_values: [
      { value: "prod", label: "Продакшн" },
      { value: "dev", label: "Разработка" },
    ],
  } as CustomFieldDefinition;

  it("bool с определением - '1'/'0' в 'Да'/'Нет'", () => {
    const field = { id: 1, name: "Срочно?", value: "1" } as NonNullable<
      Issue["custom_fields"]
    >[number];
    expect(formatCustomFieldValue(field, [boolDef])).toBe("Да");
    expect(
      formatCustomFieldValue({ ...field, value: "0" }, [boolDef]),
    ).toBe("Нет");
  });

  it("list/enumeration - лейбл из possible_values, не сырое значение", () => {
    const field = { id: 2, name: "Окружение", value: "prod" } as NonNullable<
      Issue["custom_fields"]
    >[number];
    expect(formatCustomFieldValue(field, [listDef])).toBe("Продакшн");
  });

  it("без definitions - честный fallback на сырое значение", () => {
    const field = { id: 1, name: "Срочно?", value: "1" } as NonNullable<
      Issue["custom_fields"]
    >[number];
    expect(formatCustomFieldValue(field, [])).toBe("1");
  });

  it("multiple - значения через запятую", () => {
    const field = {
      id: 2,
      name: "Окружение",
      value: ["prod", "dev"],
      multiple: true,
    } as NonNullable<Issue["custom_fields"]>[number];
    expect(formatCustomFieldValue(field, [listDef])).toBe(
      "Продакшн, Разработка",
    );
  });

  it("пустое значение - прочерк", () => {
    const field = { id: 1, name: "Срочно?", value: "" } as NonNullable<
      Issue["custom_fields"]
    >[number];
    expect(formatCustomFieldValue(field, [boolDef])).toBe("—");
  });
});
