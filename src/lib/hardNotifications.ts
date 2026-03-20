type HardNotificationInput = {
  title: string;
  body: string;
  tag?: string;
  requireInteraction?: boolean;
  flashDurationMs?: number;
};

const DEFAULT_FLASH_DURATION_MS = 15000;

let sharedAudioContext: AudioContext | null = null;
let audioUnlockWired = false;

const ensureAudioContext = () => {
  if (typeof window === "undefined") return null;
  const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextCtor) return null;
  if (!sharedAudioContext) {
    sharedAudioContext = new AudioContextCtor();
  }
  return sharedAudioContext;
};

const wireAudioUnlock = () => {
  if (typeof window === "undefined" || audioUnlockWired) return;
  audioUnlockWired = true;

  const unlock = async () => {
    const ctx = ensureAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        return;
      }
    }
    if (ctx.state === "running") {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    }
  };

  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock, { passive: true });
  window.addEventListener("touchstart", unlock, { passive: true });
};

const playAlarmTone = () => {
  if (typeof window === "undefined") return;

  const audioContext = ensureAudioContext();
  if (!audioContext) return;

  if (audioContext.state === "suspended") {
    void audioContext.resume().catch(() => {
      // The first user interaction will unlock audio via wireAudioUnlock.
    });
  }

  if (audioContext.state !== "running") return;

  const pulseAt = (startAt: number) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(880, startAt);

    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.25, startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.18);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start(startAt);
    oscillator.stop(startAt + 0.2);
  };

  const now = audioContext.currentTime + 0.03;
  pulseAt(now);
  pulseAt(now + 0.24);
  pulseAt(now + 0.48);
};

const vibrateDevice = () => {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  navigator.vibrate([250, 120, 250]);
};

const flashDocumentTitle = (title: string, durationMs: number) => {
  if (typeof document === "undefined") return;

  const previousTitle = document.title;
  let toggled = false;

  const interval = window.setInterval(() => {
    document.title = toggled ? previousTitle : `ALERT: ${title}`;
    toggled = !toggled;
  }, 1000);

  window.setTimeout(() => {
    window.clearInterval(interval);
    document.title = previousTitle;
  }, durationMs);
};

export const requestNotificationPermissionIfNeeded = async () => {
  wireAudioUnlock();

  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported" as const;
  if (Notification.permission === "granted") return "granted" as const;
  if (Notification.permission === "denied") return "denied" as const;
  const permission = await Notification.requestPermission();
  return permission;
};

export const getNotificationPermissionState = () => {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported" as const;
  return Notification.permission;
};

export const triggerHardNotification = async ({
  title,
  body,
  tag,
  requireInteraction = true,
  flashDurationMs = DEFAULT_FLASH_DURATION_MS,
}: HardNotificationInput) => {
  wireAudioUnlock();

  playAlarmTone();
  vibrateDevice();

  // Keep this call so existing callers remain compatible, but skip in-app visual flashing.
  void flashDurationMs;

  if (typeof window === "undefined" || !("Notification" in window)) return;

  if (Notification.permission === "default") {
    await requestNotificationPermissionIfNeeded();
  }

  if (Notification.permission === "granted") {
    new Notification(title, {
      body,
      tag,
      requireInteraction,
    });
  }
};
