-- PERF-FIX: VALIDATE the 5 foreign-key constraints that were added
-- NOT VALID in 20260719_chat_persistence and 20260720_hermes_referential_integrity.
-- A NOT VALID FK forces a full-table scan on EVERY insert/update to the
-- child table to verify the FK — at ~10-30ms per scan on Contabo with
-- our Hermes/chat volume, this is one of the larger hidden costs in
-- the chat-write path.
--
-- VALIDATE CONSTRAINT requires a SHARE UPDATE EXCLUSIVE lock (allows
-- concurrent reads + writes), and runs a single full-table scan per
-- constraint. We run them in a single transaction so the lock window
-- is contiguous and short.

ALTER TABLE "chat_messages" VALIDATE CONSTRAINT "chat_messages_sessionId_fkey";
ALTER TABLE "HermesAgent" VALIDATE CONSTRAINT "HermesAgent_tenantId_fkey";
ALTER TABLE "HermesSession" VALIDATE CONSTRAINT "HermesSession_tenantId_fkey";
ALTER TABLE "HermesSession" VALIDATE CONSTRAINT "HermesSession_userId_fkey";
ALTER TABLE "HermesMemoryEntry" VALIDATE CONSTRAINT "HermesMemoryEntry_tenantId_fkey";