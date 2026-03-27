import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Video, VideoOff, SwitchCamera, PhoneOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VideoCallModalProps {
  roomName: string;
  displayName: string;
  onCallEnd: (durationSeconds: number) => void;
  onClose: () => void;
}

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

const VideoCallModal = ({
  roomName,
  displayName,
  onCallEnd,
  onClose,
}: VideoCallModalProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const jitsiRef = useRef<any>(null);
  const callStartTimeRef = useRef<number>(Date.now());
  const [isLoading, setIsLoading] = useState(true);
  const [apiReady, setApiReady] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [switchingCamera, setSwitchingCamera] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [remoteParticipantCount, setRemoteParticipantCount] = useState(0);
  const { toast } = useToast();

  // Load Jitsi Meet API script
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://meet.jit.si/external_api.js";
    script.async = true;
    script.onload = () => {
      console.log("✅ Jitsi API loaded");
      setApiReady(true);
    };
    script.onerror = () => {
      console.error("❌ Failed to load Jitsi API");
      toast({
        title: "Error",
        description: "Failed to load video call service",
        variant: "destructive",
      });
      onClose();
    };
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, [onClose, toast]);

  // Initialize Jitsi Meet
  useEffect(() => {
    if (!apiReady || !containerRef.current) return;

    const initJitsi = () => {
      try {
        const options = {
          roomName: roomName,
          width: "100%",
          height: "100%",
          parentNode: containerRef.current,
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            DEFAULT_BACKGROUND: "#000",
            MOBILE_APP_PROMO: false,
            HIDE_INVITE_MORE_HEADER: true,
            TOOLBAR_BUTTONS: [
              "microphone",
              "camera",
              "closedcaptions",
              "desktop",
              "fullscreen",
              "fodeviceselection",
              "hangup",
              "profile",
              "chat",
              "recording",
              "livestream",
              "etherpad",
              "settings",
              "raisehand",
              "videoquality",
              "filmstrip",
              "feedback",
              "stats",
              "shortcuts",
              "tileview",
              "download",
              "help",
              "mute-everyone",
              "e2ee",
              "security",
            ],
          },
          configOverwrite: {
            disableSimulcast: false,
            startAudioOnly: false,
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            enableNoAudioSignalTitle: true,
            enableNoisyMicDetection: true,
            resolution: 720,
            constraints: {
              video: {
                height: {
                  ideal: 720,
                  max: 720,
                  min: 180,
                },
                width: {
                  ideal: 1280,
                  max: 1280,
                  min: 320,
                },
              },
            },
          },
          userInfo: {
            displayName,
          },
        };

        jitsiRef.current = new window.JitsiMeetExternalAPI(
          "meet.jit.si",
          options
        );

        jitsiRef.current.addEventListener("audioMuteStatusChanged", (event: { muted: boolean }) => {
          setIsAudioMuted(Boolean(event?.muted));
        });

        jitsiRef.current.addEventListener("videoMuteStatusChanged", (event: { muted: boolean }) => {
          setIsVideoMuted(Boolean(event?.muted));
        });

        // Handle ready event
        jitsiRef.current.addEventListener("readyToClose", () => {
          console.log("📞 Call ended by Jitsi");
          handleCallEnd();
        });

        // Keep a lightweight participant count to show waiting state.
        jitsiRef.current.addEventListener("participantJoined", () => {
          console.log("👤 Participant joined");
          setRemoteParticipantCount((prev) => prev + 1);
        });

        jitsiRef.current.addEventListener("participantLeft", () => {
          console.log("👤 Participant left");
          setRemoteParticipantCount((prev) => Math.max(0, prev - 1));
        });

        setIsLoading(false);
      } catch (error) {
        console.error("❌ Failed to initialize Jitsi:", error);
        toast({
          title: "Error",
          description: "Failed to initialize video call",
          variant: "destructive",
        });
        onClose();
      }
    };

    // Small delay to ensure container is ready
    const timer = setTimeout(initJitsi, 100);

    return () => {
      clearTimeout(timer);
      if (jitsiRef.current) {
        try {
          jitsiRef.current.dispose();
        } catch (error) {
          console.error("Error disposing Jitsi:", error);
        }
        jitsiRef.current = null;
      }
    };
  }, [apiReady, roomName, displayName, onClose, toast]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const seconds = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
      setElapsedSeconds(seconds);
    }, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const secs = (seconds % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  const handleCallEnd = () => {
    const durationSeconds = Math.floor(
      (Date.now() - callStartTimeRef.current) / 1000
    );
    console.log(`📞 Call ended. Duration: ${durationSeconds}s`);
    onCallEnd(durationSeconds);
    onClose();
  };

  const toggleAudio = () => {
    if (!jitsiRef.current) return;
    jitsiRef.current.executeCommand("toggleAudio");
  };

  const toggleVideo = () => {
    if (!jitsiRef.current) return;
    jitsiRef.current.executeCommand("toggleVideo");
  };

  const switchCamera = async () => {
    if (!jitsiRef.current || switchingCamera) return;

    try {
      setSwitchingCamera(true);

      const currentDevices = await jitsiRef.current.getCurrentDevices?.();
      const allDevices = await jitsiRef.current.getAvailableDevices?.();
      const videoInputs = allDevices?.videoInput || [];

      if (videoInputs.length < 2) {
        toast({
          title: "Camera switch unavailable",
          description: "Only one camera was detected on this device.",
        });
        return;
      }

      const currentId = currentDevices?.videoInput?.deviceId;
      const currentIndex = videoInputs.findIndex((d: any) => d.deviceId === currentId);
      const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % videoInputs.length : 0;
      const nextDevice = videoInputs[nextIndex];

      if (nextDevice?.deviceId) {
        jitsiRef.current.executeCommand("setVideoInputDevice", nextDevice.deviceId);
        toast({
          title: "Camera switched",
          description: "Switched between front/rear camera.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Camera switch failed",
        description: error?.message || "Could not switch camera.",
        variant: "destructive",
      });
    } finally {
      setSwitchingCamera(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black flex flex-col"
      >
        {/* Header */}
        <div className="bg-background/95 backdrop-blur-sm border-b border-border p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-medium">Video Call Active</span>
            <span className="text-xs text-muted-foreground">{formatDuration(elapsedSeconds)}</span>
            {remoteParticipantCount === 0 && (
              <span className="text-xs text-amber-400">Waiting for other user...</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={toggleAudio} className="gap-2">
              {isAudioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              {isAudioMuted ? "Unmute" : "Mute"}
            </Button>
            <Button size="sm" variant="outline" onClick={toggleVideo} className="gap-2">
              {isVideoMuted ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
              {isVideoMuted ? "Camera On" : "Camera Off"}
            </Button>
            <Button size="sm" variant="outline" onClick={switchCamera} disabled={switchingCamera} className="gap-2">
              <SwitchCamera className="w-4 h-4" />
              {switchingCamera ? "Switching..." : "Flip Camera"}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleCallEnd}
              className="gap-2"
            >
              <PhoneOff className="w-4 h-4" />
              End Call
            </Button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin mx-auto mb-3" />
              <p className="text-muted-foreground">Connecting to video call...</p>
            </div>
          </div>
        )}

        {/* Jitsi Container */}
        <div
          ref={containerRef}
          className="flex-1 w-full bg-black"
          style={{ display: isLoading ? "none" : "block" }}
        />
      </motion.div>
    </AnimatePresence>
  );
};

export default VideoCallModal;
