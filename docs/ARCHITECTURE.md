# Nozzl Project - Architecture & Patterns

## Tech Stack

- **Next.js**: 16.0.1 (App Router)
- **React**: 19.2.0
- **Prisma**: 6.18.0
- **Shadcn UI**: Latest
- **TypeScript**: 5.x
- **Database**: PostgreSQL

## Official Documentation

- Next.js 16: https://nextjs.org/docs
- Shadcn UI: https://ui.shadcn.com/docs
- Prisma: https://www.prisma.io/docs

---

## Project Structure

```
app/
├── (auth)/              # Auth routes
├── (dashboard)/         # Dashboard routes
│   └── [feature]/
│       ├── page.tsx     # Server Component (fetch data)
│       └── ...
├── api/                 # API routes
└── generated/prisma/    # Prisma generated client

components/
├── ui/                  # Shadcn components
└── [feature]/
    ├── [feature]-client.tsx     # Client Component (state + layout)
    ├── [feature]-list.tsx       # List component
    ├── [feature]-card.tsx       # Card component
    └── ...

lib/
├── services/            # READ operations (Prisma queries)
├── actions/             # WRITE operations ("use server")
├── validations/         # Zod schemas
└── utils/              # Helper functions

prisma/
├── schema.prisma       # Database schema
└── migrations/         # Migration history
```

---

## Architecture Patterns

### 1. Server vs Client Components

**Server Component (default):**

- Fetch data menggunakan Service
- No state, no interactivity
- File: `page.tsx`, components tanpa "use client"

**Client Component:**

- State management (useState, useEffect)
- Event handlers, forms, interactivity
- Harus ada directive: `"use client"`
- File: `*-client.tsx`

**Flow:**

```
page.tsx (server)
  → fetch data dari Service
  → pass props
    → *-client.tsx (state + layout)
      → *-list.tsx, *-card.tsx (dumb components)
```

**Contoh:**

```typescript
// app/(dashboard)/gas-stations/page.tsx - Server Component
export default async function GasStationsPage() {
  const data = await GasStationService.findAll();
  const transformed = data.map((gs) => ({
    ...gs,
    latitude: gs.latitude ? Number(gs.latitude) : null,
    longitude: gs.longitude ? Number(gs.longitude) : null,
  }));
  return <GasStationsClient gasStations={transformed} />;
}

// components/gas-stations/gas-stations-client.tsx - Client Component
("use client");
export function GasStationsClient({ gasStations }) {
  const [selectedId, setSelectedId] = useState(null);
  return (
    <div>
      <GasStationList gasStations={gasStations} selectedId={selectedId} />
      <GasStationMap gasStations={gasStations} selectedId={selectedId} />
    </div>
  );
}
```

---

### 2. Service vs Action

**SERVICE (`lib/services/`):**

- ❌ Tanpa `"use server"`
- ✅ READ operations (findAll, findById, search)
- ✅ Reusable business logic
- ✅ Dipanggil dari: Server Components, API Routes, Actions
- ✅ Export inferred types

**ACTION (`lib/actions/`):**

- ✅ Harus `"use server"`
- ✅ WRITE operations (create, update, delete)
- ✅ Form submissions, mutations
- ✅ Return structured response: `{ success, message, data? }`

**Contoh Service:**

```typescript
// lib/services/gas-station.service.ts
import { prisma } from "@/lib/prisma";

export class GasStationService {
  static async findAll() {
    return await prisma.gasStation.findMany({
      where: { status: "ACTIVE" },
      include: { owner: { include: { profile: true } } },
      orderBy: { createdAt: "desc" },
    });
  }
}

// Export inferred types
export type GasStationWithOwner = Awaited<
  ReturnType<typeof GasStationService.findAll>
>[number];
```

**Contoh Action:**

```typescript
// lib/actions/gas-station.actions.ts
"use server";

import { createGasStationSchema } from "@/lib/validations/infrastructure.validation";
import type { z } from "zod";

export async function createGasStation(
  input: z.infer<typeof createGasStationSchema>
) {
  try {
    const validated = createGasStationSchema.parse(input);
    const gasStation = await GasStationService.create(validated, userId);
    return { success: true, message: "Gas station created", data: gasStation };
  } catch (error) {
    return { success: false, message: "Failed to create" };
  }
}
```

---

### 3. Type System

**Zero Redundancy - Leverage Prisma Generated Types**

❌ **JANGAN:**

```typescript
// Duplikasi type definition
type GasStation = {
  id: string;
  name: string;
  // ... semua field manual
};
```

✅ **GUNAKAN:**

