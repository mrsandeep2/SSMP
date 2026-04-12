import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Video } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import VideoCallModal from "@/components/videocall/VideoCallModal";
import { useVideoCall } from "@/hooks/useVideoCall";

interface CallButtonProps {
  bookingId: string;
  serviceId: string;
  receiverId: string;
  receiverName: string;
  initiatorRole: "seeker" | "admin";
  disabled?: boolean;
  className?: string;
  showLabel?: boolean;
  size?: "sm" | "default" | "lg";
}

const CallButton = ({
  bookingId,
  serviceId,
  receiverId,
  receiverName,
  initiatorRole,
  disabled = false,
  className = "",
  showLabel = true,
  size = "default",
}: CallButtonProps) => {
  const [showVideoCall, setShowVideoCall] = useState(false);
  const { toast } = useToast();
  const { activeCall, initiateCallAsync, initiateCallLoading, endCall } = useVideoCall(bookingId);

  // Show video modal when active call is established
  useEffect(() => {
    if (activeCall && activeCall.status === "pending") {
      setShowVideoCall(true);
    }
  }, [activeCall?.id]);

  const handleInitiateCall = async () => {
    try {
      await initiateCallAsync({
        bookingId,
        serviceId,
        receiverId,
        initiatorRole,
      });
      toast({
        title: "Call initiated",
        description: `Calling ${receiverName}...`,
      });
    } catch (error: any) {
      toast({
        title: "Failed to initiate call",
        description: error?.message || "Could not create call.",
        variant: "destructive",
      });
    }
  };

  const handleCallEnd = async (durationSeconds: number) => {
    if (activeCall?.id) {
      endCall({ callId: activeCall.id, duration: durationSeconds });
    }
    setShowVideoCall(false);
    toast({
      title: "Call ended",
      description: `Call duration: ${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s`,
    });
    // The hook's endCall mutation will handle updating the DB
  };

  if (!activeCall && showVideoCall) {
    return null; // Wait for call to be established
  }

  return (
    <>
      <Button
        onClick={handleInitiateCall}
        disabled={disabled || initiateCallLoading}
        size={size}
        className={`gap-2 ${className}`}
      >
        <Video className="w-4 h-4" />
        {showLabel && (initiateCallLoading ? "Calling..." : "Call Admin")}
      </Button>

      {showVideoCall && activeCall && (
        <VideoCallModal
          roomName={activeCall.room_name}
          displayName={`${initiatorRole === "seeker" ? "Seeker" : "Admin"}`}
          onCallEnd={handleCallEnd}
          onClose={() => {
            setShowVideoCall(false);
          }}
        />
      )}
    </>
  );
};

export default CallButton;
