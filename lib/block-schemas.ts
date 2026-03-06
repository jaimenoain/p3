/**
 * Shared Zod schemas and types for block payloads and dependency config.
 * Used by server actions and by the 30/360 calculation engine for parsing JSONB.
 */

import { z } from "zod";

export const BlockTypeSchema = z.enum([
  "Personnel",
  "Revenue",
  "Marketing",
  "OpEx",
  "Capital",
]);

export type BlockType = z.infer<typeof BlockTypeSchema>;

const MonthStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format");

export const NumericInputModeSchema = z.enum([
  "Static",
  "Referenced",
  "Formula",
]);

export const NumericInputConfigSchema = z.object({
  mode: NumericInputModeSchema,
  value: z.number().optional(),
  referenceId: z.string().uuid().optional(),
  formula: z.string().optional(),
});

export type NumericInputMode = z.infer<typeof NumericInputModeSchema>;
export type NumericInputConfig = z.infer<typeof NumericInputConfigSchema>;

export const BlockDependenciesSchema = z.object({
  dependencies: z
    .record(z.string(), NumericInputConfigSchema)
    .optional(),
});

const PersonnelRoleTypeSchema = z.enum(["standard", "sales"]);

export const PersonnelPayloadSchema = z
  .object({
    roleName: z.string().min(1, "Role name is required"),
    monthlyGrossSalary: z
      .coerce.number()
      .min(0, "Monthly gross salary must be 0 or greater"),
    employerBurdenPercent: z
      .coerce.number()
      .min(0, "Employer burden % must be between 0 and 1")
      .max(1, "Employer burden % must be between 0 and 1"),
    startMonth: MonthStringSchema,
    endMonth: MonthStringSchema.optional().nullable(),
    headcountCount: z
      .coerce.number()
      .int("Headcount must be an integer")
      .min(1, "Headcount must be at least 1"),
    roleType: PersonnelRoleTypeSchema.optional().default("standard"),
    salesClientsPerMonth: z
      .union([
        z.coerce
          .number()
          .min(0, "New clients per month must be 0 or greater"),
        z.null(),
      ])
      .optional(),
    salesMonthsToFirstClient: z
      .union([
        z.coerce
          .number()
          .int("Months until first client must be an integer")
          .min(0, "Months until first client cannot be negative"),
        z.null(),
      ])
      .optional(),
  })
  .merge(BlockDependenciesSchema);

const BillingFrequencySchema = z.enum(["Monthly", "Annual Prepaid"]);

export const RevenuePayloadSchema = z
  .object({
    startingMrr: z
      .coerce.number()
      .min(0, "Starting MRR must be 0 or greater"),
    arpa: z.coerce.number().min(0, "ARPA must be 0 or greater"),
    monthlyChurnPercent: z
      .coerce.number()
      .min(0, "Monthly churn % must be between 0 and 1")
      .max(1, "Monthly churn % must be between 0 and 1"),
    monthlyMrrGrowthPercent: z
      .union([
        z
          .coerce.number()
          .min(0, "Upsell / expansion growth % must be between 0 and 1")
          .max(1, "Upsell / expansion growth % must be between 0 and 1"),
        z.null(),
      ])
      .optional(),
    billingFrequency: BillingFrequencySchema,
  })
  .merge(BlockDependenciesSchema);

export const MarketingPayloadSchema = z
  .object({
    monthlyAdSpend: z
      .coerce.number()
      .min(0, "Monthly ad spend must be 0 or greater"),
    targetCac: z
      .coerce.number()
      .min(0, "Target CAC must be 0 or greater"),
    salesCycleLagMonths: z
      .coerce.number()
      .int("Sales cycle lag must be an integer number of months")
      .min(0, "Sales cycle lag cannot be negative"),
  })
  .merge(BlockDependenciesSchema);

export const OpExPayloadSchema = z
  .object({
    expenseName: z.string().min(1, "Expense name is required"),
    monthlyCost: z
      .coerce.number()
      .min(0, "Monthly cost must be 0 or greater"),
    annualGrowthRatePercent: z
      .coerce.number()
      .min(0, "Annual growth rate % must be between 0 and 1")
      .max(1, "Annual growth rate % must be between 0 and 1"),
  })
  .merge(BlockDependenciesSchema);

const FundingTypeSchema = z.enum(["Equity", "Debt"]);

export const CapitalPayloadSchema = z
  .object({
    fundingType: FundingTypeSchema,
    amount: z.coerce.number().min(0, "Amount must be 0 or greater"),
    monthReceived: MonthStringSchema,
  })
  .merge(BlockDependenciesSchema);

export type PersonnelPayload = z.infer<typeof PersonnelPayloadSchema>;
export type RevenuePayload = z.infer<typeof RevenuePayloadSchema>;
export type MarketingPayload = z.infer<typeof MarketingPayloadSchema>;
export type OpExPayload = z.infer<typeof OpExPayloadSchema>;
export type CapitalPayload = z.infer<typeof CapitalPayloadSchema>;

export type BlockPayload =
  | PersonnelPayload
  | RevenuePayload
  | MarketingPayload
  | OpExPayload
  | CapitalPayload;

export function getPayloadSchemaForType(type: BlockType): z.ZodType<BlockPayload> {
  switch (type) {
    case "Personnel":
      return PersonnelPayloadSchema as z.ZodType<BlockPayload>;
    case "Revenue":
      return RevenuePayloadSchema as z.ZodType<BlockPayload>;
    case "Marketing":
      return MarketingPayloadSchema as z.ZodType<BlockPayload>;
    case "OpEx":
      return OpExPayloadSchema as z.ZodType<BlockPayload>;
    case "Capital":
      return CapitalPayloadSchema as z.ZodType<BlockPayload>;
    default:
      return PersonnelPayloadSchema as z.ZodType<BlockPayload>;
  }
}
