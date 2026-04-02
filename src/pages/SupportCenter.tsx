import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { serviceCategories } from "@/data/marketplace";
import { useSupportCall } from "@/hooks/useSupportCall";
import VideoCallModal from "@/components/videocall/VideoCallModal";

type TicketType = "help" | "complaint" | "feedback";

type SupportTypeOption = {
  id: string;
  label: string;
  mappedType: TicketType;
  defaultSubject: string;
  helper: string;
};

const supportTypeOptions: SupportTypeOption[] = [
  {
    id: "booking_help",
    label: "Booking help",
    mappedType: "help",
    defaultSubject: "Need help with booking",
    helper: "Use this if you are confused about booking steps.",
  },
  {
    id: "service_issue",
    label: "Service issue",
    mappedType: "complaint",
    defaultSubject: "Service quality complaint",
    helper: "Use this for poor service, wrong service, or provider issues.",
  },
  {
    id: "payment_help",
    label: "Payment issue",
    mappedType: "help",
    defaultSubject: "Need help with payment",
    helper: "Use this for payment stuck, failed payment, or refund help.",
  },
  {
    id: "account_help",
    label: "Account help",
    mappedType: "help",
    defaultSubject: "Need help with account",
    helper: "Use this for login/profile/account related help.",
  },
  {
    id: "safety_complaint",
    label: "Safety complaint",
    mappedType: "complaint",
    defaultSubject: "Safety complaint",
    helper: "Use this for serious behavior or safety concerns.",
  },
  {
    id: "feedback",
    label: "Feedback / suggestion",
    mappedType: "feedback",
    defaultSubject: "Platform feedback",
    helper: "Share your idea to improve app experience.",
  },
];

const serviceSubjectOptions = [
  "Provider came late",
  "Provider did not arrive",
  "Wrong service delivered",
  "Asked extra money",
  "Bad behavior",
  "Need refund",
  "Need reschedule",
  "Other service issue",
];

type SupportTicket = {
  id: string;
  ticket_code: string | null;
  created_by: string;
  created_by_role: "seeker" | "provider" | "admin" | null;
  type: TicketType;
  booking_id: string | null;
  service_id: string | null;
  provider_id: string | null;
  route_target: "faq" | "admin" | "provider" | "system";
  assigned_to: string | null;
  assigned_role: "seeker" | "provider" | "admin" | null;
  status: "open" | "in_review" | "awaiting_user" | "assigned" | "resolved" | "closed";
  priority: "low" | "normal" | "high" | "urgent";
  subject: string;
  description: string;
  created_at: string;
  updated_at: string;
};

type SupportTicketMessage = {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_role: "seeker" | "provider" | "admin" | null;
  message: string;
  is_internal: boolean;
  created_at: string;
};

type ProviderOption = {
  user_id: string;
  name: string;
};

type SupportOrder = {
  id: string;
  service_id: string | null;
  status: string;
  amount: number | null;
  created_at: string;
  services?: { title?: string | null } | null;
};

type AiTicketDraft = {
  supportTypeOptionId: string;
  ticketType: TicketType;
  subject: string;
  description: string;
  bookingId: string;
  serviceId: string;
};

const formatDateTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

