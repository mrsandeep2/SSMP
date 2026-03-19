import { supabase } from "@/integrations/supabase/client";

type PushSubscriptionJson = {
  endpoint?: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
  expirationTime?: number | null;
};

type PushActionResult = {
  ok: boolean;
  mode?: "subscribed" | "already-subscribed" | "unsubscribed";
  message: string;
};

type NativeUpsertResult = {
  ok: boolean;
  mode?: "subscribed" | "already-subscribed";
  message?: string;
  endpoint?: string;
};

const getMedianBridge = () => {
  const w = window as any;
  return w.median?.onesignal || w.gonative?.onesignal || null;
};

const hasWebPushSupport = () => {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
};

const getMedianOneSignalInfo = async (bridge: any) => {
  if (!bridge) return null;

  if (typeof bridge.onesignalInfo === "function") {
    return await bridge.onesignalInfo();
  }

  if (typeof bridge.info === "function") {
    return await bridge.info();
  }

  return null;
};

const upsertNativeBridgeSubscription = async (userId: string, oneSignalInfo: any): Promise<NativeUpsertResult> => {
  const subscriptionId = oneSignalInfo?.subscription?.id;
  if (!subscriptionId) {
    return { ok: false, message: "OneSignal subscription id is not available yet." };
  }

  const endpoint = `onesignal:${subscriptionId}`;

  const { data: existing, error: selectError } = (await supabase
    .from("push_subscriptions" as any)
    .select("id")
    .eq("user_id", userId)
    .eq("endpoint", endpoint)
    .maybeSingle()) as any;

  if (selectError) {
    return { ok: false, message: selectError.message };
  }

  const payload = {
    user_id: userId,
    endpoint,
    p256dh: "native",
    auth: "native",
    subscription: {
      provider: "median-onesignal",
      oneSignalId: oneSignalInfo?.oneSignalId,
      externalId: oneSignalInfo?.externalId,
      subscription: oneSignalInfo?.subscription,
      platform: oneSignalInfo?.platform,
      appVersion: oneSignalInfo?.appVersion,
    },
    user_agent: navigator.userAgent,
    is_active: true,
    last_seen_at: new Date().toISOString(),
  };

  const operation = existing
    ? supabase.from("push_subscriptions" as any).update(payload).eq("id", (existing as any).id)
    : supabase.from("push_subscriptions" as any).insert(payload);

  const { error: writeError } = await operation;
  if (writeError) {
    return { ok: false, message: writeError.message };
  }

  return {
    ok: true,
    mode: existing ? "already-subscribed" : "subscribed",
    message: existing ? "Native push already enabled on this app." : "Native push enabled successfully.",
    endpoint,
  };
};

export const urlBase64ToUint8Array = (base64String: string) => {
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

const getCurrentUser = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
};

const registerServiceWorker = async () => {
  return navigator.serviceWorker.register("/sw.js");
};

export const getSubscriptionStatus = async () => {
  const bridge = getMedianBridge();
  if (!hasWebPushSupport() && bridge) {
    const info = await getMedianOneSignalInfo(bridge);
    return {
      supported: true as const,
      isSubscribed: Boolean(info?.subscription?.id && info?.subscription?.optedIn !== false),
      endpoint: info?.subscription?.id ? `onesignal:${info.subscription.id}` : undefined,
    };
  }

  if (!hasWebPushSupport()) {
    return { supported: false as const, isSubscribed: false as const };
  }

  const registration = await registerServiceWorker();
  const subscription = await registration.pushManager.getSubscription();
  return {
    supported: true as const,
    isSubscribed: Boolean(subscription),
    endpoint: subscription?.endpoint,
  };
};

