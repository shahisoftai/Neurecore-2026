/**
 * SSE Stream Parser
 *
 * Single-purpose SSE parser. Handles the OpenAI-compatible
 * `data: {json}\n\n` format, including the trailing `data: [DONE]`
 * sentinel. Yields parsed JSON objects to the caller.
 *
 * SOLID: SRP — this class parses SSE and nothing else. Reused by
 * `HttpLLMTransport.stream()`.
 */

export interface ParsedSseEvent {
  data: unknown;
  done: boolean;
  raw: string;
}

export class SseStreamParser {
  /**
   * Wrap a `ReadableStream<Uint8Array>` as an async iterable of SSE events.
   * Caller is responsible for `try { … } finally { reader.cancel() }`.
   */
  async *parse(
    body: ReadableStream<Uint8Array>,
  ): AsyncGenerator<ParsedSseEvent> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = drainBuffer(buffer);
        buffer = events.remainder;
        for (const raw of events.lines) {
          for (const ev of parseSseRecord(raw)) {
            yield ev;
          }
        }
      }
      // Final flush
      if (buffer.length > 0) {
        for (const ev of parseSseRecord(buffer)) {
          yield ev;
        }
      }
    } finally {
      try {
        reader.releaseLock();
      } catch {
        /* ignore */
      }
    }
  }
}

function drainBuffer(buffer: string): { lines: string[]; remainder: string } {
  // SSE events are separated by a blank line, supporting both \n\n and \r\n\r\n
  // Normalise to \n\n first so we never split on a lone \r.
  const normalised = buffer.replace(/\r\n/g, '\n');
  const parts = normalised.split('\n\n');
  const remainder = parts.pop() ?? '';
  return { lines: parts.filter((p) => p.trim().length > 0), remainder };
}

function parseSseRecord(record: string): ParsedSseEvent[] {
  const out: ParsedSseEvent[] = [];
  for (const line of record.split('\n')) {
    const trimmed = line.trimEnd();
    if (!trimmed.startsWith('data:')) continue;
    const data = trimmed.slice(5).trim();
    if (data === '[DONE]') {
      out.push({ data: null, done: true, raw: line });
      continue;
    }
    if (data.length === 0) continue;
    try {
      out.push({ data: JSON.parse(data), done: false, raw: line });
    } catch {
      // Some providers include comments or keep-alive pings that aren't
      // JSON. Drop them silently rather than abort the stream.
    }
  }
  return out;
}
