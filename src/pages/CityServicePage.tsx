import { Link, useParams } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Seo from "@/components/seo/Seo";
import { Button } from "@/components/ui/button";

const CityServicePage = () => {
  const { city = "patna", categorySlug = "electrician" } = useParams();
  const cityLabel = city.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
  const categoryLabel = categorySlug.replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title={`${categoryLabel} in ${cityLabel} | Book Local ${categoryLabel} Service`}
        description={`Looking for ${categoryLabel.toLowerCase()} in ${cityLabel}? Book trusted and verified professionals at affordable price.`}
        canonicalPath={`/city/${city}/${categorySlug}`}
        keywords={[
          `${categoryLabel.toLowerCase()} in ${cityLabel}`,
          `${cityLabel} ${categoryLabel.toLowerCase()} service`,
          `local ${categoryLabel.toLowerCase()} near me`,
        ]}
      />
      <Navbar />
      <main className="container px-4 pt-24 pb-12 max-w-5xl">
        <h1 className="text-3xl font-bold font-display text-foreground">{categoryLabel} in {cityLabel}</h1>
        <p className="mt-2 text-muted-foreground">Find local verified providers and book quickly.</p>
        <div className="mt-6">
          <Link to={`/services?q=${encodeURIComponent(`${categoryLabel} ${cityLabel}`)}`}>
            <Button variant="hero">Find {categoryLabel} in {cityLabel}</Button>
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default CityServicePage;
