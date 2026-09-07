import { Link, useLocation } from "react-router-dom";
import { Wordmark } from "@/components/brand";
import { Button } from "@/components/ui";

export function SiteHeader() {
  const { pathname } = useLocation();
  const onApp = pathname.startsWith("/app");
  const onDocs = pathname.startsWith("/docs");

  return (
    <header className="pxo-header">
      <Link to="/" className="pxo-brand" aria-label="Pexo home">
        <Wordmark />
      </Link>

      <div className="flex items-center gap-1.5">
        <Link
          to="/docs"
          aria-current={onDocs ? "page" : undefined}
          className={`pxo-button pxo-button-small pxo-button-ghost ${
            onDocs ? "text-ink" : ""
          }`}
        >
          Docs
        </Link>
        <Button href={onApp ? "/" : "/app"} variant="secondary" small>
          {onApp ? "Back to site" : "Launch app"}
        </Button>
      </div>
    </header>
  );
}
