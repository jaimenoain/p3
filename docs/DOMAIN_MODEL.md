# **P3: Unified Data & API Contract**

### Phase 1 & 2 implementation note

Phase 1 (Walking Skeleton) uses **Supabase Auth** for sign-in, sign-up, forgot-password, and session. Phase 2 (Tenant Provisioning) implements `organizations`, `organization_members`, `workspaces`, and `scenarios` tables along with Row Level Security (RLS) firewalls.

Currently, tenant provisioning is handled entirely server-side via Server Actions (`provisionTenantAction`) calling a PostgreSQL RPC (`provision_tenant`) to safely bypass RLS during initialization. Workspace cash balance updates also use Server Actions. REST API endpoints (`/api/v1/*`) are not yet active; the domain shapes below reflect the target logical contracts for future decoupled APIs, but current integration relies on direct Next.js Server Actions.

---

### **Domain 1: The Tenant & Access Domain**

#### **Component 1: Database Schema (The Foundation)**

SQL

\-- PostgreSQL / Prisma Mapping  
CREATE TABLE users (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    email VARCHAR(255) UNIQUE NOT NULL,  
    password\_hash VARCHAR(255) NOT NULL, \-- Never exposed to DTO  
    first\_name VARCHAR(100) NOT NULL,  
    last\_name VARCHAR(100) NOT NULL,  
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

CREATE TABLE organizations (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    name VARCHAR(255) NOT NULL,  
    billing\_email VARCHAR(255),  
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

\-- Future-proofing for V2 multi-user \[cite: 20\]  
CREATE TABLE organization\_members (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    organization\_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,  
    user\_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,  
    role VARCHAR(50) DEFAULT 'owner', \-- 'owner', 'admin', 'viewer'  
    joined\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP,  
    UNIQUE(organization\_id, user\_id)  
);

CREATE INDEX idx\_org\_members\_user ON organization\_members(user\_id);

#### **Component 2: Security Policies (The Firewall)**

* **Authentication:** Requires active Bearer token.  
* **RLS (Row Level Security):** \* users: SELECT, UPDATE strictly limited where id \= auth.uid().  
  * organizations: SELECT, UPDATE strictly limited to organizations where auth.uid() exists in organization\_members.user\_id. DELETE is locked to role \= 'owner'.

#### **Component 3: API Route Registry & DTOs (The Contract)**

* **GET** /api/v1/workspaces/context \- Retrieves the active user and their authorized organization.

TypeScript

export interface UserContextDTO {  
  userId: string; // Maps from users.id  
  fullName: string; // Computed from DB fields: users.first\_name \+ ' ' \+ users.last\_name  
  email: string; // Maps from users.email  
  organizationId: string; // Maps from organization\_members.organization\_id  
  organizationName: string; // Maps from organizations.name  
  role: string; // Maps from organization\_members.role  
  joinedAt: string; // Maps from organization\_members.joined\_at (ISO String)  
}

#### **Component 4: Input Validation (The Guardrails)**

TypeScript

import { z } from 'zod';

export const UpdateOrganizationSchema \= z.object({  
  name: z.string().min(2, "Organization name must be at least 2 characters").max(255),  
  billingEmail: z.string().email("Invalid billing email format").optional(),  
});

#### **Component 5: Static JSON Mock (The Development Artifact)**

JSON

{  
  "userId": "usr\_9f8e7d6c-5b4a-3f2e-1d0c",  
  "fullName": "Sarah Connor",  
  "email": "sarah@skynet-analytics.io",  
  "organizationId": "org\_1a2b3c4d-5e6f-7a8b-9c0d",  
  "organizationName": "Skynet Analytics Inc.",  
  "role": "owner",  
  "joinedAt": "2026-03-01T14:30:00Z"  
}

---

### **Domain 2: The Projection Engine Domain**

#### **Component 1: Database Schema (The Foundation)**

SQL

CREATE TABLE workspaces (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    organization\_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,  
    name VARCHAR(255) NOT NULL,  
    starting\_cash\_balance NUMERIC(15, 2), \-- Nullable. Prompts user for balance if NULL on load
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

CREATE TABLE scenarios (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    workspace\_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,  
    name VARCHAR(255) NOT NULL,  
    is\_active\_baseline BOOLEAN DEFAULT false,  
    global\_assumptions JSONB NOT NULL DEFAULT '{}'::jsonb, \-- Stores isolated Churn, Base Price, etc. \[cite: 33, 34\]  
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

CREATE TABLE blocks (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    scenario\_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,  
    type VARCHAR(50) NOT NULL, \-- 'Personnel', 'Revenue', 'Marketing', 'OpEx', 'Capital' \[cite: 110\]  
    is\_active BOOLEAN DEFAULT true, \-- Supports "Soft Disable / Inactives Tray" \[cite: 97, 98\]  
    payload JSONB NOT NULL, \-- Encodes specific assumptions (e.g. salary, start\_month) \[cite: 29\]  
    created\_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT\_TIMESTAMP  
);

CREATE INDEX idx\_blocks\_scenario ON blocks(scenario\_id);

#### **Component 2: Security Policies (The Firewall)**

* **RLS Isolation:** Access to workspaces, scenarios, and blocks is implicitly gated by joining the parent workspace.organization\_id against the authenticated user's organization\_members list. Cross-tenant access is physically impossible at the DB query level.

#### **Component 3: API Route Registry & DTOs (The Contract)**

* **GET** /api/v1/scenarios/:id \- Fetches a self-contained Scenario and all its blocks.  
* **POST** /api/v1/scenarios/:id/duplicate \- Executes a hard clone of the scenario.

TypeScript

export interface BlockDTO {  
  blockId: string; // Maps from blocks.id  
  type: 'Personnel' | 'Revenue' | 'Marketing' | 'OpEx' | 'Capital'; // Maps from blocks.type  
  isActive: boolean; // Maps from blocks.is\_active  
  properties: Record\<string, any\>; // Maps directly from blocks.payload JSONB \[cite: 29\]  
}

export interface ScenarioDTO {  
  scenarioId: string; // Maps from scenarios.id  
  name: string; // Maps from scenarios.name  
  globalAssumptions: Record\<string, number\>; // Maps from scenarios.global\_assumptions JSONB \[cite: 33\]  
  blocks: BlockDTO\[\]; // Joined array of child blocks  
}

#### **Component 4: Input Validation (The Guardrails)**

TypeScript

export const CreateBlockSchema \= z.object({  
  type: z.enum(\['Personnel', 'Revenue', 'Marketing', 'OpEx', 'Capital'\]),  
  isActive: z.boolean().default(true),  
  properties: z.record(z.any()) // Deep validation handled by domain-specific factory based on 'type'  
});

#### **Component 5: Static JSON Mock (The Development Artifact)**

JSON

{  
  "scenarioId": "scn\_a1b2c3d4",  
  "name": "Aggressive Growth Plan \- Q3",  
  "globalAssumptions": {  
    "baseChurnRate": 0.02,  
    "targetArpa": 499.00  
  },  
  "blocks": \[  
    {  
      "blockId": "blk\_998877",  
      "type": "Personnel",  
      "isActive": true,  
      "properties": {  
        "roleName": "Senior Full Stack Engineer",  
        "monthlyGrossSalary": 12500,  
        "employerBurdenPercent": 0.20,  
        "startMonth": "2026-06"  
      }  
    }  
  \]  
}

---

### **Domain 3: The Financial Actuals & Period Domain**

#### **Component 1: Database Schema (The Foundation)**

SQL

CREATE TABLE chart\_of\_accounts (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    workspace\_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,  
    name VARCHAR(255) NOT NULL,  
    category VARCHAR(50) NOT NULL, \-- 'Revenue', 'COGS', 'OpEx', 'Headcount', 'Suspense' \[cite: 29\]  
    is\_system\_default BOOLEAN DEFAULT false  
);

CREATE TABLE monthly\_periods (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    workspace\_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,  
    calendar\_month DATE NOT NULL, \-- Stored as YYYY-MM-01  
    status VARCHAR(20) DEFAULT 'Draft', \-- 'Draft' or 'Closed'   
    health\_score NUMERIC(5, 2), \-- Computed and frozen on Month Close   
    ignore\_variance BOOLEAN DEFAULT false, \-- Used for startup month   
    UNIQUE(workspace\_id, calendar\_month)  
);

CREATE TABLE historical\_records (  
    id UUID PRIMARY KEY DEFAULT gen\_random\_uuid(),  
    monthly\_period\_id UUID NOT NULL REFERENCES monthly\_periods(id) ON DELETE CASCADE,  
    account\_id UUID REFERENCES chart\_of\_accounts(id), \-- Nullable before mapping  
    transaction\_date DATE NOT NULL,  
    amount NUMERIC(15, 2) NOT NULL, \-- Negative amounts subtracted natively \[cite: 63, 64\]  
    description TEXT,  
    is\_duplicate\_quarantined BOOLEAN DEFAULT false \-- Forces manual intervention \[cite: 57, 58\]  
);

#### **Component 2: Security Policies (The Firewall)**

* monthly\_periods and historical\_records strictly inherit the RLS policies of the workspaces they belong to.  
* **Database Trigger:** A trigger prevents INSERT, UPDATE, or DELETE on historical\_records if the parent monthly\_periods.status is 'Closed' (unless an explicit "re-open" override is passed from the server).

#### **Component 3: API Route Registry & DTOs (The Contract)**

* **GET** /api/v1/workspaces/:id/periods/:month \- Fetches the status and records for a specific month.  
* **POST** /api/v1/workspaces/:id/periods/:month/close \- Executes the Month Close, freezing the records and computing the Health Score.

TypeScript

export interface HistoricalRecordDTO {  
  recordId: string; // Maps from historical\_records.id  
  date: string; // Maps from historical\_records.transaction\_date (YYYY-MM-DD)  
  amount: number; // Maps from historical\_records.amount  
  description: string; // Maps from historical\_records.description  
  accountName: string | null; // Joined from chart\_of\_accounts.name  
  isSuspense: boolean; // Computed: true if chart\_of\_accounts.category \=== 'Suspense' or unmapped \[cite: 54\]  
}

export interface MonthlyPeriodDTO {  
  periodId: string; // Maps from monthly\_periods.id  
  monthLabel: string; // Computed from monthly\_periods.calendar\_month (e.g., "Mar 2026")  
  status: 'Draft' | 'Closed'; // Maps from monthly\_periods.status   
  healthScore: number | null; // Maps from monthly\_periods.health\_score \[cite: 163\]  
  ignoreVariance: boolean; // Maps from monthly\_periods.ignore\_variance   
  records: HistoricalRecordDTO\[\]; // Joined array of transactions  
}

#### **Component 4: Input Validation (The Guardrails)**

TypeScript

export const ImportCsvSchema \= z.object({  
  fileData: z.string().base64(), // Or multipart form data parser  
  currency: z.string().length(3).refine(val \=\> val \=== 'USD', "V1 is strictly single-currency. Please normalize externally.") // Enforces strict V1 block \[cite: 60, 61\]  
});

#### **Component 5: Static JSON Mock (The Development Artifact)**

JSON

{  
  "periodId": "per\_xyz123",  
  "monthLabel": "Oct 2026",  
  "status": "Draft",  
  "healthScore": null,  
  "ignoreVariance": true,  
  "records": \[  
    {  
      "recordId": "rec\_001",  
      "date": "2026-10-15",  
      "amount": \-450.00,  
      "description": "Stripe Payout \- Refund",  
      "accountName": "Revenue",  
      "isSuspense": false  
    },  
    {  
      "recordId": "rec\_002",  
      "date": "2026-10-28",  
      "amount": 12000.00,  
      "description": "Gusto Payroll",  
      "accountName": "Headcount",  
      "isSuspense": false  
    }  
  \]  
}

---

This data structure perfectly isolates the tenant, allows for flexible JSON-driven engine scenarios without heavy DB migrations for new block types, and rigidly enforces the boundaries of actual vs. projected data.

