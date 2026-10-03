# MCP Server TypeScript Starter

[![CI](https://github.com/piyush97/mcp-server-typescript-starter/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/piyush97/mcp-server-typescript-starter/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](tsconfig.json)
[![MCP](https://img.shields.io/badge/MCP-Server-6366f1)](https://modelcontextprotocol.io)

A production-grade [Model Context Protocol](https://modelcontextprotocol.io) server starter in TypeScript. Three tools, two resources, one prompt, streaming progress, Zod validation, and dual transport (stdio + HTTP).

**Write-up:** [Building an MCP Server in TypeScript: From Zero to Tool-Calling Agent in 90 Minutes](https://piyushmehta.com/blog/building-mcp-server-typescript)

## Quick start

```bash
# Clone
git clone https://github.com/piyush97/mcp-server-typescript-starter
cd mcp-server-typescript-starter

# Install dependencies
bun install

# Run (stdio — for Claude Desktop, Cursor, OpenCode)
bun run dev

# Or run HTTP (for hosted/sharable deployment)
bun run dev:http
```

## What you get

### 3 Tools

| Tool | What it does | LLM decides to call it? |
|------|-------------|------------------------|
| `json_to_interface` | Convert JSON → TypeScript types | Yes — based on user intent |
| `fetch_url` | Fetch and return page text | Yes — when the LLM needs docs |
| `query_sqlite` | Run SQL against in-memory DB | Yes — for data exploration |

### 2 Resources

| Resource | URI | LLM always has access? |
|----------|-----|----------------------|
| project-readme | `file://README.md` | Yes |
| git-context | `git://status` | Yes |

### 1 Prompt

| Prompt | Trigger | What happens |
|--------|---------|-------------|
| `review-pr` | User types `/review-pr` | Structured PR review with guidelines |

### Streaming progress

The `query_sqlite` tool streams progress notifications back to the LLM host — no more 30-second spinner when a query is running.

## Wire it into your host

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "typescript-starter": {
      "command": "bun",
      "args": ["run", "dev"],
      "cwd": "/absolute/path/to/mcp-server-typescript-starter"
    }
  }
}
```

### Cursor

Add to Cursor → Settings → MCP:

```json
{
  "mcpServers": {
    "typescript-starter": {
      "command": "bun",
      "args": ["/absolute/path/to/mcp-server-typescript-starter/src/index.ts"]
    }
  }
}
```

### OpenCode

```bash
opencode mcp add typescript-starter -- bun run dev
```

## Transport decision

| Transport | When | Tradeoff |
|-----------|------|----------|
| **stdio** (`bun run dev`) | Local dev, one user | Zero network, zero auth, zero ops |
| **HTTP** (`bun run dev:http`) | Hosted, multi-tenant | Auth needed, but shareable |

Start with stdio. Move to HTTP the day someone other than you needs to install the server.

## Project structure

```
src/
  index.ts         — stdio entry point (3 tools, 2 resources, 1 prompt)
  http.ts          — HTTP entry point (same server, express transport)
  json-to-ts.ts    — JSON → TypeScript type inference engine
```

## Dependencies

- `@modelcontextprotocol/sdk` — MCP protocol + transport
- `zod` — Runtime validation (your security boundary)
- `express` — HTTP transport only (not needed for stdio)
- `bun` — Runtime (Node.js also works, change `bun` to `tsx` in scripts)

## Why this exists

Every MCP server I've shipped has the same bones: tools, resources, prompts, Zod schemas, and a transport decision. This repo is the template I wish I had when I started. Clone it, swap the tools for your own, and ship in 90 minutes.

---

Built by [Piyush Mehta](https://piyushmehta.com) · [@piyush97](https://github.com/piyush97)