export const subscribeUser = async (): Promise<PushActionResult> => {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, message: "Please log in before enabling notifications." };
  }

  const bridge = getMedianBridge();
  if (!hasWebPushSupport() && bridge) {
    if (typeof bridge.userPrivacyConsent?.grant === "function") {
      try {
        await bridge.userPrivacyConsent.grant();
      } catch {
        // best effort
      }
    }

    if (typeof bridge.register === "function") {
      await bridge.register();
    }

    if (typeof bridge.login === "function") {
      await bridge.login(user.id);
    }

    const info = await getMedianOneSignalInfo(bridge);
    const nativeResult = await upsertNativeBridgeSubscription(user.id, info);
    if (!nativeResult.ok) {
      return { ok: false, message: nativeResult.message || "Native push setup failed in mobile app." };
    }

    return {
      ok: true,
      mode: nativeResult.mode,
      message: nativeResult.message || "Native push enabled successfully.",
    };
  }

  if (!hasWebPushSupport()) {
    return {
      ok: false,
      message: "Push is not supported in this environment. In Median app, enable OneSignal plugin in App Studio.",
    };
  }

  if (Notification.permission === "denied") {
    return { ok: false, message: "Notifications are blocked. Enable them in browser site settings." };
  }

  let permission: NotificationPermission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }

  if (permission !== "granted") {
    return { ok: false, message: "Notification permission is required to enable push alerts." };
  }

  const vapidPublicKey = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY as string | undefined;
  if (!vapidPublicKey) {
    return { ok: false, message: "VITE_WEB_PUSH_PUBLIC_KEY is missing in frontend environment." };
  }

  const registration = await registerServiceWorker();
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  const subscriptionJson = getSubscriptionPayload(subscription);
  const endpoint = subscriptionJson.endpoint;
  const p256dh = subscriptionJson.keys?.p256dh;
  const auth = subscriptionJson.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    return { ok: false, message: "Push subscription payload is invalid." };
  }

  const { data: existing, error: selectError } = (await supabase
    .from("push_subscriptions" as any)
    .select("id")
    .eq("user_id", user.id)
    .eq("endpoint", endpoint)
    .maybeSingle()) as any;

  if (selectError) {
    return { ok: false, message: selectError.message };
  }

  const payload = {
    user_id: user.id,
    endpoint,
    p256dh,
    auth,
    subscription: subscriptionJson,
    user_agent: navigator.userAgent,
    is_active: true,
    last_seen_at: new Date().toISOString(),
  };

  const operation = existing
    ? supabase.from("push_subscriptions" as any).update(payload).eq("id", (existing as any).id)
    : supabase.from("push_subscriptions" as any).insert(payload);

  const { error: writeError } = await operation;
  if (writeError) {
    return { ok: false, message: writeError.message };
  }

  return {
    ok: true,
    mode: existing ? "already-subscribed" : "subscribed",
    message: existing ? "Already subscribed on this device." : "Notifications enabled successfully.",
  };
};

export const unsubscribeUser = async (): Promise<PushActionResult> => {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, message: "Please log in before disabling notifications." };
  }

  const bridge = getMedianBridge();
  if (!hasWebPushSupport() && bridge) {
    if (typeof bridge.logout === "function") {
      try {
        await bridge.logout();
      } catch {
        // best effort
      }
    }

    const info = await getMedianOneSignalInfo(bridge);
    const subId = info?.subscription?.id;
    if (subId) {
      await supabase
        .from("push_subscriptions" as any)
        .update({ is_active: false, last_seen_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("endpoint", `onesignal:${subId}`);
    }

    return { ok: true, mode: "unsubscribed", message: "Native push disabled for this app session." };
  }

  if (!hasWebPushSupport()) {
    return { ok: false, message: "Push is not supported in this environment." };
  }

  const registration = await registerServiceWorker();
  const subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    return { ok: true, mode: "unsubscribed", message: "No active subscription found on this device." };
  }

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();

  const { error } = await supabase
    .from("push_subscriptions" as any)
    .update({ is_active: false, last_seen_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true, mode: "unsubscribed", message: "Notifications disabled on this device." };
};

export const registerBackgroundPushForCurrentUser = async () => {
  const result = await subscribeUser();
  return {
    ok: result.ok,
    reason: result.ok ? undefined : "subscription_failed",
    message: result.message,
  };
};
