import { z } from "zod";

export const machineNameSchema = z.string().trim().min(1).max(80);

export const machinePairingStartSchema = z.object({
  name: machineNameSchema,
  platform: z.string().trim().min(1).max(32),
  arch: z.string().trim().min(1).max(32),
  hostname: z.string().trim().max(255).optional().nullable(),
});

export const machinePairingClaimSchema = z.object({
  token: z.string().trim().min(16).max(256),
});

export const approveMachinePairingSchema = z.object({
  token: z.string().trim().min(16).max(256),
  shared: z.boolean().optional(),
});

export const updateMachineSchema = z.object({
  name: machineNameSchema.optional(),
});

export const executionLocationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("server") }),
  z.object({ kind: z.literal("machine"), machineId: z.string().uuid() }),
]);

export const setExecutionLocationSchema = z.object({
  location: executionLocationSchema,
});

export const handoffWorkContextSchema = z.object({
  to: executionLocationSchema,
  /** Continue from the last stored snapshot when the source machine is offline and cannot take a final one. */
  useLastSnapshot: z.boolean().optional(),
});

export const setWorkContextLockSchema = z.object({
  clientSessionId: z.string().trim().min(1).max(128).optional().nullable(),
});

export const workContextClientSessionSchema = z.object({
  clientSessionId: z.string().trim().min(1).max(128),
});

export type MachinePairingStart = z.infer<typeof machinePairingStartSchema>;
export type ApproveMachinePairing = z.infer<typeof approveMachinePairingSchema>;
export type UpdateMachine = z.infer<typeof updateMachineSchema>;
export type ExecutionLocationInput = z.infer<typeof executionLocationSchema>;
