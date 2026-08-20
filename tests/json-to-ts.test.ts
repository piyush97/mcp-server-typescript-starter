import { describe, expect, it } from "vitest";
import { jsonToTypeScript } from "../src/json-to-ts.js";

describe("jsonToTypeScript (json_to_interface tool)", () => {
  it("converts a flat JSON object into a TypeScript interface", () => {
    const input = { name: "Ada", age: 37 };
    const output = jsonToTypeScript(input, "User");

    expect(output).toContain("interface User {");
    expect(output).toContain('name: "Ada"');
    expect(output).toContain("age: number");
  });

  it("infers literal types for short, identifier-like strings", () => {
    const input = { status: "active" };
    const output = jsonToTypeScript(input, "Response");

    expect(output).toContain('status: "active"');
  });

  it("keeps long and multi-line strings as plain string types", () => {
    const longString = "x".repeat(100);
    const multiLine = "line one\nline two";
    const output = jsonToTypeScript(
      { long: longString, multi: multiLine },
      "Text",
    );

    expect(output).toContain("long: string");
    expect(output).toContain("multi: string");
  });

  it("infers nested objects as recursive interfaces", () => {
    const input = { user: { id: 1, tags: ["a", "b"] } };
    const output = jsonToTypeScript(input, "Root");

    expect(output).toContain("interface Root_User {");
    expect(output).toContain("id: number");
    expect(output).toContain('tags: ("a" | "b")[]');
    expect(output).toContain("type Root = Root");
  });

  it("treats null fields as optional", () => {
    const input = { maybe: null };
    const output = jsonToTypeScript(input, "Nullable");

    expect(output).toContain("maybe?: null");
  });

  it("handles empty objects and arrays", () => {
    expect(jsonToTypeScript({}, "Empty")).toContain("type Empty = Record<string, never>");
    expect(jsonToTypeScript([], "EmptyArr")).toContain("type EmptyArr = any[]");
  });

  it("returns an error-safe type for primitive JSON values", () => {
    expect(jsonToTypeScript(42, "Num")).toContain("type Num = number");
    expect(jsonToTypeScript(true, "Bool")).toContain("type Bool = boolean");
  });
});
