import { describe, it, expect, beforeEach } from "vitest";
import { useChatStore } from "./chatStore";

function getStore() {
  return useChatStore.getState();
}

describe("chatStore", () => {
  beforeEach(() => {
    useChatStore.setState({
      open: false,
      messages: [],
      conversationId: null,
    });
  });

  it("should start closed with empty messages", () => {
    expect(getStore().open).toBe(false);
    expect(getStore().messages).toEqual([]);
    expect(getStore().conversationId).toBeNull();
  });

  it("should toggle open state", () => {
    useChatStore.getState().toggleOpen();
    expect(getStore().open).toBe(true);
    useChatStore.getState().toggleOpen();
    expect(getStore().open).toBe(false);
  });

  it("should add a message", () => {
    const msg = {
      id: "msg-1",
      role: "user" as const,
      content: "hello",
      timestamp: "2026-01-01T00:00:00Z",
    };
    useChatStore.getState().addMessage(msg);
    expect(getStore().messages).toHaveLength(1);
    expect(getStore().messages[0]).toEqual(msg);
  });

  it("should cap messages at MAX_MESSAGES (100)", () => {
    for (let i = 0; i < 105; i++) {
      useChatStore.getState().addMessage({
        id: `msg-${i}`,
        role: "user",
        content: `message ${i}`,
        timestamp: new Date().toISOString(),
      });
    }
    expect(getStore().messages).toHaveLength(100);
    expect(getStore().messages[0].id).toBe("msg-5");
    expect(getStore().messages[99].id).toBe("msg-104");
  });

  it("should update a streaming message", () => {
    const msg = {
      id: "stream-1",
      role: "assistant" as const,
      content: "...",
      streaming: true,
      timestamp: "2026-01-01T00:00:00Z",
    };
    useChatStore.getState().addMessage(msg);
    useChatStore.getState().updateStreamingMessage(
      "stream-1",
      "complete response",
      true,
    );
    const updated = getStore().messages[0];
    expect(updated.content).toBe("complete response");
    expect((updated as { streaming?: boolean }).streaming).toBe(false);
  });

  it("should clear history and conversationId", () => {
    useChatStore.getState().setConversationId("conv-1");
    useChatStore.getState().addMessage({
      id: "x",
      role: "user",
      content: "hi",
      timestamp: "",
    });
    expect(getStore().messages).toHaveLength(1);
    useChatStore.getState().clearHistory();
    expect(getStore().messages).toEqual([]);
    expect(getStore().conversationId).toBeNull();
  });
});
