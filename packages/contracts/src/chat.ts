import { z } from 'zod';
import { HttpUrlSchema, TenantIdSchema } from './common';

export const ChatRoleSchema = z.enum(['user', 'assistant', 'system']);

export const ChatMessageSchema = z.object({
  role: ChatRoleSchema,
  content: z.string().min(1),
});

/** A retrieved chunk the answer is grounded in. */
export const CitationSchema = z.object({
  url: HttpUrlSchema,
  title: z.string().nullish(),
  /** Verbatim excerpt shown under the answer. */
  snippet: z.string().default(''),
  /** Retrieval similarity, normalised to 0..1. */
  score: z.number().min(0).max(1).default(0),
});

export const ChatRequestSchema = z.object({
  tenantId: TenantIdSchema,
  message: z.string().min(1).max(8_000),
  /** Groups turns into a conversation; omit to start a fresh one. */
  conversationId: z.string().min(1).nullish(),
  /** Prior turns, oldest first. The server may truncate to fit the context. */
  history: z.array(ChatMessageSchema).default([]),
  /** How many chunks to retrieve before answering. */
  topK: z.number().int().min(1).max(50).default(8),
});

export const ChatResponseSchema = z.object({
  answer: z.string(),
  citations: z.array(CitationSchema).default([]),
  conversationId: z.string().min(1).nullish(),
});

export type ChatRole = z.infer<typeof ChatRoleSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type Citation = z.infer<typeof CitationSchema>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type ChatResponse = z.infer<typeof ChatResponseSchema>;
