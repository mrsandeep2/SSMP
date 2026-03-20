import { motion } from "framer-motion";
import { HelpCircle } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

type FAQItem = {
  id: string;
  question: string;
  answer: string;
};

const englishFaqs: FAQItem[] = [
  {
    id: "en-1",
    question: "How do I book a service?",
    answer: "Open Services, choose the service you need, pick date and time, then tap Book.",
  },
  {
    id: "en-2",
    question: "When do I pay?",
    answer: "You pay only after provider reaches your location and starts work.",
  },
  {
    id: "en-3",
    question: "Can I cancel my booking?",
    answer: "Yes. You can cancel before work starts from your dashboard.",
  },
  {
    id: "en-4",
    question: "How do I track my order?",
    answer: "Go to your dashboard and open Recent Orders. You can see live status there.",
  },
  {
    id: "en-5",
    question: "What if I have a problem with service?",
    answer: "Tap Raise Dispute or go to Support. Share your Booking ID for quick help.",
  },
  {
    id: "en-6",
    question: "How will I get updates?",
    answer: "You will get app and mobile notifications for accepted, arrival, start, and completion.",
  },
];

const hindiFaqs: FAQItem[] = [
  {
    id: "hi-1",
    question: "मैं सेवा कैसे बुक करूं?",
    answer: "Services खोलें, अपनी सेवा चुनें, तारीख और समय चुनें, फिर Book दबाएं।",
  },
  {
    id: "hi-2",
    question: "पेमेंट कब करना है?",
    answer: "पेमेंट तब करें जब प्रोवाइडर आपके स्थान पर पहुंच जाए और काम शुरू करे।",
  },
  {
    id: "hi-3",
    question: "क्या मैं बुकिंग कैंसल कर सकता/सकती हूं?",
    answer: "हाँ। काम शुरू होने से पहले आप डैशबोर्ड से बुकिंग कैंसल कर सकते हैं।",
  },
  {
    id: "hi-4",
    question: "मैं अपना ऑर्डर कैसे ट्रैक करूं?",
    answer: "डैशबोर्ड में Recent Orders खोलें। वहां आपको लाइव स्टेटस दिखेगा।",
  },
  {
    id: "hi-5",
    question: "सेवा में समस्या हो तो क्या करें?",
    answer: "Raise Dispute दबाएं या Support में जाएं। जल्दी मदद के लिए Booking ID लिखें।",
  },
  {
    id: "hi-6",
    question: "मुझे अपडेट कैसे मिलेंगे?",
    answer: "Accepted, arrival, start और completion पर आपको ऐप और मोबाइल नोटिफिकेशन मिलेंगे।",
  },
];

const FAQBlock = ({ title, items }: { title: string; items: FAQItem[] }) => (
  <div className="glass rounded-2xl p-6 md:p-8">
    <h3 className="text-xl md:text-2xl font-display font-semibold text-foreground mb-4">{title}</h3>
    <Accordion type="single" collapsible className="w-full">
      {items.map((item) => (
        <AccordionItem key={item.id} value={item.id} className="border-border/60">
          <AccordionTrigger className="text-left text-foreground hover:no-underline">
            {item.question}
          </AccordionTrigger>
          <AccordionContent className="text-muted-foreground leading-relaxed">
            {item.answer}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  </div>
);

const FAQ = () => {
  return (
    <section className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-accent/5 to-transparent" />
      <div className="container px-6 sm:px-8 lg:px-10 relative max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-2 mb-5">
            <HelpCircle className="w-4 h-4 text-accent" />
            <span className="text-sm text-muted-foreground">Simple Help</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-bold font-display mb-4">
            Frequently Asked <span className="gradient-text">Questions</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Quick answers in simple language.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-6 md:gap-8">
          <FAQBlock title="English FAQs (6)" items={englishFaqs} />
          <FAQBlock title="हिंदी FAQs (6)" items={hindiFaqs} />
        </div>
      </div>
    </section>
  );
};

export default FAQ;
