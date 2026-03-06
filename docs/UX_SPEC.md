# **P3: Frontend Architecture & UX Spec**

As the Principal Frontend Architect, I have evaluated the Product Requirements Document (PRD) and the Unified Data & API Contract for the P3 Financial Projection Engine. To ensure absolute alignment between the UX vision and the Next.js 14+ technical implementation, this document enforces a strict, contract-driven architecture.

Global client state for domain data is strictly **FORBIDDEN**. All view states, active scenarios, and filters **MUST** be driven by URL Search Parameters to guarantee linkability and predictability. All server state **MUST** be synchronized via React Query.

### **1\. Design System & Global Tokens**

"Artisanal" styling is **FORBIDDEN**. All visual rules **MUST** be constrained to standard Tailwind CSS tokens to support the deterministic, SaaS-focused nature of P3.

* **Typography:** We **MUST** use a highly legible, dense sans-serif font optimized for financial data (e.g., standard Tailwind font-sans mapped to Inter or Geist). Tabular nums (tabular-nums) **MUST** be enforced globally on all numerical outputs to prevent horizontal layout shifting in tables and canvas blocks.  
* **Color Palette (Semantic Tokens):**  
  * background & foreground: Standard light/dark mode base.  
  * primary: Used for primary actions (e.g., "Month Close" execution ).  
  * muted & muted-foreground: Used extensively in dominated months where projected values are silenced by CSV actuals.  
  * destructive: Reserved strictly for destructive CSV overwrites and the non-dismissible Uncategorized Suspense warning.  
  * success: Standard Tailwind green for positive variance indicators.

### **2\. Component Library (Shadcn/UI "Lego Bricks")**

The application **MUST** be composed exclusively of the following Shadcn/UI primitives to maintain rigid consistency and accelerate frontend delivery:

* **Card:** The fundamental container for the visual canvas of Building Blocks.  
* **Select / Dropdown Menu:** **MUST** be used for the dropdown-based dependency system linking parent and child blocks. Visual connectors (arrows) are explicitly out of scope.  
* **Table:** The core component for the output dashboard's month-by-month financial table.  
* **Dialog (Modal):** **MUST** be utilized for the Diff View confirmation step required before executing a Month Close that overwrites previously closed data.  
* **Alert / Alert Dialog:** Used for critical system warnings, such as the multi-currency hard block or duplicate CSV detection quarantine.  
* **Switch (Toggle):** Used for the What-If Mode block toggles (on/off) running locally in the browser.  
* **Checkbox:** Used during the auto-mapping assistance phase where users must explicitly opt-in to category assignments.

### **3\. File System & Routing Structure (Next.js 14+ App Router)**

The directory structure **MUST** utilize Route Groups to separate authentication from the core application context. The active workspace and scenario are the fundamental organizing principles of the URL hierarchy.

Plaintext

app/  
├── (auth)/  
│   ├── login/page.tsx  
│   └── register/page.tsx  
├── (app)/  
│   ├── layout.tsx                     \# Injects UserContextDTO, persistent sidebar \[cite: 138, 255\]  
│   └── workspace/\[workspaceId\]/  
│       ├── layout.tsx                 \# Loads active workspace context  
│       ├── page.tsx                   \# Redirects to default active baseline scenario \[cite: 298\]  
│       ├── scenarios/  
│       │   ├── \[scenarioId\]/  
│       │   │   ├── layout.tsx         \# Injects ScenarioDTO & BlockDTOs \[cite: 315, 324\]  
│       │   │   ├── page.tsx           \# The Projection Canvas & Building Blocks \[cite: 75, 78\]  
│       │   │   └── dashboard/page.tsx \# Output Dashboard (Runway Chart & Financial Table) \[cite: 165, 168\]  
│       ├── import/  
│       │   └── page.tsx               \# CSV Ingestion & Mapping Wizard \[cite: 40, 54\]  
│       └── actuals/  
│           ├── page.tsx               \# Draft/Closed state management \[cite: 39\]  
│           └── \[monthId\]/page.tsx     \# Month Close execution & Health Score review \[cite: 156, 163\]

