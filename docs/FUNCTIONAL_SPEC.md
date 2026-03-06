  
**P3**

**Financial Projection Engine**

Product Requirements Document

Version 1.0  |  March 2026

Target: V1 — Early-Stage B2B / PLG SaaS Startups

# **1\. Product Overview**

## **1.1 Problem Statement**

Early-stage SaaS founders manage runway using fragile, hand-built spreadsheets. These models break silently, diverge from reality after the first CSV import, and require significant manual effort to update each month. The result is that founders either over-engineer brittle models or stop trusting their projections entirely — making critical hiring, spending, and fundraising decisions with degraded financial visibility.

## **1.2 Solution**

P3 is a deterministic, month-over-month financial modeling engine built specifically for SaaS startups. It replaces formula-driven spreadsheets with a visual canvas of composable Building Blocks, ingests real accounting data via a structured CSV import, and automatically grades the founder's assumptions against actual results every month.

## **1.3 Target Audience**

V1 target: Founders and operators of early-stage B2B SaaS and PLG SaaS companies. Single-user accounts. No multi-seat or enterprise features in scope.

## **1.4 Monetization**

V1 is 100% free. The goal is rapid user acquisition and product feedback. Monetization strategy is out of scope for this document.

## **1.5 Out of Scope for V1**

* Multi-user collaboration, role management, and permission flows

* Automated tax calculation by jurisdiction

* Hard Restatement of historically closed months (deferred to V2)

* Multi-currency support (requires external normalization before import)

* Equity / options modeling

* Balance sheet and accounts receivable / payable modeling

# **2\. Data Architecture**

## **2.1 Core Entity Hierarchy**

The system is organized around the following hierarchy:

| Entity | Description |
| :---- | :---- |
| **Organization** | Top-level tenant. One organization per account in V1. |
| **Workspace** | The active financial model environment. Contains all scenarios, blocks, and historical data. |
| **ChartOfAccounts** | Standardized, immutable ledger categories: Revenue, COGS, OpEx, Headcount. Unmapped rows are grouped into an 'Uncategorized / Suspense' category to ensure mathematical balancing at all times. |
| **HistoricalRecord** | Mapped CSV data tagged by month and linked to ChartOfAccounts entries. Lives in Draft or Closed state. |
| **Block** | A JSON object encoding a specific assumption (e.g., type: Personnel, payload: { salary: 120000, start\_month: Oct-2024 }). Belongs to exactly one Scenario. |
| **Scenario** | A distinct, isolated array of Blocks representing a parallel planning universe. Scenarios are hard copies — no live inheritance. |

## **2.2 Scenario Architecture**

**Hard Copy Model.** Creating a child scenario generates a static fork. There is no live parent-child inheritance. Each scenario is a fully self-contained clone of the blocks at the moment of duplication.

**Global Assumptions Panel.** Each scenario has its own isolated Global Variables Panel (e.g., Churn Rate, Base Price). Duplicating a scenario creates a complete clone of its panel. Blocks within a scenario reference these variables and recalculate transversally when a global variable is modified. Modifying one scenario's panel never mutates another scenario.

**Scenario Limits (V1).** Users may create an unlimited number of parallel scenarios within a Workspace on the free V1 plan.

## **2.3 State Model**

| State | Behavior |
| :---- | :---- |
| **Draft** | CSV data has been imported but the Month Close has not been executed. The founder may freely edit cells, correct amounts, or add unrecorded expenses. A new CSV upload in Draft state executes a destructive overwrite — all prior manual edits are permanently lost. |
| **Closed** | Month Close has been executed. Data is locked. Re-opening requires a deliberate action and a Diff View confirmation step. |

# **3\. CSV Ingestion & Standardization**

## **3.1 Overview**

The CSV importer accepts accounting exports from tools such as QuickBooks or Xero. It is the primary mechanism for grounding the model in real historical data. CSV import is optional — the tool is fully usable without it from day one (see Section 6: Onboarding).

## **3.2 Business Rules**

### **Partial Month Hard Block**

Any CSV upload whose maximum transaction date falls before the last calendar day of that month will be immediately rejected or quarantined until the month is complete. The engine enforces strict full-month boundaries for actuals.

### **Destructive Overwrite**

If a new CSV is uploaded for a month currently in Draft state, the system executes a total destructive overwrite. Any previous manual adjustments in that month are irretrievably lost. The UI must surface a clear, explicit warning before the overwrite is confirmed.

