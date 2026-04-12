import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Phone, PhoneOff, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { VideoCall } from "@/hooks/useVideoCall";

interface CallIncomingDialogProps {
  call: VideoCall | null;
  onAccept: () => void;
  onDecline: () => void;
  acceptLoading?: boolean;
  declineLoading?: boolean;
  initiatorName?: string;
}

const CallIncomingDialog = ({
  call,
  onAccept,
  onDecline,
  acceptLoading = false,
  declineLoading = false,
  initiatorName = "Admin",
}: CallIncomingDialogProps) => {
  const [ringAudio, setRingAudio] = useState<HTMLAudioElement | null>(null);

  // Initialize ring sound
  useEffect(() => {
    // Create a simple beep sound using Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const createRingSound = () => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = "sine";

      // Ring pattern: on for 0.5s, off for 0.5s
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.setValueAtTime(0, audioContext.currentTime + 0.5);

      const startTime = audioContext.currentTime;
      return { oscillator, gainNode, audioContext, startTime };
    };

    if (call && call.status === "pending") {
      const audio = new Audio(
        "data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA=="
      );
      audio.loop = true;
      audio.play().catch(() => {});
      setRingAudio(audio);
    }

    return () => {
      if (ringAudio) {
        ringAudio.pause();
      }
    };
  }, [call?.id, ringAudio]);

  // Stop audio when dialog closes
  useEffect(() => {
    return () => {
      if (ringAudio) {
        ringAudio.pause();
        ringAudio.currentTime = 0;
      }
    };
  }, [ringAudio]);

  if (!call || call.status !== "pending") {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        key="incoming-call-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-end"
      >
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="w-full max-w-md mx-auto bg-gradient-to-br from-background via-background to-background/80 border border-border rounded-t-2xl p-6 shadow-2xl"
        >
          {/* Caller Info */}
          <div className="text-center mb-6">
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="flex justify-center mb-4"
            >
              <Avatar className="w-16 h-16 ring-2 ring-primary">
                <AvatarFallback className="bg-primary/20 text-primary font-semibold">
                  <User className="w-8 h-8" />
                </AvatarFallback>
              </Avatar>
            </motion.div>

            <h2 className="text-xl font-bold text-foreground mb-1">
              Incoming Call from {initiatorName}
            </h2>
            <p className="text-sm text-muted-foreground">
              {call.initiator_role === "admin"
                ? "Admin would like to video call"
                : "Seeker would like to video call"}
            </p>
          </div>

          {/* Call Info */}
          <div className="bg-secondary/50 rounded-xl p-4 mb-6 border border-border/50">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Incoming call</span>
              <motion.span
                animate={{ opacity: [0.5, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="w-2 h-2 rounded-full bg-green-500"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={onDecline}
              disabled={declineLoading}
              variant="destructive"
              size="lg"
              className="flex-1 gap-2 rounded-xl"
            >
              <PhoneOff className="w-5 h-5" />
              {declineLoading ? "Declining..." : "Decline"}
            </Button>
            <Button
              onClick={onAccept}
              disabled={acceptLoading}
              size="lg"
              className="flex-1 gap-2 rounded-xl bg-green-600 hover:bg-green-700"
            >
              <Phone className="w-5 h-5" />
              {acceptLoading ? "Connecting..." : "Accept"}
            </Button>
          </div>

          {/* Helpful Text */}
          <p className="text-xs text-center text-muted-foreground mt-4">
            You have 2 minutes to respond to this call
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default CallIncomingDialog;
