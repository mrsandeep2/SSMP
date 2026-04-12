import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

export interface VideoCall {
  id: string;
  service_id: string;
  booking_id: string;
  initiator_id: string;
  receiver_id: string;
  room_name: string;
  status: "pending" | "ringing" | "active" | "ended" | "declined" | "missed";
  initiated_at: string;
  accepted_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  call_duration_seconds: number | null;
  initiator_role: "seeker" | "admin";
  receiver_role: "seeker" | "admin";
  decline_reason: string | null;
  created_at: string;
  updated_at: string;
}

class VideoCallService {
  // Generate unique room name for a service
  static generateRoomName(serviceId: string): string {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    return `ssmp-${serviceId.substring(0, 8)}-${timestamp}-${randomSuffix}`;
  }

  // Initiate a video call
  static async initiateCall(
    bookingId: string,
    serviceId: string,
    initiatorId: string,
    receiverId: string,
    initiatorRole: "seeker" | "admin"
  ): Promise<VideoCall> {
    const roomName = this.generateRoomName(serviceId);

    const { data, error } = await supabase
      .from("video_calls")
      .insert({
        booking_id: bookingId,
        service_id: serviceId,
        initiator_id: initiatorId,
        receiver_id: receiverId,
        room_name: roomName,
        status: "pending",
        initiator_role: initiatorRole,
        receiver_role: initiatorRole === "seeker" ? "admin" : "seeker",
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Accept an incoming call
  static async acceptCall(callId: string): Promise<VideoCall> {
    const { data, error } = await supabase
      .from("video_calls")
      .update({
        status: "active",
        accepted_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
      })
      .eq("id", callId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Decline an incoming call
  static async declineCall(
    callId: string,
    reason?: string
  ): Promise<VideoCall> {
    const { data, error } = await supabase
      .from("video_calls")
      .update({
        status: "declined",
        ended_at: new Date().toISOString(),
        decline_reason: reason || "User declined",
      })
      .eq("id", callId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // End a call
  static async endCall(callId: string, durationSeconds: number): Promise<VideoCall> {
    const { data, error } = await supabase
      .from("video_calls")
      .update({
        status: "ended",
        ended_at: new Date().toISOString(),
        call_duration_seconds: durationSeconds,
      })
      .eq("id", callId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Get active call for a booking
  static async getActiveCall(bookingId: string): Promise<VideoCall | null> {
    const { data, error } = await supabase
      .from("video_calls")
      .select()
      .eq("booking_id", bookingId)
      .in("status", ["pending", "ringing", "active"])
      .order("initiated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  // Get pending incoming calls for a user
  static async getPendingIncomingCalls(userId: string): Promise<VideoCall[]> {
    const { data, error } = await supabase
      .from("video_calls")
      .select()
      .eq("receiver_id", userId)
      .in("status", ["pending", "ringing"])
      .order("initiated_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Get call history for a booking
  static async getCallHistory(bookingId: string): Promise<VideoCall[]> {
    const { data, error } = await supabase
      .from("video_calls")
      .select()
      .eq("booking_id", bookingId)
      .in("status", ["ended", "declined", "missed"])
      .order("initiated_at", { ascending: false });

    if (error) throw error;
    return data || [];
  }
}

export default VideoCallService;

// Custom Hook for Video Calls
export function useVideoCall(bookingId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [pendingCall, setPendingCall] = useState<VideoCall | null>(null);

  // Query: Active call for a booking
  const {
    data: activeCall,
    isLoading: loadingActiveCall,
    error: activeCallError,
  } = useQuery({
    queryKey: ["active-call", bookingId],
    queryFn: () =>
      bookingId
        ? VideoCallService.getActiveCall(bookingId)
        : Promise.resolve(null),
    enabled: !!bookingId,
    staleTime: 5000,
  });

  // Query: Pending incoming calls
  const {
    data: incomingCalls = [],
    isLoading: loadingIncoming,
    refetch: refetchIncoming,
  } = useQuery({
    queryKey: ["pending-incoming-calls", user?.id],
    queryFn: () =>
      user ? VideoCallService.getPendingIncomingCalls(user.id) : Promise.resolve([]),
    enabled: !!user,
    staleTime: 2000,
  });

  // Mutation: Initiate call
  const initiateCallMutation = useMutation({
    mutationFn: ({
      bookingId,
      serviceId,
      receiverId,
      initiatorRole,
    }: {
      bookingId: string;
      serviceId: string;
      receiverId: string;
      initiatorRole: "seeker" | "admin";
    }) =>
      {
        if (!user?.id) {
          throw new Error("User not authenticated");
        }
        return VideoCallService.initiateCall(
          bookingId,
          serviceId,
          user.id,
          receiverId,
          initiatorRole
        );
      },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["active-call", bookingId] });
      setPendingCall(data);
    },
  });

  // Mutation: Accept call
  const acceptCallMutation = useMutation({
    mutationFn: (callId: string) => VideoCallService.acceptCall(callId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-incoming-calls"] });
      queryClient.invalidateQueries({ queryKey: ["active-call"] });
    },
  });

  // Mutation: Decline call
  const declineCallMutation = useMutation({
    mutationFn: ({ callId, reason }: { callId: string; reason?: string }) =>
      VideoCallService.declineCall(callId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-incoming-calls"] });
      setPendingCall(null);
    },
  });

  // Mutation: End call
  const endCallMutation = useMutation({
    mutationFn: ({ callId, duration }: { callId: string; duration: number }) =>
      VideoCallService.endCall(callId, duration),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-call"] });
      queryClient.invalidateQueries({ queryKey: ["pending-incoming-calls"] });
    },
  });

  // Subscribe to real-time updates
  useEffect(() => {
    if (!user || !bookingId) return;

    // Subscribe to video_calls changes for this booking
    const channel = supabase
      .channel(`video-calls-${bookingId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "video_calls",
          filter: `booking_id=eq.${bookingId}`,
        },
        (payload: any) => {
          queryClient.invalidateQueries({ queryKey: ["active-call", bookingId] });
          
          // Update pending call state for incoming calls
          if (payload.new?.receiver_id === user.id && payload.new?.status === "pending") {
            setPendingCall(payload.new);
          }
          
          // Update active call state when initiated
          if (payload.eventType === "INSERT" && payload.new?.status === "pending") {
            setPendingCall(payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, bookingId, queryClient]);

  // Subscribe to incoming calls for current user
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`incoming-calls-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "video_calls",
          filter: `receiver_id=eq.${user.id}`,
        },
        () => {
          void refetchIncoming();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, refetchIncoming]);

  return {
    activeCall,
    loadingActiveCall,
    activeCallError,
    incomingCalls,
    loadingIncoming,
    pendingCall,
    setPendingCall,
    initiateCall: initiateCallMutation.mutate,
    initiateCallAsync: initiateCallMutation.mutateAsync,
    initiateCallLoading: initiateCallMutation.isPending,
    acceptCall: acceptCallMutation.mutate,
    acceptCallLoading: acceptCallMutation.isPending,
    declineCall: declineCallMutation.mutate,
    declineCallLoading: declineCallMutation.isPending,
    endCall: endCallMutation.mutate,
    endCallLoading: endCallMutation.isPending,
  };
}
