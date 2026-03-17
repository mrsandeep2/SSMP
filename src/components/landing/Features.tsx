import { motion } from "framer-motion";
import { Shield, Zap, MessageSquare, CreditCard, Star, Clock } from "lucide-react";

const features = [
  { icon: Zap, title: "Instant Booking", description: "Find and book services in under 60 seconds with our streamlined flow.", color: "bg-warning/15 text-warning" },
  { icon: Shield, title: "Verified Providers", description: "Every provider is verified with background checks and skill assessments.", color: "bg-success/15 text-success" },
  { icon: MessageSquare, title: "Real-Time Chat", description: "Communicate directly with your provider through built-in messaging.", color: "bg-accent/15 text-accent" },
  { icon: CreditCard, title: "Secure Payments", description: "Escrow-style payments protect both seekers and providers.", color: "bg-primary/15 text-primary" },
  { icon: Star, title: "Trust System", description: "Gamified levels from Bronze to Elite based on performance metrics.", color: "bg-warning/15 text-warning" },
  { icon: Clock, title: "Live Tracking", description: "Track your service order status in real-time from booking to completion.", color: "bg-info/15 text-info" },
];

const Features = () => {
  return (
    <section className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/3 to-transparent" />
      <div className="container px-6 sm:px-8 lg:px-10 relative max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl font-bold font-display mb-4">
            Why Choose <span className="gradient-text">Super Service</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Built for the AI era with cutting-edge features that make finding services effortless
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {features.map((feat, i) => {
            const Icon = feat.icon;
            return (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass glass-hover rounded-2xl p-8 md:p-10 flex flex-col items-center text-center group transition-all"
              >
                <div className={`w-14 h-14 rounded-2xl ${feat.color} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform shrink-0`}>
                  <Icon className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-display font-semibold text-foreground mb-3">{feat.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feat.description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Features;