### **Unmapped Row Handling**

There is no hard block for unmapped transactions. The Mapping Wizard includes an explicit 1-click opt-in step to group these into 'Uncategorized / Suspense.' For forecasting purposes, the engine will assume $0 future spend for any historically uncategorized line. If the running balance of Uncategorized / Suspense is greater than $0, the UI must display a non-dismissible red warning in the main dashboard to prevent false-positive runway projections.

### **Duplicate Detection (Manual Quarantine)**

The ingestion algorithm will not silently approve or delete exact duplicates (same date, amount, and description). It will pause and force the user to explicitly choose: 'Approve both' or 'Discard duplicate.' Silent deduplication is prohibited.

### **Currency**

Multi-currency files trigger a hard block in V1. The user must externally normalize currency before importing. Single-currency validation must be explicit during the mapping step.

### **Algebraic Signs**

The system strictly respects algebraic signs. Negative amounts (e.g., Stripe refunds, credit notes) are automatically subtracted without requiring forced 'Contra-Revenue' categories.

### **Strict CSV Dominance**

In any month containing CSV data (Draft or Closed), the outputs of all Canvas Building Blocks for that month are silenced from the P\&L calculation. The forecasting engine projects outputs only starting from the first chronologically empty month.

UI behavior in dominated months: The block's original projected value is displayed in muted gray. The actual CSV value is displayed in full contrast. The variance (actual minus projected) is shown inline in red (negative) or green (positive). Blocks are not hidden from the canvas.

### **Auto-Mapping Assistance**

Engineering must implement a suggested auto-grouping feature (e.g., rows containing 'salary' or 'payroll' in their description are suggested under Headcount). This feature is strictly opt-in — the system will never assign categories silently. The user must manually trigger the suggestion for assistance.

# **4\. The Projection Canvas**

## **4.1 Overview**

The Canvas is the primary workspace where founders build their forward-looking financial model. Users add and configure Building Blocks on a monthly timeline without writing formulas. Blocks are connected through a dropdown-based dependency system (see Section 4.4).

## **4.2 Mathematical Engine Rules**

### **30/360 Month Standard**

The engine uses a standard 30-day month for all prorating calculations, ignoring literal calendar days. A $3,000 fixed expense starting mid-month calculates at $100 per day consistently, eliminating calendar-induced noise from projected margins.

### **Block Start Month Behavior**

A block with a future start\_month has zero financial impact in all months prior to that date. It appears on the canvas from day one (so the founder is aware of the planned commitment), but its contribution to any financial output is $0 until the designated start month.

### **Recalculation Latency**

Recalculating the model after a toggle, block edit, or dependency change triggers a synchronous lock with a loading spinner (expected 1–2 seconds). Real-time uninterrupted rendering is explicitly not a V1 requirement. Cascading dependency chains of unlimited depth are supported, with the latency trade-off accepted.

## **4.3 Dependency Logic & Validation**

### **Circular Dependency Prevention**

The UI features proactive graph validation. In a child block's property panel dropdown, any block that already exists downstream in the calculation chain is shown as visible but disabled (grayed out), preventing selection and providing immediate visual feedback. Attempting to create a circular connection results in a snap-back and an error message.

### **Deletion Guard**

The system prohibits deletion of a Parent Block if it has dependent Child Blocks or projected impacts in future months. The user must explicitly unlink or delete the downstream cascade first.

### **Soft Disable (Inactives Tray)**

Toggling a Parent Block to 'off' triggers a temporary, cascading unlinking of all its Child Blocks. Hidden blocks have $0 P\&L impact and are moved to an 'Inactive Projections' tray. They can be restored at any time. This operation is reversible.

## **4.4 Driver-Based Reference Fields**

### **Concept**

Numeric input fields that vary by scenario or can be driven by other blocks support three modes (where applicable; see each block section for which fields are referenceable):

* Static: A constant value entered directly by the user.

* Referenced: Points to a named output slot of another block. The value updates automatically when the source block recalculates.

* Formula: Combines one or more references and/or static constants using the operators \+, \-, ×, ÷. Example: aws\_cost \= total\_revenue\_mrr × 0.08

One-off initial values (e.g. Revenue’s Starting MRR) are **static only** and do not support Referenced or Formula.

### **Output Slots**

