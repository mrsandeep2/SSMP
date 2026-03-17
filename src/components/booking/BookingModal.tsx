import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Calendar, Clock, Star, CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import ServiceLocationPicker from "@/components/booking/ServiceLocationPicker";

interface BookingModalProps {
  service: any;
  onClose: () => void;
}

const timeSlots = [
  "09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM",
  "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM",
];

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
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleBook = async () => {
    if (!user) {
      toast({ title: "Please sign in", description: "You need to be logged in to book", variant: "destructive" });
      navigate("/login");
      return;
    }

    console.log("🎯 Creating booking with:", {
      seeker_id: user.id,
      seeker_email: user.email,
      provider_id: service.provider_id,
      service_id: service.id,
      amount: service.price,
    });

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
      console.error("❌ Booking creation failed:", error);
      toast({ title: "Booking failed", description: error.message, variant: "destructive" });
    } else {
      console.log("✅ Booking created successfully!");
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
          className="glass rounded-2xl p-8 w-full max-w-lg relative"
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={onClose} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>

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
              <p className="text-muted-foreground text-sm mb-6">{service.description}</p>
              <Button variant="hero" className="w-full rounded-xl h-11" onClick={() => setStep("time")}>
                Select Date & Time
              </Button>
            </div>
          )}

          {step === "time" && (
            <div>
              <h2 className="text-2xl font-bold font-display text-foreground mb-6">Choose Date & Time</h2>
              <div className="space-y-4 mb-6">
                <div>
                  <Label className="text-foreground">Date</Label>
                  <div className="relative mt-1">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      className="pl-10 bg-secondary/50 border-border"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-foreground">Time Slot</Label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {timeSlots.map((slot) => (
                      <motion.button
                        key={slot}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setTime(slot)}
                        className={`py-2 rounded-lg text-sm font-medium transition-all ${
                          time === slot
                            ? "gradient-primary text-primary-foreground"
                            : "bg-secondary/50 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {slot}
                      </motion.button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="text-foreground">Notes (optional)</Label>
                  <Input
                    placeholder="Any special instructions..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="bg-secondary/50 border-border mt-1"
                  />
                </div>
                <ServiceLocationPicker value={serviceLocation} onChange={setServiceLocation} />
              </div>
              <div className="flex gap-3">
                <Button variant="glass" className="flex-1 rounded-xl" onClick={() => setStep("details")}>Back</Button>
                <Button variant="hero" className="flex-1 rounded-xl" disabled={!date || !time || !serviceLocation} onClick={() => setStep("confirm")}>
                  Review Booking
                </Button>
              </div>
            </div>
          )}

          {step === "confirm" && (
            <div>
              <h2 className="text-2xl font-bold font-display text-foreground mb-6">Confirm Booking</h2>
              <div className="space-y-3 mb-6 p-4 rounded-xl bg-secondary/30">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Service</span>
                  <span className="text-foreground font-medium">{service.title}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Provider</span>
                  <span className="text-foreground">{(service.profiles as any)?.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Date</span>
                  <span className="text-foreground">{date}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Time</span>
                  <span className="text-foreground">{time}</span>
                </div>
                <div className="flex justify-between text-sm gap-4">
                  <span className="text-muted-foreground">Service Location</span>
                  <span className="text-foreground text-right">{serviceLocation?.address || "Not selected"}</span>
                </div>
                <div className="border-t border-border pt-3 flex justify-between">
                  <span className="text-foreground font-semibold">Total</span>
                  <span className="text-accent font-display font-bold text-xl">₹{service.price}</span>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="glass" className="flex-1 rounded-xl" onClick={() => setStep("time")}>Back</Button>
                <Button variant="hero" className="flex-1 rounded-xl" disabled={loading} onClick={handleBook}>
                  {loading ? "Booking..." : "Confirm Booking"}
                </Button>
              </div>
            </div>
          )}

          {step === "success" && (
            <div className="text-center py-6">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
                <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
              </motion.div>
              <h2 className="text-2xl font-bold font-display text-foreground mb-2">Booking Confirmed!</h2>
              <p className="text-muted-foreground mb-6">Your booking has been placed. The provider will confirm shortly.</p>
              <div className="flex gap-3">
                <Button variant="glass" className="flex-1 rounded-xl" onClick={onClose}>Close</Button>
                <Button variant="hero" className="flex-1 rounded-xl" onClick={() => navigate("/dashboard/seeker")}>
                  View Orders
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default BookingModal;
