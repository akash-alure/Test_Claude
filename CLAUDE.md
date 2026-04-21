# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run setup        # Install deps, generate Prisma client, run migrations
npm run dev          # Dev server with Turbopack
npm run build        # Production build
npm run test         # Run tests with Vitest
npm run lint         # ESLint with next/core-web-vitals
npm run db:reset     # Force reset SQLite database
```

Run a single test file: `npx vitest run src/path/to/__tests__/file.test.ts`

## Environment Variables

```
ANTHROPIC_API_KEY   # Optional — falls back to MockLanguageModel without it
JWT_SECRET          # Required for session signing (defaults to a dev key)
```

## Architecture

UIGen is an AI-powered React component generator with live preview. Users describe a component, Claude streams code using tool calls, and the result renders in a sandboxed iframe — no disk writes, ever.

### Data Flow

```
User message → ChatContext (useChat) → POST /api/chat
    → Claude (streamText) with tools → VirtualFileSystem (in-memory)
    → FileSystemContext → PreviewFrame (Babel JSX transform + iframe blob URL)
```

### Core Abstractions

**VirtualFileSystem** (`src/lib/file-system.ts`): All generated files live here, in memory. Serialized as JSON when persisting to SQLite via Prisma. Never touches disk.

**AI Tools** (defined in `src/app/api/chat/route.ts`):
- `str_replace_editor`: view / create / str_replace / insert on virtual files
- `file_manager`: rename and delete

**Preview Pipeline** (`src/components/preview/PreviewFrame.tsx` + `src/lib/transform/jsx-transformer.ts`): Babel standalone transpiles JSX in-browser, resolves `@/` imports from the virtual FS, uses esm.sh CDN import maps for npm packages, and renders via a sandboxed iframe blob URL.

**Provider** (`src/lib/provider.ts`): Single switch point between real Claude (`@ai-sdk/anthropic`) and `MockLanguageModel`. No API key → mock.

**Contexts**: `FileSystemContext` owns virtual FS state and triggers; `ChatContext` wraps vercel/ai's `useChat` and processes Claude tool results to mutate the FS.

### Persistence

Prisma + SQLite. Models: `User` (email + bcrypt password) and `Project` (name, messages JSON, virtual FS data JSON). Auth is JWT in httpOnly cookies (7-day, via jose). Projects save only when a user is authenticated; anonymous work stays in localStorage.

### Layout

Three-panel UI: chat (left), live preview + Monaco code editor (right). Resizable panels via `react-resizable-panels`.

### Generated Component Conventions

Claude-generated components must:
- Use `/App.jsx` or `/App.tsx` as the entry point
- Use only Tailwind CSS (no inline styles)
- Use `@/` prefix for local imports
- Avoid `import React` (React 19 JSX transform)