Every block exposes a defined set of named output slots. Examples:

| Block Type | Output Slots Exposed |
| :---- | :---- |
| **Revenue** | mrr, new\_customers, churned\_customers, mrr\_cumulative, new\_customers\_cumulative |
| **Marketing** | new\_customers\_generated, total\_spend, total\_spend\_cumulative |
| **Personnel** | total\_headcount, total\_salary\_cost, total\_fully\_loaded\_cost, total\_salary\_cost\_cumulative; **new\_clients** (sales roles only) |
| **OpEx (Fixed)** | monthly\_cost, monthly\_cost\_cumulative |
| **Capital** | cash\_injected |

The \_cumulative suffix variants return the running total from the model start date through the current month. All output slots return a per-month value by default.

# **5\. Core Building Blocks (V1)**

All five block types below are required for V1. Each block's inputs can be Static, Referenced, or Formula (see Section 4.4).

## **5.1 Personnel / Headcount Block**

| Field | Specification |
| :---- | :---- |
| **Role Name** | Free text label. |
| **Monthly Gross Salary** | Base compensation input. |
| **Employer Burden %** | Employer taxes and benefits as a percentage of gross salary (e.g., 25%). Applied multiplicatively. Stored separately from gross salary. Total fully-loaded cost \= gross salary × (1 \+ burden %). |
| **Start Month** | Month the hire begins. No financial impact before this month; block is visible on canvas from creation. |
| **End Month** | Optional. If set, the block's cost contribution terminates after this month. |
| **Headcount Count** | Number of people in this role (default: 1). Can be a static integer or a Referenced/Formula value. |

For **sales** roles (role type Sales): *new\_clients* per month is derived from headcount × new clients per month at full ramp, with ramp from start month (see output slots). Revenue blocks can reference this as the New customers source.

## **5.2 Revenue Block**

| Field | Specification |
| :---- | :---- |
| **Starting MRR** | Initial Monthly Recurring Revenue at model start. **Static only** (entered directly; not referenceable). |
| **New customers (source)** | Number of new customers per month. **Static** (constant value, e.g. 0) or **Referenced** (e.g. Marketing’s new\_customers\_generated, or Personnel sales’ new\_clients). Multiplied by ARPA to get MRR growth from acquisitions. |
| **ARPA** | Average Revenue Per Account. Used to convert new customer count into MRR contribution. |
| **Monthly Churn %** | Applied to existing MRR each month. |
| **Upsell / expansion growth %** | Optional. Monthly growth applied to *existing* MRR only (e.g. price increases, upsell, expansion). Static only; e.g. 0.05 for 5% MoM. Does not apply to revenue from new customers (that is driven by New customers × ARPA). Default 0. |
| **Billing Frequency** | Monthly or Annual Prepaid. If Annual: cash injection \= 12 months of MRR in Month 1; $0 cash inflow for months 2–12. Cohort renewal at Month 13 \= (initial cohort customers − cumulative churn) × annual ticket. |

MRR formula (monthly): MRR(n) \= MRR(n-1) \+ (New Customers(n) × ARPA) \+ (MRR(n-1) × growth%) − (MRR(n-1) × Churn %). *New Customers(n)* comes from the block’s New customers (source). *growth%* is Upsell / expansion growth % (0 if not set), applied only to the existing MRR base.

## **5.3 Marketing Block**

| Field | Specification |
| :---- | :---- |
| **Monthly Ad Spend** | Total spend per month on paid acquisition. |
| **Target CAC** | Customer Acquisition Cost. New customers generated \= Monthly Spend ÷ CAC. |
| **Sales Cycle Lag (months)** | Integer. The engine holds new customer output and automatically pushes it into the Revenue Block exactly X months later. Lag \= 0 means same-month impact. |

## **5.4 OpEx (Fixed) Block**

| Field | Specification |
| :---- | :---- |
| **Expense Name** | Free text label. |
| **Monthly Cost** | Flat monthly deduction from operational cash flow. |
| **Annual Growth Rate %** | Auto-applied on each block anniversary month (i.e., 12 months after start). Does not compound mid-year. |

Note: Taxes are handled by creating manual OpEx (Fixed) or one-time blocks in the specific payment months. The system does not attempt to calculate tax obligations automatically.

## **5.5 Capital (Funding) Block**

