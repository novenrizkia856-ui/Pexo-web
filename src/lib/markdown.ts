/**
 * A small Markdown renderer, scoped to exactly what /docs uses.
 *
 * The docs folder is the single source of truth: the same `.md` files that get
 * zipped for GitBook are what this site renders. Rather than pull in a full
 * CommonMark implementation for nine authored files, this handles the subset
 * they actually contain: front matter, ATX headings, paragraphs, fenced code,
 * GFM tables, lists, blockquotes, rules, and inline emphasis, code and links.
 *
 * Because the input is authored in this repository rather than supplied by a
 * user, the escaping here is a correctness measure, not a trust boundary. It
 * still escapes everything before emitting, so a stray angle bracket in prose
 * renders as text instead of silently becoming markup.
 */

export type Heading = { id: string; text: string; level: 2 | 3 };

export type ParsedDoc = {
  /** `title` from the front matter, falling back to the first H1. */
  title: string;
  description: string;
  html: string;
  /** H2 and H3, in document order, for the "on this page" rail. */
  headings: Heading[];
};

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ESCAPES[c]);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/**
 * Inline pass: code first, so that emphasis and link syntax inside backticks is
 * left alone. Spans already emitted are parked in placeholders and restored at
 * the end, which is what keeps a `**` inside a code span from being read as
 * bold.
 */
function inline(src: string): string {
  const parked: string[] = [];
  const park = (html: string) => {
    parked.push(html);
    return `\u0000${parked.length - 1}\u0000`;
  };

  let out = src.replace(/`([^`]+)`/g, (_m, code: string) =>
    park(`<code>${escapeHtml(code)}</code>`),
  );

  out = escapeHtml(out);

  // Links. Internal `.md` targets become router paths; anything else opens out.
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, href: string) => {
    const internal = href.endsWith(".md");
    const to = internal ? `/docs/${href.replace(/\.md$/, "").replace(/^README$/, "")}` : href;
    const attrs = internal
      ? `href="${to.replace(/\/$/, "") || "/docs"}" data-internal="true"`
      : `href="${href}" target="_blank" rel="noreferrer"`;
    return `<a ${attrs}>${label}</a>`;
  });

  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");

  return out.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => parked[Number(i)]);
}

/** Splits a GFM table row, tolerating the optional leading and trailing pipes. */
function cells(row: string): string[] {
  return row
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((c) => c.trim());
}

const isDivider = (line: string) => /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(line);

export function parseMarkdown(source: string): ParsedDoc {
  let body = source.replace(/\r\n/g, "\n");
  let title = "";
  let description = "";

  // Front matter. Only the two keys the docs actually set are read; GitBook
  // consumes the same block, which is why it stays in the files.
  const fm = body.match(/^---\n([\s\S]*?)\n---\n?/);
  if (fm) {
    for (const line of fm[1].split("\n")) {
      const kv = line.match(/^(\w+):\s*(.*)$/);
      if (!kv) continue;
      const value = kv[2].trim().replace(/^["']|["']$/g, "");
      if (kv[1] === "title") title = value;
      if (kv[1] === "description") description = value;
    }
    body = body.slice(fm[0].length);
  }

  const lines = body.split("\n");
  const html: string[] = [];
  const headings: Heading[] = [];
  let i = 0;

  /** Collects a run of paragraph lines and emits one <p>. */
  const flushParagraph = (buf: string[]) => {
    if (buf.length === 0) return;
    html.push(`<p>${inline(buf.join(" ").trim())}</p>`);
    buf.length = 0;
  };

  const paragraph: string[] = [];

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      flushParagraph(paragraph);
      i++;
      continue;
    }

    // Fenced code. Never rendered as anything but literal text.
    if (/^```/.test(line)) {
      flushParagraph(paragraph);
      const lang = line.slice(3).trim();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      const cls = lang ? ` class="language-${escapeHtml(lang)}"` : "";
      html.push(`<pre><code${cls}>${escapeHtml(buf.join("\n"))}</code></pre>`);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph(paragraph);
      const level = heading[1].length;
      const text = heading[2].trim();
      const id = slugify(text);
      if (level === 1 && !title) title = text;
      if (level === 2 || level === 3) headings.push({ id, text: text.replace(/`/g, ""), level });
      // H1 is rendered by the route from the front matter, so it is dropped here
      // to avoid printing the page title twice.
      if (level > 1) html.push(`<h${level} id="${id}">${inline(text)}</h${level}>`);
      i++;
      continue;
    }

    if (/^(---|\*\*\*|___)\s*$/.test(line)) {
      flushParagraph(paragraph);
      html.push("<hr />");
      i++;
      continue;
    }

    // Table: a pipe row followed by a divider row.
    if (line.includes("|") && i + 1 < lines.length && isDivider(lines[i + 1])) {
      flushParagraph(paragraph);
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
        rows.push(cells(lines[i]));
        i++;
      }
      const headHtml = head.some((c) => c !== "")
        ? `<thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead>`
        : "";
      const bodyHtml = rows
        .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
        .join("");
      html.push(`<div class="pxo-table-wrap"><table>${headHtml}<tbody>${bodyHtml}</tbody></table></div>`);
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      flushParagraph(paragraph);
      const buf: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      html.push(`<blockquote><p>${inline(buf.join(" ").trim())}</p></blockquote>`);
      continue;
    }

    const bullet = /^\s*[-*]\s+/;
    const numbered = /^\s*\d+\.\s+/;
    if (bullet.test(line) || numbered.test(line)) {
      flushParagraph(paragraph);
      const ordered = numbered.test(line);
      const marker = ordered ? numbered : bullet;
      const items: string[] = [];
      while (i < lines.length && (marker.test(lines[i]) || /^\s{2,}\S/.test(lines[i]))) {
        if (marker.test(lines[i])) {
          items.push(lines[i].replace(marker, ""));
        } else {
          // Continuation of the previous item.
          items[items.length - 1] += ` ${lines[i].trim()}`;
        }
        i++;
      }
      const tag = ordered ? "ol" : "ul";
      html.push(`<${tag}>${items.map((t) => `<li>${inline(t)}</li>`).join("")}</${tag}>`);
      continue;
    }

    paragraph.push(line.trim());
    i++;
  }

  flushParagraph(paragraph);

  return { title, description, html: html.join("\n"), headings };
}
