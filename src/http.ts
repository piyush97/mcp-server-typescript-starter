/**
 * HTTP (StreamableHTTPServerTransport) entry point.
 *
 * Run with: bun run dev:http
 *
 * This starts an express server on port 3000 (or process.env.PORT).
 * POST /mcp is the MCP endpoint — wire it into any host that supports
 * streamable HTTP transports (Claude Desktop, Cursor, OpenCode).
 *
 * GET /health returns a basic liveness check.
 *
 * This is the production path. Put nginx in front, add rate limiting,
 * and you have a hosted, shareable MCP server.
 */
import express from "express";
import { readFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { jsonToTypeScript } from "./json-to-ts.js";

const app = express();
app.use(express.json());

// ─── Build the same server ──────────────────────────────────────────────────

function buildServer() {
  const server = new McpServer({
    name: "mcp-typescript-starter",
    version: "0.1.0",
  });

  // Tool: json_to_interface
  server.tool(
    "json_to_interface",
    "Convert a JSON object into a TypeScript type definition.",
    {
      json: z.string().describe("A JSON string to convert"),
      interfaceName: z.string().default("Root").describe("Top-level type name"),
    },
    async ({ json, interfaceName }) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch {
        return {
          content: [{ type: "text", text: "Error: invalid JSON." }],
          isError: true,
        };
      }
      const ts = jsonToTypeScript(parsed, interfaceName);
      return { content: [{ type: "text", text: ts }] };
    },
  );

  // Tool: fetch_url
  server.tool(
    "fetch_url",
    "Fetch a URL and return its text content.",
    {
      url: z.string().url().describe("The URL to fetch"),
      maxLength: z.number().default(5000).describe("Max chars"),
    },
    async ({ url, maxLength }) => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          return {
            content: [{ type: "text", text: `HTTP ${response.status}` }],
            isError: true,
          };
        }
        const text = await response.text();
        const truncated = text.slice(0, maxLength);
        return { content: [{ type: "text", text: truncated }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Fetch failed: ${err}` }],
          isError: true,
        };
      }
    },
  );

  // Resource: README
  server.resource("project-readme", "file://README.md", { description: "Project README" }, async (uri) => {
    try {
      const text = await readFile("README.md", "utf-8");
      return { contents: [{ uri: uri.href, text }] };
    } catch {
      return { contents: [{ uri: uri.href, text: "README not found" }] };
    }
  });

  // Resource: git context
  server.resource("git-context", "git://status", { description: "Git status" }, async (uri) => {
    try {
      const branch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf-8" }).trim();
      const lastCommit = execSync('git log -1 --format="%h %s"', { encoding: "utf-8" }).trim();
      return { contents: [{ uri: uri.href, text: `Branch: ${branch}\nLast commit: ${lastCommit}` }] };
    } catch {
      return { contents: [{ uri: uri.href, text: "Not a git repo" }] };
    }
  });

  return server;
}

// ─── MCP endpoint ───────────────────────────────────────────────────────────

app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => sessionId ?? crypto.randomUUID(),
  });

  const server = buildServer();
  await server.connect(transport);

  // Pass the body to the transport handler
  await transport.handleRequest(req, res, req.body);
});

// ─── Health check ───────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    name: "mcp-typescript-starter",
    version: "0.1.0",
    transport: "streamable-http",
  });
});

// ─── Start ──────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? "3000", 10);
app.listen(PORT, () => {
  console.error(`✅ MCP server listening on http://localhost:${PORT}`);
  console.error(`   POST /mcp — MCP streamable HTTP transport`);
  console.error(`   GET  /health — health check`);
});
