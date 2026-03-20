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

const getPushSupportDiagnostics = () => {
  const hasServiceWorker = typeof navigator !== "undefined" && "serviceWorker" in navigator;
  const hasPushManager = typeof window !== "undefined" && "PushManager" in window;
  const hasNotification = typeof window !== "undefined" && "Notification" in window;
  const isSecure = typeof window !== "undefined" ? Boolean(window.isSecureContext) : false;
  const protocol = typeof window !== "undefined" ? window.location.protocol : "";
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  const isLocalhost = host === "localhost" || host === "127.0.0.1";

  return {
    hasServiceWorker,
    hasPushManager,
    hasNotification,
    isSecure,
    protocol,
    isLocalhost,
  };
};

const getUnsupportedPushMessage = (hasMedianBridge: boolean) => {
  const d = getPushSupportDiagnostics();

  if (!d.isSecure && !d.isLocalhost) {
    return "Push requires HTTPS. Open this app on an HTTPS URL (or localhost for local testing).";
  }

  if (!d.hasServiceWorker) {
    return "This browser/runtime does not support Service Worker, so web push cannot work here.";
  }

  if (!d.hasPushManager) {
    return "This browser/runtime does not support PushManager. Use Chrome/Edge on HTTPS, or enable OneSignal plugin in Median App Studio.";
  }

  if (!d.hasNotification) {
    return "This browser/runtime does not support Notification API.";
  }

  if (!hasMedianBridge) {
    return "Push is not supported in this environment. If this is Median, enable OneSignal plugin and rebuild app so native bridge is injected.";
  }

  return "Push is not supported in this environment.";
};

const hasWebPushSupport = () => {
  const d = getPushSupportDiagnostics();
  return d.hasServiceWorker && d.hasPushManager && d.hasNotification && (d.isSecure || d.isLocalhost);
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

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForMedianOneSignalInfo = async (bridge: any, attempts = 6, delayMs = 800) => {
  for (let i = 0; i < attempts; i += 1) {
    const info = await getMedianOneSignalInfo(bridge);
    const subId = info?.subscription?.id;
    const optedOut = info?.subscription?.optedIn === false;

    if (subId && !optedOut) {
      return info;
    }

    if (i < attempts - 1) {
      await wait(delayMs);
    }
  }

  return await getMedianOneSignalInfo(bridge);
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

  const { error: writeError } = await writePushSubscription((existing as any)?.id ?? null, payload);
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

const isMissingSubscriptionColumnError = (error: any) => {
  const msg = String(error?.message || "").toLowerCase();
  return msg.includes("could not find") && msg.includes("subscription") && msg.includes("push_subscriptions");
};

const isRlsPolicyError = (error: any) => {
  const msg = String(error?.message || "").toLowerCase();
  return msg.includes("row-level security policy") || msg.includes("violates row-level security");
};

const writePushSubscription = async (existingId: string | null, payload: Record<string, any>) => {
  const firstOp = existingId
    ? supabase.from("push_subscriptions" as any).update(payload).eq("id", existingId)
    : supabase.from("push_subscriptions" as any).insert(payload);

  const first = await firstOp;
  if (!first.error) return { error: null };

  if (isRlsPolicyError(first.error)) {
    const rpc = await supabase.rpc("register_push_subscription" as any, {
      p_endpoint: payload.endpoint,
      p_p256dh: payload.p256dh,
      p_auth: payload.auth,
      p_user_agent: payload.user_agent,
    } as any);

    return { error: rpc.error };
  }

  if (!isMissingSubscriptionColumnError(first.error)) {
    return { error: first.error };
  }

  const { subscription, ...fallbackPayload } = payload;
  const retryOp = existingId
    ? supabase.from("push_subscriptions" as any).update(fallbackPayload).eq("id", existingId)
    : supabase.from("push_subscriptions" as any).insert(fallbackPayload);

  const retry = await retryOp;
  if (retry.error && isRlsPolicyError(retry.error)) {
    const rpc = await supabase.rpc("register_push_subscription" as any, {
      p_endpoint: payload.endpoint,
      p_p256dh: payload.p256dh,
      p_auth: payload.auth,
      p_user_agent: payload.user_agent,
    } as any);

    return { error: rpc.error };
  }

  return { error: retry.error };
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
    const info = await waitForMedianOneSignalInfo(bridge, 2, 400);
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

    const info = await waitForMedianOneSignalInfo(bridge, 10, 1000);
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
      message: getUnsupportedPushMessage(Boolean(bridge)),
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

  const { error: writeError } = await writePushSubscription((existing as any)?.id ?? null, payload);
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

    const info = await waitForMedianOneSignalInfo(bridge, 4, 500);
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
    return { ok: false, message: getUnsupportedPushMessage(Boolean(bridge)) };
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

const getOneSignalPlayerIdFromWebSdk = async (): Promise<string | null> => {
  if (typeof window === "undefined") return null;

  const w = window as any;
  const oneSignal = w.OneSignal;
  if (!oneSignal) return null;

  const tryGet = async (): Promise<string | null> => {
    try {
      if (typeof oneSignal.getUserId === "function") {
        const id = await oneSignal.getUserId();
        return id ? String(id) : null;
      }

      const v16Id = oneSignal?.User?.PushSubscription?.id;
      if (v16Id) return String(v16Id);
    } catch {
      return null;
    }

    return null;
  };

  // OneSignal can be initialized lazily; use push queue if present.
  if (typeof oneSignal.push === "function") {
    return await new Promise<string | null>((resolve) => {
      let settled = false;
      const done = (value: string | null) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };

      const timer = window.setTimeout(() => done(null), 4000);

      oneSignal.push(async () => {
        try {
          const id = await tryGet();
          window.clearTimeout(timer);
          done(id);
        } catch {
          window.clearTimeout(timer);
          done(null);
        }
      });
    });
  }

  return await tryGet();
};

export const saveOneSignalPlayerIdForUser = async (userId: string) => {
  if (!userId) return;

  const playerId = await getOneSignalPlayerIdFromWebSdk();
  if (!playerId) return;

  // Use "as any" because generated DB types may lag new migration columns.
  await supabase
    .from("profiles")
    .update({ onesignal_player_id: playerId } as any)
    .eq("id", userId);
};
