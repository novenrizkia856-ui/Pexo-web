import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { DOC_GROUPS, DOC_PAGES, findDoc } from "@/content/docs";
import { SiteHeader } from "@/components/site-header";

/**
 * The documentation shell.
 *
 * Three columns, in the shape most protocol documentation settles on: contents
 * on the left, the page in the middle at a readable measure, and the current
 * page's own headings on the right. Both rails collapse away below large
 * screens, where the contents become a disclosure above the article.
 */

export function DocsRoute() {
  const { slug } = useParams();
  const { pathname, hash } = useLocation();
  const navigate = useNavigate();
  const article = useRef<HTMLDivElement>(null);
  const [activeHeading, setActiveHeading] = useState<string>("");
  const [navOpen, setNavOpen] = useState(false);

  const page = findDoc(slug);
  const index = useMemo(
    () => DOC_PAGES.findIndex((p) => p.slug === (slug ?? "")),
    [slug],
  );

  // A new page should start at the top, but a link into a specific heading
  // should not be overridden by that.
  useEffect(() => {
    setNavOpen(false);
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView();
      return;
    }
    window.scrollTo({ top: 0 });
  }, [pathname, hash]);

  /**
   * Links inside the rendered markdown are plain anchors, so internal ones are
   * intercepted here and handed to the router. Doing it with one delegated
   * listener rather than rewriting the HTML into components keeps the markdown
   * renderer free of any React dependency.
   */
  useEffect(() => {
    const root = article.current;
    if (!root) return;
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement)?.closest?.("a[data-internal]");
      if (!anchor) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
      event.preventDefault();
      navigate(anchor.getAttribute("href") ?? "/docs");
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [navigate, pathname]);

  /**
   * Highlights the heading currently being read.
   *
   * The top band of the viewport is used as the trigger line rather than the
   * middle, so the rail marks the section you have arrived at instead of the
   * one you are halfway through.
   */
  useEffect(() => {
    const root = article.current;
    if (!root || !page) return;
    const targets = Array.from(root.querySelectorAll<HTMLElement>("h2[id], h3[id]"));
    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) setActiveHeading(visible[0].target.id);
      },
      { rootMargin: "-88px 0px -70% 0px", threshold: 0 },
    );

    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, [page, pathname]);

  if (!page) return <Navigate to="/docs" replace />;

  const previous = index > 0 ? DOC_PAGES[index - 1] : null;
  const next = index >= 0 && index < DOC_PAGES.length - 1 ? DOC_PAGES[index + 1] : null;

  return (
    <>
      <SiteHeader />

      <div className="pxo-docs">
        <aside className={`pxo-docs-nav ${navOpen ? "is-open" : ""}`} aria-label="Documentation">
          <button
            type="button"
            className="pxo-docs-nav-toggle"
            aria-expanded={navOpen}
            onClick={() => setNavOpen((v) => !v)}
          >
            <span>Documentation</span>
            <span aria-hidden="true">{navOpen ? "Close" : "Menu"}</span>
          </button>

          <div className="pxo-docs-nav-body">
            {DOC_GROUPS.map((group, gi) => (
              <div key={group.label || `group-${gi}`} className="pxo-docs-group">
                {group.label ? (
                  <p className="pxo-docs-group-label">{group.label}</p>
                ) : null}
                <ul>
                  {group.pages.map((p) => (
                    <li key={p.path}>
                      <Link
                        to={p.path}
                        aria-current={p.path === pathname ? "page" : undefined}
                        className={p.path === pathname ? "is-current" : ""}
                      >
                        {p.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </aside>

        <main className="pxo-docs-main">
          <article>
            <header className="pxo-docs-head">
              <h1>{page.title}</h1>
              {page.description ? <p className="pxo-lead">{page.description}</p> : null}
            </header>

            <div
              ref={article}
              className="pxo-prose"
              // The markdown is authored in this repository and rendered at
              // build time. It is never user supplied.
              dangerouslySetInnerHTML={{ __html: page.html }}
            />
          </article>

          <nav className="pxo-docs-pager" aria-label="Page navigation">
            {previous ? (
              <Link to={previous.path} className="pxo-docs-pager-link">
                <span>Previous</span>
                <strong>{previous.title}</strong>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link to={next.path} className="pxo-docs-pager-link is-next">
                <span>Next</span>
                <strong>{next.title}</strong>
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </main>

        <aside className="pxo-docs-toc" aria-label="On this page">
          {page.headings.length > 0 ? (
            <>
              <p className="pxo-docs-group-label">On this page</p>
              <ul>
                {page.headings.map((h) => (
                  <li key={h.id} data-level={h.level}>
                    <a
                      href={`#${h.id}`}
                      className={activeHeading === h.id ? "is-current" : ""}
                    >
                      {h.text}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </aside>
      </div>
    </>
  );
}
