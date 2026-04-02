import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type SupportCallStatus = "waiting" | "active" | "ended" | "cancelled" | "timeout";

export interface SupportCallRequest {
  id: string;
  seeker_id: string;
  room_name: string;
  status: SupportCallStatus;
  created_at: string;
  updated_at: string;
}

class SupportCallService {
  static async getSeekerActiveCall(seekerId: string): Promise<SupportCallRequest | null> {
    const { data, error } = await supabase
      .from("call_requests")
      .select("*")
      .eq("seeker_id", seekerId)
      .in("status", ["waiting", "active"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data ?? null;
  }

  static async getAdminActiveRequests(): Promise<SupportCallRequest[]> {
    const { data, error } = await supabase
      .from("call_requests")
      .select("*")
      .in("status", ["waiting", "active"])
      .order("created_at", { ascending: true });

    if (error) throw error;
    return data ?? [];
  }

  static async createRequest(seekerId: string): Promise<SupportCallRequest> {
    const roomName = `support_${seekerId}`;
    const { data, error } = await supabase
      .from("call_requests")
      .insert({
        seeker_id: seekerId,
        room_name: roomName,
        status: "waiting",
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async updateStatus(id: string, status: SupportCallStatus): Promise<SupportCallRequest> {
    const { data, error } = await supabase
      .from("call_requests")
      .update({ status })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

export function useSupportCall() {
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [activeRequest, setActiveRequest] = useState<SupportCallRequest | null>(null);

  const isAdmin = role === "admin";

  const { data: seekerActive } = useQuery({
    queryKey: ["support-call-active", user?.id],
    queryFn: () => (user ? SupportCallService.getSeekerActiveCall(user.id) : Promise.resolve(null)),
    enabled: !!user && !isAdmin,
    staleTime: 2000,
  });

  const { data: adminRequests = [] } = useQuery({
    queryKey: ["support-call-requests"],
    queryFn: () => SupportCallService.getAdminActiveRequests(),
    enabled: isAdmin,
    staleTime: 2000,
  });

  useEffect(() => {
    if (!isAdmin) {
      setActiveRequest(seekerActive ?? null);
    }
  }, [seekerActive, isAdmin]);

  useEffect(() => {
    const channel = supabase
      .channel("support-call-requests")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "call_requests" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["support-call-active"] });
          queryClient.invalidateQueries({ queryKey: ["support-call-requests"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const createRequestMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const existing = await SupportCallService.getSeekerActiveCall(user.id);
      if (existing) return existing;
      return SupportCallService.createRequest(user.id);
    },
    onSuccess: (data) => {
      setActiveRequest(data);
      queryClient.invalidateQueries({ queryKey: ["support-call-active", user?.id] });
    },
  });

  const joinRequestMutation = useMutation({
    mutationFn: (id: string) => SupportCallService.updateStatus(id, "active"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-call-requests"] });
    },
  });

  const endRequestMutation = useMutation({
    mutationFn: (id: string) => SupportCallService.updateStatus(id, "ended"),
    onSuccess: () => {
      setActiveRequest(null);
      queryClient.invalidateQueries({ queryKey: ["support-call-active", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["support-call-requests"] });
    },
  });

  const cancelRequestMutation = useMutation({
    mutationFn: (id: string) => SupportCallService.updateStatus(id, "cancelled"),
    onSuccess: () => {
      setActiveRequest(null);
      queryClient.invalidateQueries({ queryKey: ["support-call-active", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["support-call-requests"] });
    },
  });

  return {
    activeRequest,
    adminRequests,
    createRequest: createRequestMutation.mutate,
    createRequestAsync: createRequestMutation.mutateAsync,
    createRequestLoading: createRequestMutation.isPending,
    joinRequest: joinRequestMutation.mutate,
    joinRequestAsync: joinRequestMutation.mutateAsync,
    joinRequestLoading: joinRequestMutation.isPending,
    endRequest: endRequestMutation.mutate,
    endRequestAsync: endRequestMutation.mutateAsync,
    endRequestLoading: endRequestMutation.isPending,
    cancelRequest: cancelRequestMutation.mutate,
    cancelRequestAsync: cancelRequestMutation.mutateAsync,
    cancelRequestLoading: cancelRequestMutation.isPending,
  };
}