```typescript
import { GasStation, Prisma } from "@prisma/client";

// 1. Direct Prisma type
type MyGasStation = GasStation;

// 2. Dengan relations (infer dari service)
export type GasStationWithOwner = Awaited<
  ReturnType<typeof GasStationService.findAll>
>[number];

// Note: latitude & longitude sekarang Float (bukan Decimal),
// jadi tidak perlu transformasi lagi untuk client components!

// 3. Prisma utility types
type WithOwner = Prisma.GasStationGetPayload<{
  include: { owner: true };
}>;
```

**Import pattern:**

```typescript
import {
  GasStationService,
  type GasStationWithOwner,
} from "@/lib/services/gas-station.service";
```

---

### 4. Validation dengan Zod

**File:** `lib/validations/*.validation.ts`

**Pattern:**

```typescript
import { z } from "zod";

export const createGasStationSchema = z.object({
  name: z.string().min(1).max(100),
  address: z.string().min(1).max(500),
  latitude: z.number().min(-90).max(90).optional(),
  // ...
});

// Infer type dari schema
export type CreateGasStationInput = z.infer<typeof createGasStationSchema>;
```

**Usage di Action:**

```typescript
const validated = createGasStationSchema.parse(input);
```

---

### 5. Component Patterns

**Modular & Reusable:**

```
components/gas-stations/
├── gas-stations-client.tsx    # Client Component (state + layout)
├── gas-station-list.tsx       # List + search
├── gas-station-card.tsx       # Single card (reusable)
└── gas-station-form.tsx       # Form (jika ada CRUD)
```

**Props pattern:**

```typescript
type GasStationCardProps = {
  gasStation: GasStationWithOwner;
  isSelected?: boolean;
  onClick?: () => void;
};
```

**Naming conventions:**

- Simple, consistent
- Function: `setSelectedId`, `filteredGasStations`
- Component: `GasStationCard`, `GasStationList`
- File: `gas-station-card.tsx`, `gas-station-list.tsx`

---

## Prisma Patterns

### Schema Conventions

- Model names: PascalCase (GasStation, User)
- Field names: camelCase (gasStationId, createdAt)
- Audit trail: createdAt, updatedAt, createdBy, updatedBy

### Relations

```prisma
model Tank {
  stations Station[]  // One-to-many
}

model Station {
  tank Tank @relation(fields: [tankId], references: [id])
}
```

### Create with relations

```typescript
await prisma.gasStation.create({
  data: {
    name: "Station A",
    owner: {
      connect: { id: ownerId }, // Connect existing
    },
    createdBy: {
      connect: { id: userId },
    },
  },
});
```

---

## Database Workflow

### Update Schema:

1. **Stop dev server** (Ctrl+C)
2. Edit `prisma/schema.prisma`
3. Run migration:
   - Development: `npm run schema:sync` (fast, no history)
   - Production: `npm run db:migrate` (create migration file)
4. **Start dev server**: `npm run dev`

**Scripts:**

```json
{
  "schema:sync": "prisma db push && prisma generate",
  "db:migrate": "prisma migrate dev",
  "db:generate": "prisma generate"
}
```

---

## UI Components (Shadcn)

**Import dari:**

```typescript
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
```

**Pattern:**

- Gunakan Shadcn components untuk consistency
- Extend dengan Tailwind classes jika perlu
- Responsive by default

---

## Critical Rules

1. **❌ NEVER** import Prisma/Service di Client Component
2. **✅ ALWAYS** fetch data di Server Component
3. **✅ ALWAYS** infer types dari Prisma/Service
4. **✅ ALWAYS** validate input dengan Zod
5. **✅ ALWAYS** separate concerns: page → client → components
6. **✅ ALWAYS** use "use server" for mutations
7. **✅ ALWAYS** transform Decimal to number before passing to client

---

## Questions to Ask Before Coding

1. Apakah ini butuh state/interactivity? → Client Component
2. Apakah ini READ atau WRITE? → Service atau Action
3. Apakah type sudah ada di Prisma? → Infer, jangan duplikat
4. Apakah component ini reusable? → Extract ke file terpisah
5. Apakah ada validation? → Gunakan Zod schema

---

## Example: Complete Feature Flow

**Gas Stations Feature:**

1. **Schema** (`prisma/schema.prisma`)
2. **Service** (`lib/services/gas-station.service.ts`) - READ
3. **Action** (`lib/actions/gas-station.actions.ts`) - WRITE
4. **Validation** (`lib/validations/infrastructure.validation.ts`)
5. **Page** (`app/(dashboard)/gas-stations/page.tsx`) - Server
6. **Client** (`components/gas-stations/gas-stations-client.tsx`) - State
7. **Components** (`gas-station-list.tsx`, `gas-station-card.tsx`) - UI

**Flow:**

```
User visits /gas-stations
  → page.tsx fetches data (server)
  → pass to gas-stations-client.tsx (client)
  → render gas-station-list.tsx
  → map gas-station-card.tsx
```

---

**Last updated:** 2025-11-04
