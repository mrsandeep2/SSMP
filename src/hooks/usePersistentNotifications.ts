import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PersistentNotification = {
  id: string;
  user_id: string;
  booking_id: string | null;
  category: string;
  title: string;
  body: string;
  metadata: Record<string, any> | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
};

const MAX_NOTIFICATIONS = 50;

export const usePersistentNotifications = (userId?: string) => {
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<PersistentNotification[]>([]);

  const loadNotifications = async () => {
    if (!userId) {
      setNotifications([]);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("user_notifications" as any)
      .select("id,user_id,booking_id,category,title,body,metadata,is_read,read_at,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(MAX_NOTIFICATIONS);

    if (!error) {
      setNotifications((data || []) as PersistentNotification[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadNotifications();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`user-notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload: any) => {
          if (payload.eventType === "INSERT" && payload.new) {
            setNotifications((prev) => [payload.new as PersistentNotification, ...prev].slice(0, MAX_NOTIFICATIONS));
            return;
          }

          if (payload.eventType === "UPDATE" && payload.new) {
            setNotifications((prev) =>
              prev.map((item) => (item.id === payload.new.id ? (payload.new as PersistentNotification) : item))
            );
            return;
          }

          if (payload.eventType === "DELETE" && payload.old) {
            setNotifications((prev) => prev.filter((item) => item.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const markRead = async (id: string) => {
    if (!userId) return;

    setNotifications((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, is_read: true, read_at: item.read_at ?? new Date().toISOString() }
          : item
      )
    );

    await supabase
      .from("user_notifications" as any)
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId);
  };

  const markAllRead = async () => {
    if (!userId) return;

    setNotifications((prev) =>
      prev.map((item) => ({
        ...item,
        is_read: true,
        read_at: item.read_at ?? new Date().toISOString(),
      }))
    );

    await supabase
      .from("user_notifications" as any)
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("is_read", false);
  };

  const unreadNotifications = useMemo(
    () => notifications.filter((item) => !item.is_read),
    [notifications]
  );

  return {
    loading,
    notifications,
    unreadNotifications,
    unreadCount: unreadNotifications.length,
    markRead,
    markAllRead,
    reload: loadNotifications,
  };
};