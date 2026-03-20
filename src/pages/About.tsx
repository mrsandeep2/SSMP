import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Seo from "@/components/seo/Seo";

const About = () => {
  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="About Us | Trusted Home Service Marketplace"
        description="Learn about our mission to provide trusted and verified home services across cities."
        canonicalPath="/about"
      />
      <Navbar />
      <main className="container px-4 pt-24 pb-12 max-w-4xl">
        <h1 className="text-3xl font-bold font-display text-foreground">About Us</h1>
        <p className="mt-4 text-muted-foreground">
          SSMP helps users book verified home service professionals quickly and safely across multiple cities.
        </p>
      </main>
      <Footer />
    </div>
  );
};

export default About;