| Field | Specification |
| :---- | :---- |
| **Funding Type** | Equity or Debt. |
| **Amount** | Total capital received. Treated as a one-time positive spike to the cash flow statement in the specified month. |
| **Month Received** | The calendar month in which cash lands. |

# **6\. Onboarding Experience**

## **6.1 Principles**

The tool must be immediately usable without a CSV upload. CSV import enriches the model with historical actuals but is never a prerequisite. A founder should be able to build a complete forward-looking projection in under 10 minutes without importing any data.

## **6.2 Empty State & Starting Point**

On first login, the workspace presents a single required input before anything else: Starting Cash Balance (the amount of cash currently in the bank). This is the only mandatory field to initialize the model. Once set, the canvas is unlocked and the user can begin adding blocks immediately.

## **6.3 Progressive Activation Checklist**

A persistent sidebar checklist guides the user through activation milestones. Each completed step is visually marked. Steps unlock progressively:

| \# | Step | What it unlocks |
| :---- | :---- | :---- |
| **1** | Set your Starting Cash Balance | Canvas and block creation |
| **2** | Add your first Revenue block | Runway Tripwire visible in output dashboard |
| **3** | Add your first cost block | Full P\&L and net burn chart |
| **4** | Import historical CSV data | Variance analysis, Month Close, and Health Score |

## **6.4 Startup Month Exception**

