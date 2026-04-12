import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Calendar as CalendarIcon, Star, CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import ServiceLocationPicker from "@/components/booking/ServiceLocationPicker";
import { Calendar } from "@/components/ui/calendar";

interface BookingModalProps {
  service: any;
  onClose: () => void;
}

const timeSlots = [
  "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
  "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM",
];

const getLocalDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatLocalDate = (dateValue: Date) => {
  const year = dateValue.getFullYear();
  const month = String(dateValue.getMonth() + 1).padStart(2, "0");
  const day = String(dateValue.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDisplayDate = (value: string) => {
  const parts = value.split("-");
  if (parts.length !== 3) return value;
  const [year, month, day] = parts;
  if (!year || !month || !day) return value;
  return `${day}-${month}-${year}`;
};

const parseLocalDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const BookingModal = ({ service, onClose }: BookingModalProps) => {
  const [step, setStep] = useState<"details" | "time" | "confirm" | "success">("details");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [serviceLocation, setServiceLocation] = useState<{
    latitude: number;
    longitude: number;
    address: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [blockedDate, setBlockedDate] = useState<Date | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [nowTick, setNowTick] = useState(0);
  const { user, role } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const id = window.setInterval(() => setNowTick((prev) => prev + 1), 60000);
    return () => window.clearInterval(id);
  }, []);

  const todayStr = useMemo(() => getLocalDateString(), [nowTick]);
  const todayDate = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }, [nowTick]);

  const isSameDay = (a: string, b: string) => a === b;

  const getSlotMinutes = (slot: string) => {
    const match = slot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return null;
    let hours = Number(match[1]);
    const minutes = Number(match[2]);
    const meridiem = match[3].toUpperCase();
    if (meridiem === "PM" && hours < 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;
    return hours * 60 + minutes;
  };

  const availableSlots = useMemo(() => {
    if (!date) return timeSlots;
    if (date < todayStr) return [];
    if (!isSameDay(date, todayStr)) return timeSlots;
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    return timeSlots.filter((slot) => {
      const slotMinutes = getSlotMinutes(slot);
      return slotMinutes !== null && slotMinutes >= nowMinutes;
    });
  }, [date, todayStr, nowTick]);

  useEffect(() => {
    if (!date || !time) return;
    if (date < todayStr) {
      setTime("");
      return;
    }
    if (!isSameDay(date, todayStr)) return;
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const slotMinutes = getSlotMinutes(time);
    if (slotMinutes !== null && slotMinutes < nowMinutes) {
      setTime("");
    }
  }, [date, time, todayStr]);

  const isDateValid = useMemo(() => {
    return Boolean(date) && date >= todayStr;
  }, [date, todayStr]);

  const isSelectedTimeValid = useMemo(() => {
    if (!date || !time) return false;
    if (date < todayStr) return false;
    if (!isSameDay(date, todayStr)) return true;
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const slotMinutes = getSlotMinutes(time);
    if (slotMinutes === null) return false;
    return slotMinutes >= nowMinutes;
  }, [date, time, todayStr, nowTick]);

  const handleBook = async () => {
    if (role === "provider") {
      toast({
        title: "Providers cannot book services",
        description: "Provider accounts can only offer services, not book them.",
        variant: "destructive",
      });
      return;
    }
    if (!user) {
      toast({ title: "Please sign in", description: "You need to be logged in to book", variant: "destructive" });
      navigate("/login");
      return;
    }

    if (!isDateValid || !time || !isSelectedTimeValid) {
      toast({
        title: "Choose a valid time",
        description: "Please select a time slot in the future.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("bookings").insert({
      seeker_id: user.id,
      provider_id: service.provider_id,
      service_id: service.id,
      scheduled_date: date,
      scheduled_time: time,
      notes,
      amount: service.price,
      status: "pending",
      booking_location_latitude: serviceLocation?.latitude ?? null,
      booking_location_longitude: serviceLocation?.longitude ?? null,
      booking_address: serviceLocation?.address ?? null,
    } as any);
    setLoading(false);

    if (error) {
      toast({ title: "Booking failed", description: error.message, variant: "destructive" });
    } else {
      setStep("success");
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="glass rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col relative overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button 
            onClick={onClose} 
            className="absolute top-4 right-4 z-10 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Scrollable Content */}
          <div className="overflow-y-auto flex-1 px-8 pt-8 pb-4">
            {step === "details" && (
              <div>
                <h2 className="text-2xl font-bold font-display text-foreground mb-2">Book Service</h2>
                <div className="flex items-center gap-3 mb-6 p-4 rounded-xl bg-secondary/30">
                  <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground font-bold">
                    {(service.profiles as any)?.name?.slice(0, 2).toUpperCase() || "??"}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{service.title}</h3>
                    <p className="text-sm text-muted-foreground">{(service.profiles as any)?.name}</p>
                  </div>
                  <div className="ml-auto">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-warning fill-warning" />
                      <span className="text-sm">{service.rating || "New"}</span>
                    </div>
                    <span className="font-display font-bold text-accent">₹{service.price}</span>
                  </div>
                </div>
                <p className="text-muted-foreground text-sm">{service.description}</p>
              </div>
            )}

            {step === "time" && (
              <div>
                {!isDatePickerOpen && (
                  <h2 className="text-2xl font-bold font-display text-foreground mb-6">Choose Date & Time</h2>
                )}
                <div className="space-y-4">
                  <div>
                    {!isDatePickerOpen && <Label className="text-foreground">Date</Label>}
                    <div className="relative mt-2">
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left pl-10 bg-secondary/50 border-border rounded-xl h-11"
                        onClick={() => setIsDatePickerOpen((prev) => !prev)}
                      >
                        <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                        {date ? formatDisplayDate(date) : "Select date"}
                      </Button>
                    </div>
                    {isDatePickerOpen && (
                      <div className="mt-3 flex justify-center rounded-xl border border-border bg-background/40 p-2">
                        <Calendar
                          mode="single"
                          selected={date ? parseLocalDate(date) ?? undefined : undefined}
                          onSelect={(day) => {
                            if (!day) return;
                            setDate(formatLocalDate(day));
                            setIsDatePickerOpen(false);
                          }}
                          onDayClick={(day, modifiers) => {
                            if (modifiers?.disabled || day < todayDate) {
                              setBlockedDate(day);
                              toast({
                                title: "Past date",
                                description: "You can't book a past date.",
                                variant: "destructive",
                              });
                            }
                          }}
                          disabled={{ before: todayDate }}
                          modifiers={{ blocked: blockedDate ?? undefined }}
                          modifiersClassNames={{
                            blocked: "ring-2 ring-destructive text-destructive rounded-full",
                          }}
                          initialFocus
                        />
                      </div>
                    )}
                  </div>

                  {!isDatePickerOpen && (
                    <>
                      <div>
                        <Label className="text-foreground">Time Slot</Label>
                        <div className="grid grid-cols-3 gap-2 mt-2">
                          {timeSlots.map((slot) => {
                            const isAvailable = availableSlots.includes(slot);
                            const isSelected = time === slot;
                            return (
                            <motion.button
                              key={slot}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => (isAvailable ? setTime(slot) : undefined)}
                              disabled={!isAvailable}
                              className={`py-2 px-2 rounded-lg text-sm font-medium transition-all ${
                                isSelected
                                  ? "gradient-primary text-primary-foreground"
                                  : isAvailable
                                    ? "bg-secondary/50 text-muted-foreground hover:text-foreground"
                                    : "bg-secondary/30 text-muted-foreground/50 cursor-not-allowed"
                              }`}
                            >
                              {slot}
                            </motion.button>
                          );
                        })}
                        </div>
                        {date && date === todayStr && availableSlots.length === 0 && (
                          <div className="mt-3 text-sm text-warning">
                            No time slots left today. Please choose a future date.
                          </div>
                        )}
                      </div>

                      <div>
                        <Label className="text-foreground">Notes (optional)</Label>
                        <Input
                          placeholder="Any special instructions..."
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          className="bg-secondary/50 border-border mt-2 rounded-xl h-11"
                        />
                      </div>

                      <div>
                        <Label className="text-foreground mb-3 block">Select Service Location</Label>
                        <ServiceLocationPicker value={serviceLocation} onChange={setServiceLocation} />
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {step === "confirm" && (
              <div>
                <h2 className="text-2xl font-bold font-display text-foreground mb-6">Confirm Booking</h2>
                <div className="space-y-3 p-4 rounded-xl bg-secondary/30">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Service</span>
                    <span className="text-foreground font-medium text-right">{service.title}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Provider</span>
                    <span className="text-foreground text-right">{(service.profiles as any)?.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Date</span>
                    <span className="text-foreground text-right">{date}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Time</span>
                    <span className="text-foreground text-right">{time}</span>
                  </div>
                  <div className="flex justify-between text-sm gap-4">
                    <span className="text-muted-foreground">Location</span>
                    <span className="text-foreground text-right max-w-[200px]">{serviceLocation?.address || "Not selected"}</span>
                  </div>
                  <div className="border-t border-border pt-3 flex justify-between">
                    <span className="text-foreground font-semibold">Total</span>
                    <span className="text-accent font-display font-bold text-lg">₹{service.price}</span>
                  </div>
                </div>
              </div>
            )}

            {step === "success" && (
              <div className="text-center py-8">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
                  <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
                </motion.div>
                <h2 className="text-2xl font-bold font-display text-foreground mb-2">Booking Confirmed!</h2>
                <p className="text-muted-foreground">Your booking has been placed. The provider will confirm shortly.</p>
              </div>
            )}
          </div>

          {/* Sticky Footer */}
          {!(step === "time" && isDatePickerOpen) && (
          <div className="border-t border-border px-8 py-4 bg-background/50 backdrop-blur-sm shrink-0">
            {step === "details" && (
              <Button 
                variant="hero" 
                className="w-full rounded-xl h-11" 
                onClick={() => setStep("time")}
              >
                Select Date & Time
              </Button>
            )}

            {step === "time" && (
              <div className="flex gap-3">
                <Button 
                  variant="glass" 
                  className="flex-1 rounded-xl h-11" 
                  onClick={() => setStep("details")}
                >
                  Back
                </Button>
                <Button 
                  variant="hero" 
                  className="flex-1 rounded-xl h-11" 
                  disabled={!isDateValid || !time || !serviceLocation || !isSelectedTimeValid} 
                  onClick={() => setStep("confirm")}
                >
                  Review Booking
                </Button>
              </div>
            )}

            {step === "confirm" && (
              <div className="flex gap-3">
                <Button 
                  variant="glass" 
                  className="flex-1 rounded-xl h-11" 
                  onClick={() => setStep("time")}
                >
                  Back
                </Button>
                <Button 
                  variant="hero" 
                  className="flex-1 rounded-xl h-11" 
                  disabled={loading} 
                  onClick={handleBook}
                >
                  {loading ? "Booking..." : "Confirm Booking"}
                </Button>
              </div>
            )}

            {step === "success" && (
              <div className="flex gap-3">
                <Button 
                  variant="glass" 
                  className="flex-1 rounded-xl h-11" 
                  onClick={onClose}
                >
                  Close
                </Button>
                <Button 
                  variant="hero" 
                  className="flex-1 rounded-xl h-11" 
                  onClick={() => navigate("/dashboard/seeker")}
                >
                  View Orders
                </Button>
              </div>
            )}
          </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default BookingModal;
