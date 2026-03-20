import Navbar from "@/components/layout/Navbar";

const TermsOfService = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container px-4 pt-24 pb-12 max-w-4xl">
        <h1 className="text-3xl font-bold font-display text-foreground">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: March 20, 2026</p>

        <div className="mt-8 space-y-6 text-sm leading-7 text-foreground/90">
          <section>
            <h2 className="text-xl font-semibold text-foreground">1. Platform Use</h2>
            <p className="mt-2">
              By using this platform, you agree to follow applicable laws and platform rules for respectful and safe service interactions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">2. Booking and Payments</h2>
            <p className="mt-2">
              Booking details and payment status are tracked in the app. Users must avoid off-platform payment behavior when not allowed by policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">3. User Responsibilities</h2>
            <p className="mt-2">
              Seekers and providers are responsible for correct information, timely communication, and compliance with agreed booking terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">4. Prohibited Conduct</h2>
            <p className="mt-2">
              Fraud, abuse, harassment, unsafe behavior, and account misuse may lead to suspension or permanent access restrictions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">5. Limitation of Liability</h2>
            <p className="mt-2">
              The platform facilitates service discovery and booking. Service outcomes may vary based on provider performance and local conditions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">6. Changes to Terms</h2>
            <p className="mt-2">
              We may update these terms from time to time. Continued use of the platform after changes means you accept the updated terms.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
};

export default TermsOfService;
