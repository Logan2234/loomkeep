import type { FastifyReply } from "fastify";
import { vi } from "vitest";

export function fakeReply(chainSend = false) {
  const headers: Record<string, unknown> = {};
  const reply = {
    header: vi.fn((name: string, value: unknown) => {
      headers[name] = value;
      return reply;
    }),
    type: vi.fn().mockReturnThis(),
    send: chainSend ? vi.fn().mockReturnThis() : vi.fn(),
  };
  return {
    headers,
    reply: reply as unknown as FastifyReply & {
      header: ReturnType<typeof vi.fn>;
      send: ReturnType<typeof vi.fn>;
      type: ReturnType<typeof vi.fn>;
    },
  };
}