## **Phase 2: Vertical UI Specification \- The Projection Canvas**

We will begin by defining the core workspace of the application: **The Projection Canvas**. This is the primary interface where founders build their forward-looking financial model.

### **1\. UX Mental Model & Journey**

The Canvas must feel like a visual, structured, and formula-free timeline. Users do not write raw formulas; instead, they add discrete "Building Blocks" representing business activities (e.g., hiring a role, adding a marketing budget). The user journey involves creating these blocks, configuring their specific variables in a property panel, and explicitly linking them via dropdown-based dependencies. Because real-time recalculation of deep dependency chains is out of scope for V1, the mental model must establish a rhythm of "configure \-\> apply \-\> calculate" with explicit system feedback.

### **2\. Route & Component Tree**

**Route:** (app)/workspace/\[workspaceId\]/scenarios/\[scenarioId\]/page.tsx

The DOM structure **MUST** strictly adhere to the ScenarioDTO and BlockDTO contracts.

* ScenarioCanvasLayout  
  * GlobalAssumptionsSidebar  
    * AssumptionInputRow \<- Mapped to \-\> ScenarioDTO.globalAssumptions\[key\]  
  * CanvasArea  
    * InactivesTray \<- Mapped to \-\> ScenarioDTO.blocks (filtered where isActive \=== false)  
    * BlockList \<- Mapped to \-\> ScenarioDTO.blocks (filtered where isActive \=== true)  
      * BlockCard (Shadcn Card)  
        * BlockHeader  
          * BlockTitle \<- Mapped to \-\> BlockDTO.type (e.g., 'Personnel', 'Revenue')  
          * BlockToggle (Shadcn Switch) \<- Mapped to \-\> BlockDTO.isActive  
        * BlockPropertyPanel  
          * DynamicInputRow \<- Mapped to \-\> BlockDTO.properties\[key\]  
          * DependencySelect (Shadcn Select) \<- Mapped to \-\> BlockDTO.properties.referenceId (Internal mapping logic)

### **3\. Interaction & Mutation Schema (The Bridge)**

Every interaction on the canvas maps to a strict Server Action and Zod schema. What-If toggles operate locally before applying.

* **Action:** Add New Block  
  * **Trigger:** Click "Add Block" button.  
  * **Server Action:** createBlockMutation  
  * **Zod Schema:** CreateBlockSchema (Validates type enum: 'Personnel', 'Revenue', 'Marketing', 'OpEx', 'Capital' and properties object).  
* **Action:** Soft Disable Block (What-If Mode)  
  * **Trigger:** Toggle BlockToggle switch off.  
  * **State:** Temporarily mutates local URL Search Params (e.g., ?inactiveBlocks=blk\_998877). Does NOT persist to DB immediately.  
  * **Server Action (on Apply):** updateScenarioBlocksMutation (updates BlockDTO.isActive to false).  
* **Action:** Configure Dependency  
  * **Trigger:** Select a parent block from the DependencySelect dropdown.  
  * **Validation:** Graph validation MUST run prior to selection. Downstream blocks MUST be rendered as disabled in the dropdown options to prevent circular dependencies.  
* **Action:** Delete Parent Block  
  * **Trigger:** Click "Delete" on a block.  
  * **Validation:** Action is **FORBIDDEN** and blocked by the UI if the block has dependent Child Blocks or projected future impacts. User must unlink downstream cascade first.

### **4\. Finite State Machine (FSM)**

* **Loading (Initial):** CanvasArea MUST render Shadcn Skeleton cards matching the average height of BlockCard components.  
* **Loading (Recalculation):** When a block is edited, toggled, or a dependency is changed, the UI MUST trigger a synchronous lock over the canvas with a full-screen or container-level 1–2 second loading Spinner.  
* **Error (Circular Dependency):** If a user attempts to force a circular connection, the dropdown MUST snap-back to the previous state and trigger a Shadcn Toast with a destructive variant.  
* **Empty State:** If the workspace has no blocks and no starting\_cash\_balance, the canvas MUST be completely locked. The UI MUST display a mandatory input overlay for "Starting Cash Balance".

