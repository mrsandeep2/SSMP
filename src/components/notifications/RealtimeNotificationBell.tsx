import { useState } from "react";
import { Bell, CheckCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type RealtimeNotificationItem = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
};

type RealtimeNotificationBellProps = {
  items: RealtimeNotificationItem[];
  unreadCount?: number;
  onDismiss: (id: string) => void;
  onClearAll: () => void;
  onViewAll?: () => void;
};

const formatTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "now";
  }
};

const RealtimeNotificationBell = ({
  items,
  unreadCount,
  onDismiss,
  onClearAll,
  onViewAll,
}: RealtimeNotificationBellProps) => {
  const [open, setOpen] = useState(false);
  const count = unreadCount ?? items.length;
  const orderedItems = [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-[2px]"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}
      <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="relative rounded-xl" aria-label="Open notifications">
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-50 w-[calc(100vw-1rem)] max-w-[380px] border border-border bg-popover p-0 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
          <DropdownMenuLabel className="p-0">Realtime notifications</DropdownMenuLabel>
          <div className="ml-auto flex items-center gap-1">
            {onViewAll && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => {
                  onViewAll();
                  setOpen(false);
                }}
              >
                View all
              </Button>
            )}
            {count > 0 && (
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onClearAll}>
                <CheckCheck className="h-3.5 w-3.5" />
                Clear
              </Button>
            )}
          </div>
        </div>
        <DropdownMenuSeparator className="m-0" />

        {orderedItems.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">No new notifications</div>
        ) : (
          <div className="max-h-[380px] overflow-y-auto p-2">
            {orderedItems.map((item) => (
              <DropdownMenuItem key={item.id} className="rounded-lg p-0 focus:bg-transparent">
                <div className="w-full rounded-lg border border-border/60 bg-background px-2.5 py-2">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-1 break-words text-sm font-medium text-foreground">{item.title}</p>
                        <p className="shrink-0 text-[10px] text-muted-foreground/80">{formatTime(item.createdAt)}</p>
                      </div>
                      <p className="mt-1 line-clamp-2 break-words text-xs leading-5 text-muted-foreground">{item.body}</p>
                    </div>
                    <button
                      type="button"
                      aria-label="Dismiss notification"
                      className="mt-0.5 rounded-md p-1 text-muted-foreground opacity-70 transition hover:bg-accent hover:text-foreground hover:opacity-100"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onDismiss(item.id);
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};

export default RealtimeNotificationBell;