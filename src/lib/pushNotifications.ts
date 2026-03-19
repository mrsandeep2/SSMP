import { supabase } from "@/integrations/supabase/client";

type PushSubscriptionJson = {
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

const base64ToUint8Array = (base64String: string) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

const getSubscriptionPayload = (subscription: PushSubscription): PushSubscriptionJson => {
  return subscription.toJSON() as PushSubscriptionJson;
};

export const registerBackgroundPushForCurrentUser = async () => {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return { ok: false as const, reason: "unsupported" as const };
  }

  if (Notification.permission !== "granted") {
    return { ok: false as const, reason: "permission_not_granted" as const };
  }

  const vapidPublicKey = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY as string | undefined;
  if (!vapidPublicKey) {
    return { ok: false as const, reason: "missing_vapid_public_key" as const };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false as const, reason: "no_user" as const };
  }

  const registration = await navigator.serviceWorker.register("/web-push-sw.js");

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64ToUint8Array(vapidPublicKey),
    });
  }

  const payload = getSubscriptionPayload(subscription);
  const endpoint = payload.endpoint;
  const p256dh = payload.keys?.p256dh;
  const auth = payload.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    return { ok: false as const, reason: "invalid_subscription" as const };
  }

  const { error } = await supabase.rpc("register_push_subscription" as any, {
    p_endpoint: endpoint,
    p_p256dh: p256dh,
    p_auth: auth,
    p_user_agent: navigator.userAgent,
  } as any);

  if (error) {
    return { ok: false as const, reason: "rpc_failed" as const, error };
  }

  return { ok: true as const };
};
