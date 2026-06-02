/**
 * Convert a JSON value to a TypeScript type string.
 * Infers unions, nested objects, arrays, and optional fields.
 *
 * Handles:
 * - string, number, boolean, null → literal types or primitives
 * - arrays → T[]
 * - objects → { key: Type; }
 * - mixed arrays → union types
 * - nested objects → recursive interfaces
 */
export function jsonToTypeScript(json: unknown, name = "Root"): string {
  const interfaces: string[] = [];
  const main = inferType(json, name, interfaces, new Map());
  return [...interfaces, `type ${name} = ${main}`].join("\n\n") + "\n";
}

function inferType(
  value: unknown,
  name: string,
  interfaces: string[],
  seen: Map<object, string>,
): string {
  if (value === null) return "null";
  if (typeof value === "string") return inferStringLiteral(value);
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";

  if (Array.isArray(value)) {
    if (value.length === 0) return "any[]";
    const types = [...new Set(value.map((v) => inferType(v, name, interfaces, seen)))];
    return types.length === 1 ? `${types[0]}[]` : `(${types.join(" | ")})[]`;
  }

  if (typeof value === "object") {
    // Detect circular references
    if (seen.has(value)) return seen.get(value)!;
    seen.set(value, name);

    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return "Record<string, never>";

    const lines: string[] = [];
    for (const [key, val] of entries) {
      const isOptional = val === undefined || val === null;
      const fieldName = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `"${key}"`;
      const typeStr = inferType(val, `${name}_${capitalize(key)}`, interfaces, new Map(seen));
      lines.push(`  ${fieldName}${isOptional ? "?" : ""}: ${isOptional ? typeStr : typeStr}`);
    }

    interfaces.push(`interface ${name} {\n${lines.join(";\n")}\n}`);
    return name;
  }

  return "unknown";
}

function inferStringLiteral(s: string): string {
  // Common patterns that should stay as 'string'
  if (s.length > 80) return "string";
  if (s.includes("\n")) return "string";
  // Try to detect if it looks like a generic string vs a literal
  // Simple heuristic: strings with spaces or common word patterns are literals
  if (/^[a-zA-Z0-9._-]+$/.test(s) && s.length < 20) return `"${s}"`;
  return "string";
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