### **5\. Microcopy Table**

| UI Element | Component Type | Exact Copy |
| :---- | :---- | :---- |
| Empty State Prompt | Dialog / Card | "Set your Starting Cash Balance to unlock the canvas." |
| Global Variables Header | Sidebar Title | "Global Assumptions" |
| Add Block Button | Button (Primary) | "Add Block" |
| Inactives Tray Label | Accordion / Header | "Inactive Projections" |
| Recalculating Overlay | Spinner \+ Text | "Recalculating model..." |
| Circular Error | Toast (Destructive) | "Circular dependency detected. This connection is not allowed." |
| Deletion Guard Error | Toast (Destructive) | "Cannot delete block. Please remove downstream dependencies first." |

---

## **Phase 2: Vertical UI Specification \- The Output Dashboard**

### **1\. UX Mental Model & Journey**

The Output Dashboard is the synthesized "source of truth." While the Canvas is for *building* the model, the Dashboard is for *consuming* the results. The mental model is a traditional financial statement combined with a visual runway burn-down chart. Users will toggle between timeframes (e.g., Monthly vs. Quarterly) and compare projected metrics against historical actuals (once a month is closed). The UI **MUST** clearly visually delineate future projections from closed historical actuals.

### **2\. Route & Component Tree**

**Route:** (app)/workspace/\[workspaceId\]/scenarios/\[scenarioId\]/dashboard/page.tsx

The structure relies heavily on the aggregated data output. Tabular data **MUST** use tabular-nums in Tailwind to prevent horizontal shifting.

* DashboardLayout  
  * DashboardHeader  
    * TimeframeToggle (Shadcn Tabs or ToggleGroup) \<- Mapped to \-\> URL Search Params ?timeframe=monthly|quarterly|annual  
  * RunwayChartCard (Shadcn Card)  
    * ChartContainer \<- Mapped to \-\> ScenarioDTO.projectedCashBalance array  
    * RunwayIndicator \<- Mapped to \-\> ScenarioDTO.runwayMonths  
  * FinancialDataCard (Shadcn Card)  
    * FinancialTable (Shadcn Table)  
      * TableHeaderRow  
        * MonthHeader \<- Mapped to \-\> ScenarioDTO.months\[i\].label  
      * TableBody  
        * RevenueSection \<- Mapped to \-\> ScenarioDTO.financials.revenue  
        * OpExSection \<- Mapped to \-\> ScenarioDTO.financials.opex  
        * NetBurnRow \<- Mapped to \-\> ScenarioDTO.financials.netBurn  
        * EndingCashRow \<- Mapped to \-\> ScenarioDTO.financials.endingCash

### **3\. Interaction & Mutation Schema (The Bridge)**

This view is predominantly read-only. State is driven entirely by URL parameters to ensure the dashboard can be shared with investors or stakeholders as a direct link.

* **Action:** Change Timeframe Resolution  
  * **Trigger:** Click "Quarterly" on the TimeframeToggle.  
  * **State Mutation:** Updates URL to ?timeframe=quarterly.  
  * **Data Fetching:** React Query detects URL change, triggers a re-fetch or re-aggregation of the ScenarioDTO data on the client if raw monthly data is already cached. Server Actions are NOT required for this read-only transformation.  
* **Action:** Export to CSV (Optional Utility)  
  * **Trigger:** Click "Export Data" button.  
  * **Server Action:** exportScenarioData  
  * **Zod Schema:** ExportRequestSchema (Validates scenarioId and timeframe).

### **4\. Finite State Machine (FSM)**

* **Loading (Initial):** The page **MUST** display a large Shadcn Skeleton for the chart area and a series of row Skeleton elements for the FinancialTable.  
* **Loading (Timeframe Switch):** If the client-side aggregation takes longer than 300ms, a subtle opacity transition (e.g., opacity-50) **SHOULD** be applied to the table with a localized Shadcn Spinner overlay.  
* **Error (Data Fetch Failure):** Display a Shadcn Alert (Destructive) indicating the projection engine failed to compile the results, with a "Retry Calculation" button to trigger a React Query invalidation.  
* **Empty State:** If the model has no blocks and no starting cash balance, the dashboard **MUST** display an empty state Card directing the user back to the Canvas.

