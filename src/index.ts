import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import { z } from "zod";
import { jsonToTypeScript } from "./json-to-ts.js";

// ─── Server setup ───────────────────────────────────────────────────────────

const server = new McpServer({
  name: "mcp-typescript-starter",
  version: "0.1.0",
});

// ─── Tool 1: JSON → TypeScript interface ────────────────────────────────────

server.tool(
  "json_to_interface",
  "Convert a JSON object into a TypeScript type definition. Infers unions, nested objects, arrays, and optional fields. Useful for bootstrapping types from API responses.",
  {
    json: z
      .string()
      .describe("A JSON string to convert into TypeScript types"),
    interfaceName: z
      .string()
      .default("Root")
      .describe("Name of the top-level type or interface"),
  },
  async ({ json, interfaceName }) => {
    // Zod validates the shape. We parse inside the handler.
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      return {
        content: [
          {
            type: "text",
            text: "Error: invalid JSON. Make sure your input is valid JSON.",
          },
        ],
        isError: true,
      };
    }

    const ts = jsonToTypeScript(parsed, interfaceName);
    return {
      content: [{ type: "text", text: ts }],
    };
  },
);

// ─── Tool 2: Fetch & summarize a URL ────────────────────────────────────────

server.tool(
  "fetch_url",
  "Fetch a URL and return its text content. Useful for the LLM to read documentation pages or API responses.",
  {
    url: z
      .string()
      .url()
      .describe("The URL to fetch. Must be a valid HTTP or HTTPS URL."),
    maxLength: z
      .number()
      .default(5000)
      .describe("Maximum characters to return from the response body"),
  },
  async ({ url, maxLength }) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        return {
          content: [
            {
              type: "text",
              text: `HTTP ${response.status}: ${response.statusText}`,
            },
          ],
          isError: true,
        };
      }

      const text = await response.text();
      const truncated =
        text.length > maxLength
          ? text.slice(0, maxLength) + `\n\n... (truncated ${text.length - maxLength} chars)`
          : text;

      return {
        content: [
          {
            type: "text",
            text: truncated,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Fetch failed: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// ─── Tool 3: Run a sqlite query (in-memory, with streaming progress) ────────

// Import sqlite lazily so the server still starts without it
let Database: any = null;
async function getDatabase() {
  if (!Database) {
    // Dynamic import so sqlite isn't a hard dependency
    try {
      const mod = await import("node:sqlite");
      Database = mod.DatabaseSync;
    } catch {
      throw new Error(
        "sqlite support requires Node.js ≥ 22.5 with --experimental-sqlite",
      );
    }
  }
  return Database;
}

server.tool(
  "query_sqlite",
  "Run a SQL query against an in-memory SQLite database and return the results. The LLM can use this to explore data, join tables, and run aggregations. Streams progress during long queries.",
  {
    query: z.string().describe("A SQL SELECT query to execute"),
    seedData: z
      .string()
      .optional()
      .describe(
        "Optional SQL DDL/DML to run before the query (e.g. CREATE TABLE, INSERT INTO statements separated by semicolons)",
      ),
  },
  async ({ query, seedData }, extra: any) => {
    const sendProgress = extra?.sendProgress;
    try {
      await sendProgress?.({ progress: 0.1, message: "Connecting to database..." });

      const SqliteDB = await getDatabase();
      const db = new SqliteDB(":memory:");

      // Run seed data if provided
      if (seedData) {
        await sendProgress?.({ progress: 0.3, message: "Seeding database..." });
        const statements = seedData
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean);
        for (const stmt of statements) {
          db.exec(stmt);
        }
      }

      await sendProgress?.({ progress: 0.6, message: "Running query..." });

      // Run the actual query
      const rows = db.prepare(query).all();

      await sendProgress?.({ progress: 1, message: "Done" });

      db.close();

      if (rows.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "Query returned 0 rows.",
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(rows, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `SQL error: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// ─── Resource 1: Project README ─────────────────────────────────────────────

server.resource(
  "project-readme",
  "file://README.md",
  {
    description:
      "The project README. The LLM always has access to this — useful for understanding the server's capabilities and conventions.",
  },
  async (uri) => {
    try {
      const text = await readFile("README.md", "utf-8");
      return {
        contents: [
          {
            uri: uri.href,
            text,
          },
        ],
      };
    } catch {
      return {
        contents: [
          {
            uri: uri.href,
            text: "README.md not found. Create one to make this resource useful.",
          },
        ],
      };
    }
  },
);

// ─── Resource 2: Git branch info ────────────────────────────────────────────

server.resource(
  "git-context",
  "git://status",
  {
    description:
      "Current git status of the project — branch, last commit, and working tree state. The LLM can use this to stay aware of repo context without the user typing git status.",
  },
  async (uri) => {
    try {
      const branch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf-8" }).trim();
      const lastCommit = execSync('git log -1 --format="%h %s"', { encoding: "utf-8" }).trim();
      const status = execSync("git status --short", { encoding: "utf-8" }).trim();

      return {
        contents: [
          {
            uri: uri.href,
            text: [
              `Branch: ${branch}`,
              `Last commit: ${lastCommit}`,
              status ? `\nWorking tree:\n${status}` : "Working tree: clean",
            ].join("\n"),
          },
        ],
      };
    } catch {
      return {
        contents: [
          {
            uri: uri.href,
            text: "Not a git repository, or git is not available.",
          },
        ],
      };
    }
  },
);

// ─── Prompt: Review PR ──────────────────────────────────────────────────────

server.prompt(
  "review-pr",
  "Review a pull request using project-specific contribution guidelines. The LLM loads the prompt template and fills in the PR number.",
  {
    prNumber: z
      .string()
      .describe("The pull request number to review"),
    repo: z
      .string()
      .optional()
      .describe("GitHub repo in owner/name format (defaults to current repo)"),
  },
  ({ prNumber, repo }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: [
            `Review pull request #${prNumber}${repo ? ` in ${repo}` : ""}.`,
            "",
            "Please follow these guidelines:",
            "- Check for type safety — are Zod schemas validating inputs?",
            "- Look for missing error handling in async functions",
            "- Verify that tool descriptions are clear enough for an LLM to understand",
            "- Check for hardcoded credentials or secrets in example code",
            "- Flag any transport-specific assumptions that should be configurable",
            "",
            "Format your review as:",
            "## Summary",
            "## Issues (blocking)",
            "## Suggestions (non-blocking)",
            "## Questions",
          ].join("\n"),
        },
      },
    ],
  }),
);

// ─── Start ──────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // stderr is for logs; stdout is the JSON-RPC channel
  console.error("✅ 3 tools, 2 resources, 1 prompt ready");
  console.error("   stdio transport — wire into Claude Desktop or Cursor");
}

main().catch((err) => {
  console.error("Server failed to start:", err);
  process.exit(1);
});
