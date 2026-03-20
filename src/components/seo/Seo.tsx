import { Helmet } from "react-helmet-async";

type SeoProps = {
  title: string;
  description?: string;
  canonicalPath?: string;
  keywords?: string[];
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
};

const getSiteUrl = () => {
  const envUrl = import.meta.env.VITE_SITE_URL as string | undefined;
  if (envUrl && envUrl.trim()) return envUrl.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "https://yourdomain.com";
};

const Seo = ({ title, description, canonicalPath, keywords, noindex, jsonLd }: SeoProps) => {
  const siteUrl = getSiteUrl();
  const canonical = canonicalPath ? `${siteUrl}${canonicalPath.startsWith("/") ? canonicalPath : `/${canonicalPath}`}` : siteUrl;

  return (
    <Helmet>
      <title>{title}</title>
      {description ? <meta name="description" content={description} /> : null}
      {keywords && keywords.length > 0 ? <meta name="keywords" content={keywords.join(", ")} /> : null}
      <link rel="canonical" href={canonical} />
      {noindex ? <meta name="robots" content="noindex, nofollow" /> : <meta name="robots" content="index, follow" />}
      {jsonLd ? <script type="application/ld+json">{JSON.stringify(jsonLd)}</script> : null}
    </Helmet>
  );
};

export default Seo;
