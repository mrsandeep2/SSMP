const fs = require("fs");
const path = require("path");

const siteUrl = (process.env.SITE_URL || process.env.VITE_SITE_URL || "https://yourdomain.com").replace(/\/$/, "");

const categorySlugs = [
  "electrician",
  "plumber",
  "ac-repair",
  "carpenter",
  "cleaning",
  "painter",
  "beauty-service",
  "appliance-repair",
  "cctv-installation",
  "home-tutor",
];

const cities = ["patna", "delhi", "noida", "bihar"];

const pages = [
  "/",
  "/services",
  "/blog",
  "/faq",
  "/about",
  "/contact",
  "/privacy-policy",
  "/terms-of-service",
  ...categorySlugs.map((slug) => `/services/${slug}`),
  ...cities.flatMap((city) => [
    `/city/${city}/electrician`,
    `/city/${city}/plumber`,
    `/city/${city}/ac-repair`,
  ]),
];

const uniquePages = Array.from(new Set(pages));

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${uniquePages
  .map((p) => `  <url><loc>${siteUrl}${p}</loc></url>`)
  .join("\n")}\n</urlset>\n`;

const outFile = path.join(__dirname, "..", "public", "sitemap.xml");
fs.writeFileSync(outFile, xml);
console.log(`Sitemap generated: ${outFile}`);