The first real CSV imported is frequently a partial or irregular month (the company's actual start month). To avoid generating misleading variance alerts, the user may activate an 'Ignore Variance' flag — available exclusively for the designated startup month. This silences all visual variance alerts for that specific month only.

# **7\. Scenario Planning**

## **7.1 Creating Scenarios**

Any scenario can be duplicated to create a static hard copy. The copy is fully isolated — changes to the original do not propagate to the copy and vice versa. Users can maintain unlimited parallel scenarios in V1.

## **7.2 What-If Mode (Volatile State)**

Block toggles (on/off) operate locally in the browser and do not persist to the database until the user executes an explicit 'Apply Changes' or 'Save as New Scenario' action. This prevents accidental mutation of saved scenarios during exploratory analysis.

## **7.3 Variance Computation Across Scenarios**

When a monthly CSV is ingested, the engine calculates variance against all existing scenarios. To protect frontend performance, these results are computed server-side but only rendered in the UI when the user actively opens that scenario.

# **8\. Month Close & Variance Engine**

## **8.1 Month Close Process**

Month Close is a strict manual trigger executed at the founder's discretion. The system never auto-closes a month. If executing Month Close would overwrite previously closed data, the system mandates a Diff View (side-by-side comparison of old vs. new state) before confirming.

## **8.2 Variance Treatment**

The difference between projected cash and actual CSV cash balance is absorbed to redefine the real starting point for future months, adjusting the Runway Tripwire dynamically. The engine does not automatically roll over budgetary debt or surplus to future months — forward projections remain faithful to the user's original block inputs.

## **8.3 Health Score**

After Month Close, the system computes a Health Score that grades the founder's assumptions against actuals. The specific scoring methodology (e.g., weighted accuracy across Revenue, Headcount, and OpEx blocks) is to be defined during the design phase, but must be surfaced prominently in the output dashboard.

# **9\. Output Dashboard**

## **9.1 Overview**

The output dashboard is the primary read surface. It is always filtered by the currently active scenario. It consists of two synchronized components: a Chart and a Financial Table.

## **9.2 The Runway Chart**

A stacked area chart with the following specifications:

* X-axis: Monthly timeline (from model start to end of projection horizon).

* Displayed series: Cash Balance (projected) as a filled area; Cash Balance (actual) as a solid line overlaid where CSV data exists; Gross Burn as a secondary area.

* Runway Tripwire: A vertical red dashed line marking the projected date at which Cash Balance reaches $0. The line moves dynamically when blocks, scenarios, or variables are modified. The date is labeled directly on the line.

* Actuals vs. Projected divergence is visually distinct — projected uses a lighter fill, actuals use a solid overlay.

## **9.3 The Monthly Financial Table**

A month-by-month table synchronized with the chart. Columns:

| Column | Description |
| :---- | :---- |
| **Month** | Calendar month label. |
| **Revenue** | Total MRR / cash revenue for the month. |
| **COGS** | Cost of Goods Sold. |
| **Gross Profit** | Revenue minus COGS. |
| **OpEx** | Total operating expenses (Personnel \+ Fixed OpEx). |
| **Net Burn** | Gross Profit minus OpEx. Negative \= burning cash. |
| **Cash Balance** | Running cash position. |
| **Runway** | Months of runway remaining from this month, given current net burn. |

Cell behavior in months with CSV actuals: projected value displayed in muted gray with strikethrough; actual value in full contrast black; variance displayed below in red (negative) or green (positive).

## **9.4 Runway Tripwire Definition**

The Runway Tripwire is the projected calendar date on which the Cash Balance first reaches $0, given the current active scenario's block configuration and the last known actual cash balance. It is:

* Displayed as a labeled vertical line on the Runway Chart.

* Displayed as a standalone metric at the top of the dashboard (e.g., 'Runway: Aug 2027 — 17 months').

* Updated dynamically whenever any block, global variable, or scenario toggle is changed and recalculated.

* Recalculated against all scenarios on CSV ingestion (results rendered lazily per scenario).

# **10\. Known Risks & Engineering Constraints**

| Risk | Impact | Mitigation |
| :---- | :---- | :---- |
| **CSV Mapping Fatigue (500+ row files)** | High abandonment at import step. | Opt-in auto-mapping suggestions. User must manually confirm every category assignment. |
| **Toggle Performance at Scale (100+ blocks)** | Chart rendering lag; potential crashes. | Synchronous lock with 1–2s spinner on recalculation. Real-time rendering is explicitly out of scope. |
| **Deep Dependency Chains** | Cascading recalculation latency. | Unlimited depth supported; 1–2s latency trade-off accepted and communicated to user via spinner. |
| **Uncategorized Suspense Balance** | False-positive runway projections. | Non-dismissible red warning on dashboard when Suspense \> $0. |
| **First CSV partial month** | Massive false variance alert on startup month. | 'Ignore Variance' flag available exclusively for the startup month. |

# **Appendix: Key Product Decisions Log**

This appendix documents the rationale behind non-obvious product decisions to prevent re-litigation during development.

### **A1. Hard Copy Scenarios vs. Live Inheritance**

Decision: Scenarios are static forks with no live parent-child inheritance. Rationale: Live inheritance creates hidden mutation risks — a change to the parent silently propagates to all children, corrupting separate planning universes. Hard copies are predictable and auditable.

### **A2. Driver-Based Reference Fields vs. Closed-Logic Block Types**

Decision: Any numeric field can reference any block output, rather than building bespoke block types for every cost pattern. Rationale: Founders need to model the real physics of their business (e.g., AWS cost \= % of revenue; licenses \= headcount multiplier). A reference field system provides extreme flexibility without requiring dozens of narrow block types.

### **A3. Dependency UI via Dropdown vs. Visual Connectors**

Decision: Parent-child relationships are configured via dropdown menus inside the child block's property panel, not by drawing arrows on the canvas. Rationale: Visual connectors create extreme clutter in complex models and add significant frontend development cost. Dropdowns are faster to build, easier to use, and scale cleanly.

### **A4. MRR as Primary Revenue Input**

Decision: The Revenue block uses MRR as its primary planning unit, with a Billing Frequency selector (Monthly / Annual Prepaid). Rationale: SaaS founders plan in MRR, but survival depends on actual cash. The Billing Frequency field bridges the gap automatically — annual prepay injects 12 months of cash in Month 1 without forcing manual calculation.

### **A5. No Automated Tax Calculation**

Decision: Taxes are modeled as manual OpEx or one-time outflow blocks in specific payment months. Rationale: Calculating net taxable income and applying jurisdiction-specific rates introduces legal and technical complexity that is out of scope for V1. Manual tax entries keep the math rigorous while avoiding compliance liability.

### **A6. Hard Restatement Deferred to V2**

Decision: The ability to reopen and re-categorize historically closed months is deferred to V2. Rationale: The feature is high-complexity, high-risk, and low-frequency for early-stage founders with limited history. V1 replacement: a manual adjustment entry in the current month can correct the effective impact of a past miscategorization.

### **A7. Annual Billing — No Prorated Refund on Cancellation**

Decision: Annual contract cancellations do not generate automatic prorated refunds in the model. The full cash inflow is retained in Month 1\. Rationale: Prorated refund modeling adds complexity with minimal practical impact for early-stage planning. Founders can model known refund obligations with a manual Capital or OpEx block.