/**
 * SSE Stream Parser
 *
 * Pure unit tests over a synthetic `ReadableStream<Uint8Array>`.
 * SOLID: SRP — the parser is the only collaborator.
 */

import { SseStreamParser } from './sse-stream-parser';

function makeStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i++]));
      } else {
        controller.close();
      }
    },
  });
}

describe('SseStreamParser', () => {
  it('parses a single complete event', async () => {
    const s = new SseStreamParser();
    const out: unknown[] = [];
    for await (const ev of s.parse(makeStream(['data: {"a":1}\n\n']))) {
      out.push(ev);
    }
    expect(out).toHaveLength(1);
    expect((out[0] as { data: { a: number } }).data).toEqual({ a: 1 });
  });

  it('parses an event split across chunks', async () => {
    const s = new SseStreamParser();
    const out: unknown[] = [];
    for await (const ev of s.parse(makeStream(['data: {"a', '":1}\n\n']))) {
      out.push(ev);
    }
    expect(out).toHaveLength(1);
    expect((out[0] as { data: { a: number } }).data).toEqual({ a: 1 });
  });

  it('handles the [DONE] sentinel', async () => {
    const s = new SseStreamParser();
    const out: unknown[] = [];
    for await (const ev of s.parse(
      makeStream(['data: {"a":1}\n\ndata: [DONE]\n\n']),
    )) {
      out.push(ev);
    }
    expect(out).toHaveLength(2);
    expect((out[1] as { done: boolean }).done).toBe(true);
  });

  it('skips malformed lines without aborting', async () => {
    const s = new SseStreamParser();
    const out: unknown[] = [];
    for await (const ev of s.parse(
      makeStream(['not-data: foo\ndata: {"a":1}\n\n']),
    )) {
      out.push(ev);
    }
    expect(out).toHaveLength(1);
  });

  it('handles CRLF line endings (\\r\\n)', async () => {
    const s = new SseStreamParser();
    const out: unknown[] = [];
    for await (const ev of s.parse(
      makeStream(['data: {"a":1}\r\n\r\n']),
    )) {
      out.push(ev);
    }
    expect(out).toHaveLength(1);
    expect((out[0] as { data: { a: number } }).data).toEqual({ a: 1 });
  });
});