### **5\. Microcopy Table**

| UI Element | Component Type | Exact Copy |
| :---- | :---- | :---- |
| Runway Metric Label | Typography (Muted) | "Projected Runway" |
| Zero Runway Warning | Badge (Destructive) | "Cash Out" |
| Monthly Toggle | ToggleGroupItem | "Monthly" |
| Quarterly Toggle | ToggleGroupItem | "Quarterly" |
| Historical Data Marker | Column Header Badge | "Actuals" |
| Projected Data Marker | Column Header Badge | "Projected" |
| Empty State CTA | Button (Primary) | "Build Model in Canvas" |

---

## 

## **Phase 2: Vertical UI Specification \- CSV Ingestion & Mapping Wizard**

### **1\. UX Mental Model & Journey**

The CSV Ingestion flow is the critical bridge between the founder's theoretical projection and their actual bank reality. The mental model is a "Triage Pipeline." Users upload their accounting export, the system auto-maps recognized transactions to existing Building Blocks, and the user must manually triage the remaining "Uncategorized" items. Because V1 strictly enforces single-currency (USD), the system **MUST** aggressively reject multi-currency files upfront. The user journey is: Upload \-\> Review Auto-Mappings \-\> Resolve Suspense Items \-\> Commit to a Draft Month.

### **2\. Route & Component Tree**

**Route:** (app)/workspace/\[workspaceId\]/import/page.tsx

The DOM structure **MUST** explicitly map to the ImportCsvSchema and the resulting HistoricalRecordDTO arrays.

* ImportWizardLayout  
  * UploadSection (Visible when no file is parsed)  
    * FileDropzone (Shadcn Card \+ native \<input type="file"\>) \<- Mapped to \-\> ImportCsvSchema.fileData  
  * MappingTriageSection (Visible post-upload)  
    * TriageHeader  
      * SuspenseCounter (Shadcn Badge) \<- Mapped to \-\> Count of HistoricalRecordDTO where isSuspense \=== true  
      * FilterToggle (Shadcn Tabs) \<- Mapped to \-\> URL Search Params ?filter=all|suspense|mapped  
    * TransactionTable (Shadcn Table)  
      * TransactionRow \<- Mapped to \-\> HistoricalRecordDTO  
        * DateCell \<- Mapped to \-\> HistoricalRecordDTO.date  
        * DescriptionCell \<- Mapped to \-\> HistoricalRecordDTO.description  
        * AmountCell \<- Mapped to \-\> HistoricalRecordDTO.amount (Tabular nums enforced)  
        * CategorySelect (Shadcn Select) \<- Mapped to \-\> HistoricalRecordDTO.accountName  
    * CommitActions  
      * CommitButton (Shadcn Button)

### **3\. Interaction & Mutation Schema (The Bridge)**

Data manipulation during triage happens in local component state (via React Hook Form or standard React state) before being committed in bulk. Storing the parsed CSV array in Zustand or Context is strictly **FORBIDDEN**.

* **Action:** File Upload & Initial Parse  
  * **Trigger:** User drops file into FileDropzone.  
  * **Server Action:** parseCsvMutation  
  * **Zod Schema:** ImportCsvSchema (Strict validation: currency **MUST** be 'USD'. Rejects file otherwise).  
* **Action:** Change Transaction Category  
  * **Trigger:** User selects a new category from CategorySelect for a specific row.  
  * **State Mutation:** Updates the local React state array for that specific HistoricalRecordDTO, toggling isSuspense to false if a valid category is selected.  
* **Action:** Filter Transactions  
  * **Trigger:** User clicks "Uncategorized" in the FilterToggle.  
  * **State Mutation:** Updates URL to ?filter=suspense. UI derives visible rows based on this URL parameter.  
