import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Seo from "@/components/seo/Seo";

const Contact = () => {
  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Contact Us | Customer Support and Help"
        description="Reach our support team for booking help, complaint assistance, and account related issues."
        canonicalPath="/contact"
      />
      <Navbar />
      <main className="container px-4 pt-24 pb-12 max-w-4xl">
        <h1 className="text-3xl font-bold font-display text-foreground">Contact Us</h1>
        <p className="mt-4 text-muted-foreground">
          For faster support, use the in-app Support Center. For urgent platform issues, email support@yourdomain.com.
        </p>
      </main>
      <Footer />
    </div>
  );
};

export default Contact;
