import { 
  Home, Wrench, Monitor, BookOpen, Truck, Heart, 
  Briefcase, Camera, Cpu, Palette, Shield, Zap,
  type LucideIcon 
} from "lucide-react";

export interface ServiceCategory {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
}

export const serviceCategories: ServiceCategory[] = [
  { id: "home", name: "Home Services", description: "Cleaning, plumbing, electrical & more", icon: Home },
  { id: "tech", name: "Technical Services", description: "IT support, networking, repairs", icon: Monitor },
  { id: "freelance", name: "Freelance Digital", description: "Design, development, writing", icon: Palette },
  { id: "repair", name: "Repair & Maintenance", description: "Appliance, auto, furniture repair", icon: Wrench },
  { id: "education", name: "Education & Tutoring", description: "Academic, language, skill training", icon: BookOpen },
  { id: "delivery", name: "Delivery & Logistics", description: "Courier, moving, transportation", icon: Truck },
  { id: "health", name: "Health & Personal Care", description: "Fitness, wellness, beauty", icon: Heart },
  { id: "business", name: "Business & Consulting", description: "Strategy, legal, finance", icon: Briefcase },
  { id: "events", name: "Event & Media", description: "Photography, planning, DJ", icon: Camera },
  { id: "ai", name: "AI & Automation", description: "AI solutions, chatbots, automation", icon: Cpu },
  { id: "security", name: "Security Services", description: "Surveillance, guards, cyber security", icon: Shield },
  { id: "express", name: "Express Services", description: "Same-day urgent services", icon: Zap },
];
