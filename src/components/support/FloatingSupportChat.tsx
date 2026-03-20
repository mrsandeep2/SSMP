import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import SupportAiAssistant from "@/components/support/SupportAiAssistant";

const FloatingSupportChat = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-4 right-3 z-50 sm:bottom-6 sm:right-6">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-2 bottom-20 max-h-[78dvh] rounded-2xl border border-border/60 bg-background/95 p-2 shadow-2xl backdrop-blur sm:inset-x-auto sm:bottom-24 sm:right-6 sm:w-[410px] sm:p-3"
          >
            <div className="mb-2 flex items-center justify-between rounded-xl border border-border/60 bg-secondary/40 px-3 py-2">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-accent" />
                <p className="text-sm font-semibold text-foreground">Support Chatbot</p>
              </div>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="max-h-[calc(78dvh-56px)] overflow-y-auto pr-1">
              <SupportAiAssistant role={null} onExitChat={() => setOpen(false)} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.96 }}
        onClick={() => setOpen((prev) => !prev)}
        className="group relative flex h-14 w-14 items-center justify-center rounded-full border border-accent/40 bg-gradient-to-br from-accent to-primary text-white shadow-[0_10px_30px_-12px_hsl(var(--accent))]"
        aria-label="Open support chatbot"
      >
        <span className="absolute inset-0 rounded-full bg-accent/40 blur-md animate-pulse" />
        <span className="absolute -inset-1 rounded-full border border-accent/50 animate-ping" />
        <MessageCircle className="relative z-10 h-6 w-6" />
      </motion.button>
    </div>
  );
};

export default FloatingSupportChat;
