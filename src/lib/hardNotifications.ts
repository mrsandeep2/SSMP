type HardNotificationInput = {
  title: string;
  body: string;
  tag?: string;
  requireInteraction?: boolean;
  flashDurationMs?: number;
};

const DEFAULT_FLASH_DURATION_MS = 15000;
const IN_APP_POPUP_DURATION_MS = 12000;

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

const showInAppHardPopup = (title: string, body: string) => {
  if (typeof document === "undefined") return;

  const containerId = "hard-notification-overlay-root";
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement("div");
    container.id = containerId;
    container.style.position = "fixed";
    container.style.top = "16px";
    container.style.right = "16px";
    container.style.zIndex = "2147483647";
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = "10px";
    container.style.maxWidth = "min(92vw, 360px)";
    container.style.pointerEvents = "none";
    document.body.appendChild(container);
  }

  const popup = document.createElement("div");
  popup.setAttribute("role", "alert");
  popup.style.background = "linear-gradient(135deg, #111827, #1f2937)";
  popup.style.color = "#f9fafb";
  popup.style.border = "1px solid rgba(249, 250, 251, 0.16)";
  popup.style.borderRadius = "12px";
  popup.style.boxShadow = "0 16px 45px rgba(0,0,0,0.45)";
  popup.style.padding = "12px 14px";
  popup.style.pointerEvents = "auto";
  popup.style.animation = "hardNotifSlideIn 180ms ease-out";

  const heading = document.createElement("div");
  heading.textContent = title;
  heading.style.fontSize = "14px";
  heading.style.fontWeight = "700";
  heading.style.marginBottom = "4px";

  const content = document.createElement("div");
  content.textContent = body;
  content.style.fontSize = "13px";
  content.style.opacity = "0.92";
  content.style.lineHeight = "1.35";

  popup.appendChild(heading);
  popup.appendChild(content);
  container.appendChild(popup);

  const removePopup = () => {
    popup.style.opacity = "0";
    popup.style.transform = "translateY(-8px)";
    window.setTimeout(() => {
      popup.remove();
      if (container && container.childElementCount === 0) {
        container.remove();
      }
    }, 150);
  };

  popup.addEventListener("click", removePopup);
  window.setTimeout(removePopup, IN_APP_POPUP_DURATION_MS);
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

  showInAppHardPopup(title, body);
  playAlarmTone();
  vibrateDevice();
  flashDocumentTitle(title, flashDurationMs);

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
