import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

/**
 * Fills the Open Graph image tags at build time.
 *
 * `og:image` has to be an absolute URL, because crawlers do not resolve
 * relative paths, so it can only be written once the deployed origin is known.
 * Set `VITE_SITE_URL` to that origin.
 *
 * Without it the tags are omitted and the Twitter card falls back to `summary`.
 * That is deliberate: a text card is honest, whereas `summary_large_image` with
 * no image renders as an empty box wherever the link is shared.
 */
function ogImage() {
  const site = process.env.VITE_SITE_URL?.replace(/\/$/, "");

  return {
    name: "pexo-og-image",
    transformIndexHtml(html: string) {
      const tags = site
        ? [
            `<meta property="og:image" content="${site}/og.png" />`,
            `<meta property="og:image:width" content="1200" />`,
            `<meta property="og:image:height" content="630" />`,
            `<meta property="og:image:alt" content="Pexo: set your floor, walk away." />`,
            `<meta property="og:url" content="${site}/" />`,
            `<meta name="twitter:image" content="${site}/og.png" />`,
          ].join("\n    ")
        : "";

      return html
        .replace("%OG_IMAGE%", tags)
        .replace("%TWITTER_CARD%", site ? "summary_large_image" : "summary");
    },
  };
}

// Static-only build. No SSR, no server runtime, no API routes.
// Output in dist/ is deployable to Vercel as a plain static site.
export default defineConfig({
  plugins: [react(), tailwindcss(), ogImage()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
