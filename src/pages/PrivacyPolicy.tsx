import Navbar from "@/components/layout/Navbar";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container px-4 pt-24 pb-12 max-w-4xl">
        <h1 className="text-3xl font-bold font-display text-foreground">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: March 20, 2026</p>

        <div className="mt-8 space-y-6 text-sm leading-7 text-foreground/90">
          <section>
            <h2 className="text-xl font-semibold text-foreground">1. Information We Collect</h2>
            <p className="mt-2">
              We collect account details, booking details, payment status, support messages, and technical logs needed to run the platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">2. How We Use Data</h2>
            <p className="mt-2">
              We use data to provide service booking, send updates, improve platform quality, prevent fraud, and resolve support issues.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">3. Data Sharing</h2>
            <p className="mt-2">
              We share limited required information between seeker and provider for booking fulfillment. We do not sell personal data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">4. Data Security</h2>
            <p className="mt-2">
              We use secure infrastructure and access controls. However, no system is 100% risk-free, so users should protect account credentials.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">5. Your Rights</h2>
            <p className="mt-2">
              You can request profile updates, correction of inaccurate details, or account deletion through support.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">6. Contact</h2>
            <p className="mt-2">
              For privacy-related concerns, please use the Support Center in your account.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
};

export default PrivacyPolicy;