* **Action:** Commit Mapped Month  
  * **Trigger:** Click "Save as Draft Month".  
  * **Server Action:** commitDraftMonthMutation  
  * **Zod Schema:** Array of HistoricalRecordDTO.  
  * **Validation:** If any records still have isSuspense \=== true, the system **MUST** present a confirmation dialog warning the user that these will be tracked as uncategorized burn.

### **4\. Finite State Machine (FSM)**

* **Empty State (Initial):** Show the UploadSection with clear drag-and-drop affordances. The MappingTriageSection is completely unmounted.  
* **Loading (Parsing):** Display a Shadcn Progress bar or Spinner within the dropzone indicating file processing and auto-matching.  
* **Error (Currency Block):** If ImportCsvSchema fails the USD validation, render a Shadcn Alert (Destructive) with the exact message: "V1 is strictly single-currency. Please normalize externally." The file processing **MUST** halt immediately.  
* **Optimistic UI (Categorization):** When a user changes a category via CategorySelect, the UI **MUST** immediately update the row visually (removing the warning styling) and decrement the SuspenseCounter without waiting for a server round-trip.

### **5\. Microcopy Table**

| UI Element | Component Type | Exact Copy |
| :---- | :---- | :---- |
| Upload Dropzone | Card / Text | "Drag and drop your bank or accounting CSV here" |
| Format Requirement | Typography (Muted) | "Supported: .csv (USD only)" |
| Currency Error | Alert (Destructive) | "V1 is strictly single-currency. Please normalize externally." |
| Suspense Filter Tab | TabsTrigger | "Needs Review" |
| Mapped Filter Tab | TabsTrigger | "Categorized" |
| Uncategorized Warning | DialogHeader | "You have uncategorized transactions." |
| Uncategorized Context | DialogDescription | "Items left in suspense will simply reduce your cash balance without being assigned to a specific projection block. Proceed?" |
| Commit Action | Button (Primary) | "Save as Draft Month" |

---

## **Phase 2: Vertical UI Specification \- Month Close & Health Score Review**

### **1\. UX Mental Model & Journey**

This is the "Moment of Truth" in the P3 engine. The founder has triaged their bank data (Draft Month) and is now comparing what they *projected* against what actually *happened*. The mental model is an "Accountability Report." The system displays a side-by-side variance analysis and calculates a Health Score based on accuracy.

Crucially, the user journey ends with a high-friction action: The "Month Close." Closing a month is a destructive action that overwrites the theoretical projection for that specific month with the hard actuals from the CSV. Because V1 does not support Hard Restatements (reopening closed months), this action **MUST** be gated behind a strict confirmation flow (Diff View). Once closed, the page transitions into a read-only historical artifact.

### **2\. Route & Component Tree**

**Route:** (app)/workspace/\[workspaceId\]/actuals/\[monthId\]/page.tsx

The DOM structure **MUST** explicitly map to the Monthly Period DTOs and the aggregated variance data. Tabular layouts **MUST** use tabular-nums.

* MonthCloseLayout  
  * MonthHeader  
    * MonthTitle \<- Mapped to \-\> MonthlyPeriodDTO.monthLabel  
    * StatusBadge (Shadcn Badge) \<- Mapped to \-\> MonthlyPeriodDTO.status ('Draft' | 'Closed')  
  * HealthScoreCard (Shadcn Card)  
    * ScoreDisplay \<- Mapped to \-\> MonthlyPeriodDTO.healthScore  
    * VarianceSummary \<- Mapped to \-\> Aggregated Projected vs Actual totals  
  * VarianceTable (Shadcn Table)  
    * TableHeader (Category, Projected, Actual, Variance)  
    * TableBody  
      * VarianceRow \<- Mapped to \-\> Joined BlockDTO (Projection) and HistoricalRecordDTO (Actual)  
        * BlockNameCell \<- Mapped to \-\> BlockDTO.type  
        * ProjectedCell \<- Mapped to \-\> Calculated Block Value  
        * ActualCell \<- Mapped to \-\> Sum of HistoricalRecordDTO.amount for category  
        * DeltaCell \<- Mapped to \-\> Actual \- Projected  
  * CloseActionSection (Rendered only if status \=== 'Draft')  
    * DiffReviewDialog (Shadcn Dialog / Modal)  
      * DiffSummary \<- Mapped to \-\> Delta of StartingCash vs EndingCash  
      * ConfirmCloseButton (Shadcn Button \- Primary/Destructive hybrid)

