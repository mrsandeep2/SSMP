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
  const count = unreadCount ?? items.length;

  return (
    <DropdownMenu>
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
      <DropdownMenuContent align="end" className="w-[340px] max-w-[92vw] p-0">
        <div className="flex items-center justify-between px-3 py-2">
          <DropdownMenuLabel className="p-0">Realtime notifications</DropdownMenuLabel>
          <div className="flex items-center gap-1">
            {onViewAll && (
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onViewAll}>
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

        {items.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">No new notifications</div>
        ) : (
          <div className="max-h-[360px] overflow-y-auto p-1">
            {items.map((item) => (
              <DropdownMenuItem
                key={item.id}
                className="group flex items-start justify-between gap-2 rounded-lg px-2.5 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.body}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground/80">{formatTime(item.createdAt)}</p>
                </div>
                <button
                  type="button"
                  aria-label="Dismiss notification"
                  className="rounded-md p-1 text-muted-foreground opacity-70 transition hover:bg-accent hover:text-foreground hover:opacity-100"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onDismiss(item.id);
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default RealtimeNotificationBell;