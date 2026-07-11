/**
 * AI Gateway — Invoke options (validated at service boundary)
 *
 * Zod schemas validate untrusted input (HTTP DTOs, queue payloads)
 * before they reach the gateway. Internal callers that build the
 * object themselves can bypass validation; the public service
 * applies the schema defensively.
 */

import { z } from 'zod';
import { CAPABILITIES } from './capabilities';

export const chatRoleSchema = z.enum(['system', 'user', 'assistant', 'tool']);

export const chatMessageSchema = z.object({
  role: chatRoleSchema,
  content: z.string().min(1).max(200_000),
  name: z.string().max(64).optional(),
  toolCallId: z.string().max(64).optional(),
});

export const capabilitySchema = z.enum(CAPABILITIES);

export const invokeOptionsSchema = z
  .object({
    tenantId: z.string().nullable(),
    capability: capabilitySchema,
    prompt: z.string().min(1).max(200_000).optional(),
    messages: z.array(chatMessageSchema).max(200).optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().min(1).max(32_000).optional(),
    systemPrompt: z.string().max(20_000).optional(),
    modelId: z.string().max(128).optional(),
    sourceModule: z.string().min(1).max(64),
    preferSpeed: z.boolean().optional(),
    budgetCents: z.number().int().min(0).optional(),
    estTokens: z.number().int().min(0).optional(),
    signal: z.instanceof(AbortSignal).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .refine((v) => Boolean(v.prompt) !== Boolean(v.messages), {
    message: 'Exactly one of `prompt` or `messages` must be set',
    path: ['prompt'],
  });

export type InvokeOptionsInput = z.infer<typeof invokeOptionsSchema>;
