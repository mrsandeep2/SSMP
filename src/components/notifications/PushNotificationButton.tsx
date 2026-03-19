import { useMemo, useState } from "react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { subscribeUser, unsubscribeUser, getSubscriptionStatus } from "@/lib/pushNotifications";

type StatusTone = "idle" | "success" | "error";

const PushNotificationButton = () => {
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [statusTone, setStatusTone] = useState<StatusTone>("idle");
  const [statusMessage, setStatusMessage] = useState("");

  const statusClassName = useMemo(() => {
    if (statusTone === "success") return "text-success";
    if (statusTone === "error") return "text-destructive";
    return "text-muted-foreground";
  }, [statusTone]);

  useEffect(() => {
    const checkCurrentStatus = async () => {
      setCheckingStatus(true);
      try {
        const status = await getSubscriptionStatus();
        setIsSubscribed(Boolean(status.isSubscribed));
      } catch {
        setIsSubscribed(false);
      } finally {
        setCheckingStatus(false);
      }
    };

    void checkCurrentStatus();
  }, []);

  const handleEnable = async () => {
    setLoading(true);
    setStatusTone("idle");
    setStatusMessage("");

    try {
      const result = await subscribeUser();
      if (!result.ok) {
        setStatusTone("error");
        setStatusMessage(result.message || "Unable to enable notifications.");
        return;
      }

      const status = await getSubscriptionStatus();
      if (status.isSubscribed) {
        setIsSubscribed(true);
        setStatusTone("idle");
        setStatusMessage("");
      } else {
        setIsSubscribed(false);
        setStatusTone("error");
        setStatusMessage("Subscription could not be verified. Please retry.");
      }
    } catch (error: any) {
      setStatusTone("error");
      setStatusMessage(error?.message || "Something went wrong while enabling notifications.");
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    setLoading(true);
    setStatusTone("idle");
    setStatusMessage("");

    try {
      const result = await unsubscribeUser();
      if (!result.ok) {
        setStatusTone("error");
        setStatusMessage(result.message || "Unable to disable notifications.");
        return;
      }
      setIsSubscribed(false);
      setStatusTone("idle");
      setStatusMessage("");
    } catch (error: any) {
      setStatusTone("error");
      setStatusMessage(error?.message || "Something went wrong while disabling notifications.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Web Push Notifications</p>
          <p className="text-xs text-muted-foreground">
            {isSubscribed
              ? "Notifications are enabled for this device."
              : "Receive real-time updates even when the app tab is closed."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {checkingStatus ? (
            <Button disabled size="sm" variant="outline">
              Checking...
            </Button>
          ) : isSubscribed ? (
            <Button onClick={handleDisable} disabled={loading} size="sm" variant="outline">
              {loading ? "Disabling..." : "Disable Notifications"}
            </Button>
          ) : (
            <Button onClick={handleEnable} disabled={loading} size="sm" variant="hero">
              {loading ? "Enabling..." : "Enable Notifications"}
            </Button>
          )}
        </div>
      </div>
      {statusMessage && <p className={`mt-3 text-sm ${statusClassName}`}>{statusMessage}</p>}
    </div>
  );
};

export default PushNotificationButton;
