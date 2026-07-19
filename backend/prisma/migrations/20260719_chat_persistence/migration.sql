-- Phase B: Chat Persistence (memory-bank-new/plans/chat-unification-refactor-plan.md)
-- Adds ChatSession + ChatMessage tables for tenant/user conversation history.
-- Independent of Hermes (which is agent-execution-scoped, not chat-scoped).

CREATE TABLE IF NOT EXISTS "chat_sessions" (
  "id"             TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "tenantId"       TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "title"          TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastMessageAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "chat_sessions_conversationId_key" ON "chat_sessions"("conversationId");
CREATE INDEX IF NOT EXISTS "chat_sessions_tenantId_userId_idx" ON "chat_sessions"("tenantId", "userId");
CREATE INDEX IF NOT EXISTS "chat_sessions_tenantId_lastMessageAt_idx" ON "chat_sessions"("tenantId", "lastMessageAt");
CREATE INDEX IF NOT EXISTS "chat_sessions_conversationId_idx" ON "chat_sessions"("conversationId");

CREATE TABLE IF NOT EXISTS "chat_messages" (
  "id"             TEXT NOT NULL,
  "sessionId"      TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "tenantId"       TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "role"           TEXT NOT NULL,
  "content"        TEXT NOT NULL,
  "metadata"       JSONB,
  "tokens"         JSONB,
  "model"          TEXT,
  "provider"       TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "chat_messages_sessionId_createdAt_idx" ON "chat_messages"("sessionId", "createdAt");
CREATE INDEX IF NOT EXISTS "chat_messages_conversationId_createdAt_idx" ON "chat_messages"("conversationId", "createdAt");
CREATE INDEX IF NOT EXISTS "chat_messages_tenantId_userId_createdAt_idx" ON "chat_messages"("tenantId", "userId", "createdAt");

ALTER TABLE "chat_messages"
  ADD CONSTRAINT "chat_messages_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "chat_sessions"("id")
  ON DELETE CASCADE
  NOT VALID;
