

# Plan: Create `src/lib/logger.ts`

## Current State

- **`src/types/index.ts`** already exists with all requested types (Ticket, OrdemServico, Cliente, Prestador, RMERelatorio, enums, composite types, agent types) -- all derived from Supabase schema with zero `any` usage. No changes needed.
- **`src/services/api.ts`** has a basic logger but without timestamps. Many files already import from there.

## What to Create

### `src/lib/logger.ts` -- Enhanced centralized logger

A new standalone logger with:
- **Timestamp formatting**: `[2026-03-18T14:30:00.123Z] [INFO] message`
- **Production filtering**: Only `error` level logs in production (`import.meta.env.PROD`)
- **Development**: All levels visible (info, warn, error, debug)
- **Default export** for clean usage: `import logger from '@/lib/logger'`

```text
src/lib/
  └── logger.ts   ← NEW (standalone, no dependencies)
```

## No Other Changes

Per your instruction, no existing files will be modified. The new logger will coexist with the one in `src/services/api.ts`. Future migration of imports can happen incrementally.