### **3\. Interaction & Mutation Schema (The Bridge)**

This view handles the highest-stakes mutation in the application.

* **Action:** Open Diff Review  
  * **Trigger:** Click "Review & Close Month" button.  
  * **State:** Local component state opens the DiffReviewDialog. No server mutation yet.  
* **Action:** Execute Month Close  
  * **Trigger:** Click "Confirm & Lock Month" inside the Dialog.  
  * **Server Action:** closeMonthMutation  
  * **Zod Schema:** CloseMonthRequestSchema (Validates monthId and explicit userConfirmation: z.literal(true)).  
  * **Post-Mutation:** React Query invalidates the scenario data, triggering a re-fetch. The UI transitions to the 'Closed' read-only state.  
* **Action:** Ignore Variance (Optional Utility)  
  * **Trigger:** Toggle "Ignore Variance" on a specific VarianceRow (e.g., for a one-off anomaly that shouldn't impact future projections).  
  * **Server Action:** updateVarianceSettingMutation  
  * **Zod Schema:** UpdateVarianceSchema (Updates ignoreVariance boolean).

### **4\. Finite State Machine (FSM)**

* **Loading:** Display a full-page layout of Shadcn Skeleton blocks matching the HealthScoreCard and VarianceTable dimensions while React Query fetches the aggregated comparison.  
* **Error (Out of Order Close):** If the user attempts to close a month while previous months remain in 'Draft' status, the Server Action **MUST** reject the request. The UI **MUST** display a Shadcn Alert (Destructive) stating: "Months must be closed chronologically. Please close \[Previous Month\] first." The Close button **MUST** be disabled.  
* **State: Draft (Interactive):** CloseActionSection is active. Variances are highlighted (red/green based on positive/negative burn impact).  
* **State: Closed (Read-Only):** The CloseActionSection unmounts entirely. The StatusBadge changes to a muted 'Closed'. A prominent informational Alert **MUST** be rendered at the top stating: "This month is locked and historical. Restatements are not supported in V1."

### **5\. Microcopy Table**

| UI Element | Component Type | Exact Copy |
| :---- | :---- | :---- |
| Draft Status | Badge (Default) | "Draft \- Pending Close" |
| Closed Status | Badge (Muted) | "Locked & Closed" |
| Health Score Label | Typography | "Projection Accuracy Score" |
| Chronology Error | Alert (Destructive) | "Months must be closed chronologically. Please close \[Previous Month\] first." |
| Pre-Close Trigger | Button (Primary) | "Review & Close Month" |
| Diff Dialog Title | DialogTitle | "Confirm Month Close" |
| Diff Dialog Warning | DialogDescription | "Closing this month will overwrite your projections with actual bank data and lock the period. This cannot be undone in V1. Do you wish to proceed?" |
| Final Confirm Action | Button (Destructive) | "Confirm & Lock Month" |
| Read-Only Notice | Alert (Info) | "This month is locked and historical. Restatements are not supported in V1." |

---

## **Phase 2: Vertical UI Specification \- Authentication & Global Navigation Shell**

### **1\. UX Mental Model & Journey**

The authentication flow **MUST** be a frictionless, high-conversion entry point. Because V1 strictly targets single-user accounts (no multi-seat/enterprise features), the mental model is a direct 1:1 relationship between the user and their workspace. Upon successful login or registration, the system bypasses complex tenant-switching and routes the user directly into their default Workspace and active Scenario.

The Global Navigation Shell (Sidebar) serves as the persistent anchor for the application. It visually reinforces the three primary phases of the P3 workflow: 1\. Build (Canvas), 2\. Triage (Import), 3\. Review (Dashboard & Actuals).

### **2\. Route & Component Tree**

**Routes:** \* (auth)/login/page.tsx & (auth)/register/page.tsx

* (app)/layout.tsx (Injects the Global Navigation)

The DOM structure relies on standard Shadcn form primitives and a responsive layout wrapper.

* AuthLayout (Centered flex container, bg-muted background)  
  * AuthCard (Shadcn Card)  
    * AuthHeader (Logo and Title)  
    * LoginForm OR RegisterForm (Shadcn Form)  
      * EmailInput \<- Mapped to \-\> UserDTO.email  
      * PasswordInput \<- Mapped to \-\> (Internal auth handler)  
      * SubmitButton (Shadcn Button)  
* AppLayout (Rendered post-auth)  
  * GlobalSidebar (Fixed aside on desktop, Shadcn Sheet on mobile)  
    * WorkspaceHeader \<- Mapped to \-\> OrganizationDTO.name  
    * NavigationMenu  
      * NavItem (Canvas) \<- Links to \-\> .../scenarios/\[scenarioId\]  
      * NavItem (Dashboard) \<- Links to \-\> .../scenarios/\[scenarioId\]/dashboard  
      * NavItem (Import CSV) \<- Links to \-\> .../import  
      * NavItem (Actuals History) \<- Links to \-\> .../actuals  
    * UserProfileFooter  
      * UserMenu (Shadcn DropdownMenu) \<- Mapped to \-\> UserDTO.first\_name  
  * MainContentArea (Yields children routes)

### **3\. Interaction & Mutation Schema (The Bridge)**

Authentication state **MUST** be handled via secure HTTP-only cookies managed by the Next.js server, not local storage or global client state.

* **Action:** Submit Login / Registration  
  * **Trigger:** Click "Sign In" or "Create Account".  
  * **Server Action:** loginMutation or registerMutation  
  * **Zod Schema:** AuthCredentialsSchema (Validates email format and strict password strength).  
  * **Post-Mutation:** Server sets secure session cookie and triggers redirect('/workspace/\[defaultWorkspaceId\]').  
* **Action:** Logout  
  * **Trigger:** Select "Log out" from UserMenu.  
  * **Server Action:** logoutAction (Destroys session cookie, redirects to /login).  
* **Action:** Mobile Sidebar Toggle  
  * **Trigger:** Click Hamburger icon (mobile only).  
  * **State Mutation:** Toggles local boolean state to open Shadcn Sheet. This is an acceptable use of local React state as it is an ephemeral UI preference, not domain data.

### **4\. Finite State Machine (FSM)**

* **Loading (Auth Submit):** The SubmitButton **MUST** disable and display a Shadcn Spinner inline with the button text to prevent duplicate submissions.  
* **Error (Invalid Credentials):** If the loginMutation fails, the Server Action returns an error object. The UI **MUST** display this via a Shadcn Alert (Destructive) positioned at the top of the AuthCard, pushing the form down. Inline field errors (e.g., "Invalid email format") **MUST** be handled synchronously by Zod resolver before hitting the server.  
* **Empty State (Workspace Initialization):** If a user registers but the backend fails to provision the default organizations row, the AppLayout **MUST** intercept the missing OrganizationDTO and display a full-screen blocking Card prompting the user to "Name your Workspace" via a createWorkspaceMutation.

### **5\. Microcopy Table**

| UI Element | Component Type | Exact Copy |
| :---- | :---- | :---- |
| Login Heading | CardTitle | "Welcome back to P3" |
| Registration Heading | CardTitle | "Start Modeling Your Runway" |
| Email Label | FormLabel | "Work Email" |
| Auth Error Banner | Alert (Destructive) | "Invalid email or password. Please try again." |
| Sidebar: Build Phase | NavLabel (Muted) | "MODELING" |
| Sidebar: Canvas Link | NavLink | "Projection Canvas" |
| Sidebar: Output Link | NavLink | "Runway Dashboard" |
| Sidebar: Reality Phase | NavLabel (Muted) | "ACTUALS" |
| Sidebar: Import Link | NavLink | "Import Bank CSV" |
| Sidebar: History Link | NavLink | "Month Close & History" |

---

## **Phase 2: Vertical UI Specification \- Period Management & History**

### **1\. UX Mental Model & Journey**

The Period Management page acts as the founder's "Financial Ledger" or "Archive." While the \[monthId\] route is for the high-friction *action* of closing a month, this root /actuals page is the macro *view* of their track record. The mental model is a chronological timeline of performance.

Users come here to do two things: 1\. Find the current pending 'Draft' month to resume their triage/close process, or 2\. Review historical 'Closed' months to observe trends in their Projection Health Scores. The UI **MUST** clearly differentiate actionable drafts from locked historical records.

### **2\. Route & Component Tree**

**Route:** (app)/workspace/\[workspaceId\]/actuals/page.tsx

The DOM structure maps to an array of MonthlyPeriodDTO objects. To support scannability, we will utilize a tabular or list-based layout with strict tabular-nums for any aggregated metrics.

* PeriodManagementLayout  
  * PageHeader  
    * Title (Typography H2)  
    * FilterToggle (Shadcn Tabs or Select) \<- Mapped to \-\> URL Search Params ?filter=all|draft|closed  
  * PeriodList (Shadcn Table or stacked Card list)  
    * PeriodRow \<- Mapped to \-\> MonthlyPeriodDTO (Array mapping)  
      * MonthCell \<- Mapped to \-\> MonthlyPeriodDTO.monthLabel  
      * StatusCell  
        * StatusBadge (Shadcn Badge) \<- Mapped to \-\> MonthlyPeriodDTO.status  
      * HealthScoreCell \<- Mapped to \-\> MonthlyPeriodDTO.healthScore  
      * ActionCell  
        * MapsButton (Shadcn Button \- Variant: Ghost/Link) \<- Routes to \-\> /actuals/\[periodId\]

### **3\. Interaction & Mutation Schema (The Bridge)**

This view is primarily a read-only navigation hub. State is driven by URL parameters.

* **Action:** Filter Periods  
  * **Trigger:** User selects 'Drafts Only' or 'Closed History' from the FilterToggle.  
  * **State Mutation:** Updates URL to ?filter=draft or ?filter=closed.  
  * **Data Fetching:** React Query re-filters the cached array of MonthlyPeriodDTOs or fetches the updated list if not cached.  
* **Action:** Navigate to Period Detail  
  * **Trigger:** Click on a specific PeriodRow or its MapsButton.  
  * **Routing:** standard Next.js \<Link\> component pushes the user to the \[monthId\] route. No server mutation required.

### **4\. Finite State Machine (FSM)**

* **Loading:** Render a series of Shadcn Skeleton rows matching the height of the PeriodRow components.  
* **Empty State (No Imports Yet):** If the array of MonthlyPeriodDTO is completely empty, the system **MUST** render a Shadcn Card containing an empty state illustration/icon, explaining that history begins once bank data is imported. It **MUST** include a primary CTA button routing to the /import page.  
* **Empty State (Filter Yields No Results):** If the user filters by ?filter=draft but all months are closed, display a muted text message indicating no matching periods, rather than the full "No Imports" card.

### **5\. Microcopy Table**

| UI Element | Component Type | Exact Copy |
| :---- | :---- | :---- |
| Page Title | Typography | "Financial History & Actuals" |
| Filter: All | TabsTrigger | "All Periods" |
| Filter: Drafts | TabsTrigger | "Pending Close" |
| Filter: Closed | TabsTrigger | "Historical" |
| Draft Badge | Badge (Default) | "Draft" |
| Closed Badge | Badge (Secondary/Muted) | "Closed" |
| Empty State Title | CardTitle | "No Financial History Found" |
| Empty State Body | CardDescription | "Your track record starts here. Import your first CSV of actual bank transactions to generate a draft month and calculate your first health score." |
| Empty State CTA | Button (Primary) | "Import Bank Data" |

