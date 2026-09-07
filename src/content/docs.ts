import { parseMarkdown, type ParsedDoc } from "@/lib/markdown";

/**
 * The documentation index.
 *
 * The `.md` files in /docs at the repository root are the single source of
 * truth. They are what gets zipped for GitBook and they are what this site
 * renders, so the two can never drift apart. Vite inlines them at build time,
 * which keeps the whole thing static.
 */

const RAW = import.meta.glob("../../docs/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export type DocPage = ParsedDoc & {
  /** Route segment. The introduction has an empty slug and lives at /docs. */
  slug: string;
  path: string;
};

export type DocGroup = { label: string; pages: DocPage[] };

/**
 * Order and grouping, mirroring docs/SUMMARY.md.
 *
 * Kept as an explicit list rather than derived from the glob so the reading
 * order is a deliberate decision, and so a file added without being placed
 * simply does not appear rather than landing somewhere arbitrary.
 */
const OUTLINE: { label: string; files: string[] }[] = [
  { label: "", files: ["README"] },
  {
    label: "Understanding Pexo",
    files: ["how-it-works", "the-floor-guarantee", "two-prices", "fees", "keepers"],
  },
  { label: "Reference", files: ["contract-reference", "deployment"] },
  { label: "Before you use it", files: ["security", "risks"] },
];

function load(name: string): DocPage {
  const source = RAW[`../../docs/${name}.md`];
  if (source === undefined) {
    throw new Error(`docs/${name}.md is listed in the outline but does not exist`);
  }
  const slug = name === "README" ? "" : name;
  return { ...parseMarkdown(source), slug, path: slug ? `/docs/${slug}` : "/docs" };
}

export const DOC_GROUPS: DocGroup[] = OUTLINE.map((g) => ({
  label: g.label,
  pages: g.files.map(load),
}));

/** Flat reading order, which is what previous and next navigate along. */
export const DOC_PAGES: DocPage[] = DOC_GROUPS.flatMap((g) => g.pages);

export function findDoc(slug: string | undefined): DocPage | undefined {
  return DOC_PAGES.find((p) => p.slug === (slug ?? ""));
}