const SupportCenter = () => {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();
  const { toast } = useToast();

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);

  const [messages, setMessages] = useState<SupportTicketMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const [ticketType, setTicketType] = useState<TicketType>("help");
  const [ticketTypeOptionId, setTicketTypeOptionId] = useState<string>("booking_help");
  const [serviceSubjectPreset, setServiceSubjectPreset] = useState<string>("none");
  const [serviceCategory, setServiceCategory] = useState<string>("none");
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketDescription, setTicketDescription] = useState("");
  const [ticketBookingId, setTicketBookingId] = useState("");
  const [ticketServiceId, setTicketServiceId] = useState("");
  const [creating, setCreating] = useState(false);

  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  const [providerOptions, setProviderOptions] = useState<ProviderOption[]>([]);
  const [orders, setOrders] = useState<SupportOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [adminAssignedRole, setAdminAssignedRole] = useState<"none" | "provider">("none");
  const [adminAssignedTo, setAdminAssignedTo] = useState("");
  const [adminStatus, setAdminStatus] = useState<SupportTicket["status"]>("open");
  const [adminPriority, setAdminPriority] = useState<SupportTicket["priority"]>("normal");
  const [savingAdminControls, setSavingAdminControls] = useState(false);
  const [showSupportCall, setShowSupportCall] = useState(false);
  const [supportRoomName, setSupportRoomName] = useState("");
  const [manualRoomName, setManualRoomName] = useState("");

  const {
    activeRequest,
    endRequest,
    cancelRequest,
  } = useSupportCall();

  const isAdmin = role === "admin";

  const dashboardPath =
    role === "provider" ? "/dashboard/provider" : role === "admin" ? "/dashboard/admin" : "/dashboard/seeker";

  const activeTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === activeTicketId) || null,
    [tickets, activeTicketId]
  );

  const loadTickets = async () => {
    if (!user) return;
    setTicketsLoading(true);

    const query = supabase
      .from("support_tickets" as any)
      .select("*")
      .order("created_at", { ascending: false });

    const { data, error } = await query;
    setTicketsLoading(false);

    if (error) {
      toast({ title: "Failed to load tickets", description: error.message, variant: "destructive" });
      return;
    }

    const rows = ((data || []) as unknown) as SupportTicket[];
    setTickets(rows);

    if (!activeTicketId && rows.length > 0) {
      setActiveTicketId(rows[0].id);
    }
  };

  const loadMessages = async (ticketId: string) => {
    setMessagesLoading(true);
    const { data, error } = await supabase
      .from("support_ticket_messages" as any)
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true });

    setMessagesLoading(false);

    if (error) {
      toast({ title: "Failed to load messages", description: error.message, variant: "destructive" });
      return;
    }

    setMessages(((data || []) as unknown) as SupportTicketMessage[]);
  };

  const loadProviderOptions = async () => {
    if (!isAdmin) return;

    const { data: providers, error } = await supabase
      .from("user_roles" as any)
      .select("user_id")
      .eq("role", "provider");

    if (error || !providers) return;

    const providerIds = providers.map((item: any) => item.user_id).filter(Boolean);
    if (providerIds.length === 0) {
      setProviderOptions([]);
      return;
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name")
      .in("id", providerIds);

    const options = providerIds.map((providerId: string) => {
      const profile = (profiles || []).find((item: any) => item.id === providerId);
      return {
        user_id: providerId,
        name: profile?.name || "Provider",
      };
    });

    setProviderOptions(options);
  };

  const loadOrders = async () => {
    if (!user || !role || role === "admin") {
      setOrders([]);
      return;
    }

    setOrdersLoading(true);

    const roleColumn = role === "provider" ? "provider_id" : "seeker_id";
    const { data, error } = await supabase
      .from("bookings")
      .select("id, service_id, status, amount, created_at, services(title)")
      .eq(roleColumn, user.id)
      .order("created_at", { ascending: false })
      .limit(30);

    setOrdersLoading(false);

    if (error) {
      toast({ title: "Failed to load orders", description: error.message, variant: "destructive" });
      return;
    }

    setOrders((data || []) as unknown as SupportOrder[]);
  };

  const quickComplainForOrder = (order: SupportOrder) => {
    setTicketType("complaint");
    setTicketTypeOptionId("service_issue");
    setTicketBookingId(order.id);
    setTicketServiceId(order.service_id || "");
    setServiceSubjectPreset("Other service issue");
    setTicketSubject("Service issue complaint");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const applyAiDraft = (draft: AiTicketDraft) => {
    setTicketTypeOptionId(draft.supportTypeOptionId || "booking_help");
    setTicketType(draft.ticketType || "help");
    setTicketSubject((draft.subject || "").trim());

    if (draft.description?.trim()) {
      setTicketDescription(draft.description.trim());
    }

    if (draft.bookingId?.trim()) {
      setTicketBookingId(draft.bookingId.trim());
    }

    if (draft.serviceId?.trim()) {
      setTicketServiceId(draft.serviceId.trim());
    }

    toast({ title: "AI draft applied", description: "Ticket form is pre-filled. Review and submit." });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    void loadTickets();
    void loadProviderOptions();
    void loadOrders();
  }, [user?.id, isAdmin]);

  useEffect(() => {
    if (!activeTicketId) {
      setMessages([]);
      return;
    }

    void loadMessages(activeTicketId);
  }, [activeTicketId]);

  useEffect(() => {
    if (!activeTicket) return;

    setAdminAssignedRole(activeTicket.assigned_role === "provider" ? "provider" : "none");
    setAdminAssignedTo(activeTicket.assigned_to || "");
    setAdminStatus(activeTicket.status);
    setAdminPriority(activeTicket.priority);
  }, [activeTicket?.id]);

  useEffect(() => {
    if (activeRequest && (activeRequest.status === "waiting" || activeRequest.status === "active")) {
      if (!supportRoomName) {
        setSupportRoomName(activeRequest.room_name);
      }
      setShowSupportCall(true);
      return;
    }
    if (!supportRoomName) {
      setShowSupportCall(false);
    }
  }, [activeRequest?.id, activeRequest?.status, supportRoomName]);

  const createTicket = async () => {
    if (!user) return;
    if (!ticketDescription.trim()) {
      toast({ title: "Missing details", description: "Please describe your issue in simple words.", variant: "destructive" });
      return;
    }

    const selectedType =
      supportTypeOptions.find((option) => option.id === ticketTypeOptionId) || supportTypeOptions[0];
    const mappedType = selectedType.mappedType;

    const presetSubject = serviceSubjectPreset !== "none" ? serviceSubjectPreset : "";
    const baseSubject = ticketSubject.trim() || presetSubject || selectedType.defaultSubject;
    const categoryPrefix = serviceCategory !== "none" ? `${serviceCategory}: ` : "";
    const subjectToSave = `${categoryPrefix}${baseSubject}`.trim();

    setCreating(true);
    const { data, error } = await supabase
      .from("support_tickets" as any)
      .insert({
        created_by: user.id,
        type: mappedType,
        booking_id: ticketBookingId.trim() || null,
        service_id: ticketServiceId.trim() || null,
        subject: subjectToSave,
        description: ticketDescription.trim(),
        metadata: {
          selected_type: selectedType.id,
          selected_type_label: selectedType.label,
          service_subject: presetSubject || null,
          service_category: serviceCategory !== "none" ? serviceCategory : null,
          manual_service_id: ticketServiceId.trim() || null,
        },
      })
      .select("*")
      .single();
    setCreating(false);

    if (error) {
      toast({ title: "Failed to create ticket", description: error.message, variant: "destructive" });
      return;
    }

    const created = (data as unknown) as SupportTicket;
    setTickets((prev) => [created, ...prev]);
    setActiveTicketId(created.id);
    setTicketSubject("");
    setTicketDescription("");
    setTicketBookingId("");
    setTicketServiceId("");
    setTicketType("help");
    setTicketTypeOptionId("booking_help");
    setServiceSubjectPreset("none");
    setServiceCategory("none");

    toast({ title: "Ticket created", description: "Support ticket submitted successfully." });
  };

  const sendMessage = async () => {
    if (!user || !activeTicket || !newMessage.trim()) return;

    setSendingMessage(true);
    const { data, error } = await supabase
      .from("support_ticket_messages" as any)
      .insert({
        ticket_id: activeTicket.id,
        sender_id: user.id,
        message: newMessage.trim(),
      })
      .select("*")
      .single();
    setSendingMessage(false);

    if (error) {
      toast({ title: "Failed to send message", description: error.message, variant: "destructive" });
      return;
    }

    const created = (data as unknown) as SupportTicketMessage;
    setMessages((prev) => [...prev, created]);
    setNewMessage("");
  };

  const saveAdminControls = async () => {
    if (!isAdmin || !activeTicket) return;

    if (adminAssignedRole === "provider" && !adminAssignedTo) {
      toast({ title: "Select provider", description: "Choose a provider before assigning.", variant: "destructive" });
      return;
    }

    setSavingAdminControls(true);
    const payload: Record<string, any> = {
      status: adminStatus,
      priority: adminPriority,
      assigned_role: adminAssignedRole === "provider" ? "provider" : null,
      assigned_to: adminAssignedRole === "provider" ? adminAssignedTo : null,
    };

    const { data, error } = await supabase
      .from("support_tickets" as any)
      .update(payload)
      .eq("id", activeTicket.id)
      .select("*")
      .single();
    setSavingAdminControls(false);

    if (error) {
      toast({ title: "Failed to update ticket", description: error.message, variant: "destructive" });
      return;
    }

    const updated = (data as unknown) as SupportTicket;
    setTickets((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    toast({ title: "Ticket updated", description: "Admin controls saved." });
  };


  const handleJoinRoom = () => {
    const room = manualRoomName.trim();
    if (!room) {
      toast({ title: "Room ID required", description: "Enter a valid room id to join.", variant: "destructive" });
      return;
    }
    if (activeRequest?.id) {
      cancelRequest(activeRequest.id);
    }
    setSupportRoomName(room);
    setShowSupportCall(true);
  };

  const handleCopyRoom = async () => {
    if (!supportRoomName) return;
    try {
      await navigator.clipboard.writeText(supportRoomName);
      toast({ title: "Room copied", description: supportRoomName });
    } catch (error: any) {
      toast({
        title: "Copy failed",
        description: error?.message || "Could not copy room id",
        variant: "destructive",
      });
    }
  };

  const handleSupportCallEnd = (durationSeconds: number) => {
    if (activeRequest?.id) {
      endRequest(activeRequest.id);
    }
    toast({
      title: "Call ended",
      description: `Call duration: ${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s`,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <span className="text-muted-foreground">Loading...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container px-4 pt-24 pb-12">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold font-display text-foreground md:text-3xl">Support Center</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Raise help requests, complaints, and track support replies.
            </p>
          </div>
          <Button variant="outline" size="sm" className="w-full md:w-auto" onClick={() => navigate(dashboardPath)}>
            Back to Dashboard
          </Button>
        </div>

        {!isAdmin && (
          <div className="mb-4 rounded-2xl border border-border/60 bg-secondary/20 p-4">
            <div className="flex flex-col gap-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">Video Support</h2>
                <p className="text-sm text-muted-foreground">Join an admin room using the room id.</p>
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                placeholder="Enter room id to join"
                value={manualRoomName}
                onChange={(event) => setManualRoomName(event.target.value)}
                className="sm:flex-1"
              />
              <Button variant="outline" className="w-full sm:w-auto" onClick={handleJoinRoom}>
                Join Video Call
              </Button>
            </div>
            {supportRoomName && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Room:</span>
                <span className="font-mono text-foreground break-all">{supportRoomName}</span>
                <Button size="sm" variant="ghost" onClick={handleCopyRoom}>
                  Copy
                </Button>
              </div>
            )}
          </div>
        )}

        {role !== "admin" && (
          <div className="mb-4 rounded-2xl border border-border/60 bg-secondary/20 p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base font-semibold text-foreground">Your Existing Orders (Use for Complaint)</h2>
              <Button variant="ghost" size="sm" className="w-full sm:w-auto" onClick={() => void loadOrders()}>Refresh</Button>
            </div>

            {ordersLoading ? (
              <p className="text-sm text-muted-foreground">Loading orders...</p>
            ) : orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders found yet.</p>
            ) : (
              <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1">
                {orders.map((order) => (
                  <div key={order.id} className="rounded-xl border border-border/60 bg-background/40 p-3">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div className="text-xs text-muted-foreground break-words">
                        <p className="text-sm font-semibold text-foreground">{order.services?.title || "Service"}</p>
                        <p>Booking ID: <span className="font-mono break-all">{order.id}</span></p>
                        <p>Service ID: <span className="font-mono break-all">{order.service_id || "-"}</span></p>
                        <p>Status: <span className="capitalize">{order.status}</span> • Amount: ₹{order.amount ?? 0}</p>
                      </div>
                      <Button size="sm" variant="outline" className="w-full md:w-auto" onClick={() => quickComplainForOrder(order)}>
                        Use this order for complaint
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-border/60 bg-secondary/20 p-4 lg:col-span-1">
            <h2 className="text-base font-semibold text-foreground">Create Ticket</h2>
            <div className="mt-3 space-y-3">
              <div>
                <Label>Issue Type (Easy)</Label>
                <Select
                  value={ticketTypeOptionId}
                  onValueChange={(value) => {
                    setTicketTypeOptionId(value);
                    const selected = supportTypeOptions.find((option) => option.id === value);
                    if (selected) {
                      setTicketType(selected.mappedType);
                      if (!ticketSubject.trim()) {
                        setTicketSubject(selected.defaultSubject);
                      }
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {supportTypeOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">
                  {supportTypeOptions.find((option) => option.id === ticketTypeOptionId)?.helper}
                </p>
              </div>

              <div>
                <Label>Service Related Subject (Quick Select)</Label>
                <Select
                  value={serviceSubjectPreset}
                  onValueChange={(value) => {
                    setServiceSubjectPreset(value);
                    if (value !== "none") {
                      setTicketSubject(value);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pick your issue quickly" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not sure / Other</SelectItem>
                    {serviceSubjectOptions.map((subject) => (
                      <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Service Category (Optional)</Label>
                <Select value={serviceCategory} onValueChange={setServiceCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose service category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not selected</SelectItem>
                    {serviceCategories.map((category) => (
                      <SelectItem key={category.id} value={category.name}>{category.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Subject (Auto or Manual)</Label>
                <Input
                  value={ticketSubject}
                  onChange={(event) => setTicketSubject(event.target.value)}
                  placeholder="Example: Provider came late"
                />
              </div>

              <div>
                <Label>Description</Label>
                <Textarea
                  value={ticketDescription}
                  onChange={(event) => setTicketDescription(event.target.value)}
                  rows={4}
                  placeholder="Write in simple language. Example: Provider came 1 hour late and asked extra money."
                />
              </div>

              <div>
                <Label>Booking ID (optional)</Label>
                <Input
                  value={ticketBookingId}
                  onChange={(event) => setTicketBookingId(event.target.value)}
                  placeholder="Paste related booking id"
                />
              </div>

              <div>
                <Label>Service ID (optional)</Label>
                <Input
                  value={ticketServiceId}
                  onChange={(event) => setTicketServiceId(event.target.value)}
                  placeholder="Paste related service id"
                />
              </div>

              <Button onClick={createTicket} disabled={creating} className="w-full" variant="hero">
                {creating ? "Creating..." : "Submit Ticket"}
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-secondary/20 p-4 lg:col-span-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-border/60 bg-background/40 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Tickets</h3>
                  <Button variant="ghost" size="sm" className="min-w-20" onClick={() => void loadTickets()}>
                    Refresh
                  </Button>
                </div>

                {ticketsLoading ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Loading tickets...</p>
                ) : tickets.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No tickets yet.</p>
                ) : (
                  <div className="max-h-[440px] space-y-2 overflow-y-auto pr-1">
                    {tickets.map((ticket) => (
                      <button
                        key={ticket.id}
                        type="button"
                        onClick={() => setActiveTicketId(ticket.id)}
                        className={`w-full rounded-lg border p-3 text-left transition ${
                          activeTicketId === ticket.id
                            ? "border-accent/60 bg-accent/10"
                            : "border-border/60 bg-background/40"
                        }`}
                      >
                        <p className="text-sm font-semibold text-foreground line-clamp-1">{ticket.subject}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {ticket.type} • {ticket.status} • {formatDateTime(ticket.created_at)}
                        </p>
                        {ticket.ticket_code && (
                          <p className="mt-1 text-[11px] font-mono text-accent">{ticket.ticket_code}</p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-border/60 bg-background/40 p-3">
                {!activeTicket ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Select a ticket to view details.</p>
                ) : (
                  <>
                    <h3 className="text-sm font-semibold text-foreground">Ticket Details</h3>
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      <p><span className="text-foreground">Ticket:</span> <span className="break-all">{activeTicket.ticket_code || activeTicket.id}</span></p>
                      <p><span className="text-foreground">Raised by:</span> {activeTicket.created_by_role || "user"}</p>
                      <p><span className="text-foreground">Type:</span> {activeTicket.type}</p>
                      <p><span className="text-foreground">Status:</span> {activeTicket.status}</p>
                      <p><span className="text-foreground">Priority:</span> {activeTicket.priority}</p>
                      <p><span className="text-foreground">Route:</span> {activeTicket.route_target}</p>
                      <p><span className="text-foreground">Booking:</span> <span className="break-all">{activeTicket.booking_id || "-"}</span></p>
                      <p><span className="text-foreground">Service:</span> <span className="break-all">{activeTicket.service_id || "-"}</span></p>
                    </div>

                    <div className="mt-3 rounded-lg border border-border/60 bg-background p-2">
                      <p className="text-sm text-foreground">{activeTicket.description}</p>
                    </div>

                    {isAdmin && (
                      <div className="mt-3 space-y-2 rounded-lg border border-border/60 bg-background p-3">
                        <p className="text-xs font-semibold text-foreground">Admin Controls</p>

                        <div>
                          <Label>Status</Label>
                          <Select value={adminStatus} onValueChange={(value) => setAdminStatus(value as SupportTicket["status"])}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="open">Open</SelectItem>
                              <SelectItem value="in_review">In Review</SelectItem>
                              <SelectItem value="awaiting_user">Awaiting User</SelectItem>
                              <SelectItem value="assigned">Assigned</SelectItem>
                              <SelectItem value="resolved">Resolved</SelectItem>
                              <SelectItem value="closed">Closed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Priority</Label>
                          <Select value={adminPriority} onValueChange={(value) => setAdminPriority(value as SupportTicket["priority"])}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="normal">Normal</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="urgent">Urgent</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Assign Role</Label>
                          <Select value={adminAssignedRole} onValueChange={(value) => setAdminAssignedRole(value as "none" | "provider")}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Admin/Internal</SelectItem>
                              <SelectItem value="provider">Provider</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {adminAssignedRole === "provider" && (
                          <div>
                            <Label>Assign To Provider</Label>
                            <Select value={adminAssignedTo || ""} onValueChange={setAdminAssignedTo}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select provider" />
                              </SelectTrigger>
                              <SelectContent>
                                {providerOptions.length === 0 ? (
                                  <SelectItem value="none" disabled>No providers found</SelectItem>
                                ) : (
                                  providerOptions.map((provider) => (
                                    <SelectItem key={provider.user_id} value={provider.user_id}>
                                      {provider.name}
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        <Button onClick={saveAdminControls} disabled={savingAdminControls} className="w-full" size="sm">
                          {savingAdminControls ? "Saving..." : "Save Admin Controls"}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {activeTicket && (
              <div className="mt-4 rounded-xl border border-border/60 bg-background/40 p-3">
                <h3 className="text-sm font-semibold text-foreground">Conversation</h3>

                <div className="mt-3 max-h-[280px] space-y-2 overflow-y-auto pr-1">
                  {messagesLoading ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">Loading messages...</p>
                  ) : messages.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">No messages yet.</p>
                  ) : (
                    messages.map((item) => (
                      <div key={item.id} className="rounded-lg border border-border/60 bg-background p-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-foreground">{item.sender_role || "user"}</p>
                          <p className="text-[11px] text-muted-foreground">{formatDateTime(item.created_at)}</p>
                        </div>
                        <p className="mt-1 text-sm text-foreground">{item.message}</p>
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <Textarea
                    rows={2}
                    value={newMessage}
                    onChange={(event) => setNewMessage(event.target.value)}
                    placeholder="Write a reply..."
                    className="sm:flex-1"
                  />
                  <Button onClick={sendMessage} disabled={sendingMessage || !newMessage.trim()} className="sm:w-auto">
                    {sendingMessage ? "Sending..." : "Send"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showSupportCall && supportRoomName && (
        <VideoCallModal
          roomName={supportRoomName}
          displayName="Seeker"
          showWaiting={false}
          onCallEnd={handleSupportCallEnd}
          onClose={() => {
            setShowSupportCall(false);
            if (activeRequest?.room_name === supportRoomName && activeRequest.status === "waiting") {
              cancelRequest(activeRequest.id);
            }
            setSupportRoomName("");
          }}
        />
      )}
    </div>
  );
};

export default SupportCenter;
