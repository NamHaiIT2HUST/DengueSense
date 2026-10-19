export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: "alert" | "plan" | "draft" | "system";
  tone?: "info" | "success" | "warning" | "critical" | undefined;
  link?: string | undefined;
  read: boolean;
  durationMs?: number | undefined;
}

export type NotificationPayload = Omit<NotificationItem, "id" | "timestamp" | "read"> & {
  id?: string | undefined;
  timestamp?: string | undefined;
  read?: boolean | undefined;
};

export const NOTIFICATION_EVENT = "denguesense:notify";

let audioCtx: AudioContext | null = null;

/**
 * Phát âm thanh thông báo y tế dịu nhẹ (synthetic oscillator)
 * Hoàn toàn không phụ thuộc file mp3 ngoài, bảo đảm hoạt động offline và an toàn.
 */
export function playNotificationChime(tone: "info" | "success" | "warning" | "critical" = "info") {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }

    if (audioCtx.state === "suspended") {
      void audioCtx.resume();
    }

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    // Cấu hình âm điệu theo ngữ cảnh thông báo
    if (tone === "critical") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(659.25, now); // E5
      osc.frequency.setValueAtTime(880.0, now + 0.08); // A5
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (tone === "success") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (tone === "warning") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(587.33, now + 0.1);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.22);
    } else {
      // Info
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880.0, now + 0.07); // A5
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    }
  } catch {
    // Không làm gián đoạn ứng dụng nếu trình duyệt chặn âm thanh tự động
  }
}

/**
 * Phát sự kiện thông báo toàn cục tới ToastContainer và NotificationCenter
 */
export function emitNotification(payload: NotificationPayload): NotificationItem {
  const item: NotificationItem = {
    id: payload.id ?? `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: payload.title,
    message: payload.message,
    timestamp: payload.timestamp ?? "Vừa xong",
    type: payload.type,
    tone: payload.tone ?? "info",
    link: payload.link,
    read: payload.read ?? false,
    durationMs: payload.durationMs ?? 5000,
  };

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(NOTIFICATION_EVENT, { detail: item }));
    playNotificationChime(item.tone);
  }

  return item;
}

/**
 * Tiện ích gửi thông báo nhanh dạng functional API
 */
export const notify = {
  success: (title: string, message: string, opts?: Partial<NotificationPayload>) =>
    emitNotification({
      title,
      message,
      type: opts?.type ?? "system",
      tone: "success",
      ...opts,
    }),

  warning: (title: string, message: string, opts?: Partial<NotificationPayload>) =>
    emitNotification({
      title,
      message,
      type: opts?.type ?? "alert",
      tone: "warning",
      ...opts,
    }),

  critical: (title: string, message: string, opts?: Partial<NotificationPayload>) =>
    emitNotification({
      title,
      message,
      type: opts?.type ?? "alert",
      tone: "critical",
      ...opts,
    }),

  info: (title: string, message: string, opts?: Partial<NotificationPayload>) =>
    emitNotification({
      title,
      message,
      type: opts?.type ?? "system",
      tone: "info",
      ...opts,
    }),
};
