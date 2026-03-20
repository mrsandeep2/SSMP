import { Link, useParams } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Seo from "@/components/seo/Seo";
import { Button } from "@/components/ui/button";

const categoryMap: Record<string, { title: string; keyword: string; area: string }> = {
  electrician: { title: "Electrician", keyword: "electrician near me", area: "India" },
  plumber: { title: "Plumber", keyword: "plumber near me", area: "India" },
  "ac-repair": { title: "AC Repair", keyword: "ac repair near me", area: "India" },
  carpenter: { title: "Carpenter", keyword: "carpenter near me", area: "India" },
  cleaning: { title: "Cleaning", keyword: "home cleaning service", area: "India" },
  painter: { title: "Painter", keyword: "house painter near me", area: "India" },
  "beauty-service": { title: "Beauty Service", keyword: "beauty service at home", area: "India" },
  "appliance-repair": { title: "Appliance Repair", keyword: "appliance repair near me", area: "India" },
  "cctv-installation": { title: "CCTV Installation", keyword: "cctv installation service", area: "India" },
  "home-tutor": { title: "Home Tutor", keyword: "home tutor near me", area: "India" },
};

const ServiceCategoryPage = () => {
  const { categorySlug = "electrician" } = useParams();
  const info = categoryMap[categorySlug] || categoryMap.electrician;

  const schema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `${info.title} Service`,
    provider: { "@type": "LocalBusiness", name: "SSMP" },
    areaServed: info.area,
    description: `Book trusted ${info.title.toLowerCase()} professionals for home service near you.`,
  };

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title={`${info.title} Near You | Book Verified ${info.title}s Online`}
        description={`Book certified ${info.title.toLowerCase()}s for home service near you. Fast and reliable.`}
        canonicalPath={`/services/${categorySlug}`}
        keywords={[info.keyword, `home ${info.title.toLowerCase()} service`, `emergency ${info.title.toLowerCase()}`]}
        jsonLd={schema}
      />
      <Navbar />
      <main className="container px-4 pt-24 pb-12 max-w-5xl">
        <h1 className="text-3xl font-bold font-display text-foreground">{info.title} Service</h1>
        <p className="mt-2 text-muted-foreground">Book verified professionals quickly from SSMP.</p>

        <section className="mt-8 rounded-xl border border-border/60 bg-secondary/20 p-4">
          <h2 className="text-xl font-semibold text-foreground">Services Offered</h2>
          <p className="mt-2 text-sm text-muted-foreground">Installation, repair, maintenance, emergency support.</p>
        </section>

        <section className="mt-4 rounded-xl border border-border/60 bg-secondary/20 p-4">
          <h2 className="text-xl font-semibold text-foreground">Pricing</h2>
          <p className="mt-2 text-sm text-muted-foreground">Starting from affordable rates based on job scope.</p>
        </section>

        <section className="mt-4 rounded-xl border border-border/60 bg-secondary/20 p-4">
          <h2 className="text-xl font-semibold text-foreground">Why Choose Us</h2>
          <p className="mt-2 text-sm text-muted-foreground">Verified providers, transparent updates, and responsive support.</p>
        </section>

        <section className="mt-4 rounded-xl border border-border/60 bg-secondary/20 p-4">
          <h2 className="text-xl font-semibold text-foreground">Hindi + Hinglish Section</h2>
          <p className="mt-2 text-sm text-muted-foreground">Aapke aas-paas verified {info.title.toLowerCase()} service book karein.</p>
          <p className="mt-2 text-sm text-muted-foreground">FAQ: "{info.title} ka kaam kitne time me complete hota hai?"</p>
        </section>

        <div className="mt-6 flex gap-3">
          <Link to={`/services?q=${encodeURIComponent(info.title)}`}><Button variant="hero">Book {info.title}</Button></Link>
          <Link to="/faq"><Button variant="outline">View FAQs</Button></Link>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ServiceCategoryPage;
