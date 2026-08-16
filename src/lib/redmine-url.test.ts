import { describe, expect, it } from "vitest";
import { issueUrl, projectUrl } from "./redmine-url";

describe("issueUrl", () => {
  it("строит ссылку на задачу в веб-Redmine", () => {
    expect(issueUrl("https://redmine.example.com", 42)).toBe(
      "https://redmine.example.com/issues/42",
    );
  });
});

describe("projectUrl", () => {
  it("строит ссылку на проект по числовому id", () => {
    expect(projectUrl("https://redmine.example.com", 7)).toBe(
      "https://redmine.example.com/projects/7",
    );
  });

  it("строит ссылку на проект по строковому identifier", () => {
    expect(projectUrl("https://redmine.example.com", "acme-website")).toBe(
      "https://redmine.example.com/projects/acme-website",
    );
  });
});
