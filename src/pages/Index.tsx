import Navbar from "@/components/layout/Navbar";
import Hero from "@/components/landing/Hero";
import Stats from "@/components/landing/Stats";
import Categories from "@/components/landing/Categories";
import Features from "@/components/landing/Features";
import FAQ from "@/components/landing/FAQ";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/layout/Footer";
import FloatingSupportChat from "@/components/support/FloatingSupportChat";
import { useAuth } from "@/hooks/useAuth";
import Seo from "@/components/seo/Seo";

const Index = () => {
  const { user, loading } = useAuth();

  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "SSMP - Super Service Marketplace",
    image: "https://yourdomain.com/logo.png",
    url: "https://yourdomain.com",
    telephone: "+91-7070422574",
    address: {
      "@type": "PostalAddress",
      addressLocality: "West Champaran",
      addressRegion: "Bihar",
      postalCode: "845459",
      addressCountry: "IN",
    },
    description: "Book electrician, plumber, AC repair and home services near you.",
    areaServed: "India",
    serviceType: ["Electrician", "Plumber", "AC Repair", "Home Cleaning", "Carpenter"],
  };

  return (
    <div className="min-h-screen">
      <Seo
        title="Book Trusted Home Services Near You | Electrician, Plumber, AC Repair"
        description="Find verified electricians, plumbers, AC repair and more services near you. Book instantly with trusted professionals in your city."
        canonicalPath="/"
        keywords={[
          "home services near me",
          "service marketplace",
          "electrician plumber booking",
          "local service provider",
        ]}
        jsonLd={localBusinessSchema}
      />
      <Navbar />
      <Hero />
      <Stats />
      <Categories />
      <Features />
      <FAQ />
      <CTA />
      <Footer />
      {!loading && user && <FloatingSupportChat />}
    </div>
  );
};

export default Index;
