import { describe, expect, it, vi } from "vitest";
import { emitNotification, notify, NOTIFICATION_EVENT, playNotificationChime } from "./notify";

describe("notify event bus", () => {
  it("emits a custom event when emitNotification is called", () => {
    const listener = vi.fn();
    window.addEventListener(NOTIFICATION_EVENT, listener);

    const item = emitNotification({
      title: "Test Alert",
      message: "Test Message",
      type: "alert",
      tone: "warning",
    });

    expect(listener).toHaveBeenCalled();
    const event = listener.mock.calls[0]![0] as CustomEvent;
    expect(event.detail.title).toBe("Test Alert");
    expect(event.detail.message).toBe("Test Message");
    expect(event.detail.tone).toBe("warning");
    expect(item.id).toMatch(/^notif-/);

    window.removeEventListener(NOTIFICATION_EVENT, listener);
  });

  it("convenience helpers emit with appropriate tones", () => {
    const listener = vi.fn();
    window.addEventListener(NOTIFICATION_EVENT, listener);

    notify.success("Thành công", "Đã lưu");
    notify.critical("Báo động", "Nguy cấp");

    expect(listener).toHaveBeenCalledTimes(2);
    expect((listener.mock.calls[0]![0] as CustomEvent).detail.tone).toBe("success");
    expect((listener.mock.calls[1]![0] as CustomEvent).detail.tone).toBe("critical");

    window.removeEventListener(NOTIFICATION_EVENT, listener);
  });

  it("playNotificationChime does not crash in test environment", () => {
    expect(() => playNotificationChime("success")).not.toThrow();
    expect(() => playNotificationChime("critical")).not.toThrow();
  });
});
