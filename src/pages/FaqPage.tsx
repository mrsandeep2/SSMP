import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import FAQ from "@/components/landing/FAQ";
import Seo from "@/components/seo/Seo";

const FaqPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Frequently Asked Questions | Service Booking Guide"
        description="Get answers to common questions about booking home services, pricing, and service process."
        canonicalPath="/faq"
      />
      <Navbar />
      <main className="pt-16">
        <FAQ />
      </main>
      <Footer />
    </div>
  );
};

export default FaqPage;
