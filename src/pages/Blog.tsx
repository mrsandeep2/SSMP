import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Seo from "@/components/seo/Seo";

const posts = [
  "How to choose a good electrician",
  "Common plumbing problems at home",
  "AC not cooling reasons",
  "Home maintenance checklist",
  "Ghar ke liye sahi electrician kaise chune",
  "Plumbing problems ka solution kya hai",
  "Plumber near me ka best option kaise choose karein",
  "AC cooling problem ka simple solution kya hai",
];

const Blog = () => {
  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Home Service Blog | Tips, Guides and Solutions"
        description="Read practical guides for electrician, plumber, AC repair and home maintenance in English, Hindi and Hinglish."
        canonicalPath="/blog"
      />
      <Navbar />
      <main className="container px-4 pt-24 pb-12">
        <h1 className="text-3xl font-bold font-display text-foreground">Blog</h1>
        <p className="mt-2 text-muted-foreground">Useful home service guides for real users.</p>

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {posts.map((title) => (
            <article key={title} className="rounded-xl border border-border/60 bg-secondary/20 p-4">
              <h2 className="text-base font-semibold text-foreground">{title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">Detailed article page can be added next for this topic.</p>
            </article>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Blog;
