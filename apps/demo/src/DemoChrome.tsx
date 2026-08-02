export type DemoPage = "features" | "performance" | "vue";

interface DemoChromeProps {
  current: DemoPage;
  theme?: "light" | "dark";
}

const pages: readonly {
  id: DemoPage;
  index: string;
  label: string;
  path: string;
}[] = [
  { id: "features", index: "01", label: "Features", path: "" },
  { id: "performance", index: "02", label: "Performance", path: "diff/" },
  { id: "vue", index: "03", label: "Vue", path: "vue/" },
];

function pageHref(path: string): string {
  return `${import.meta.env.BASE_URL}${path}`;
}

export function DemoSiteHeader({
  current,
  theme = "light",
}: DemoChromeProps) {
  return (
    <header className={`demo-site-header demo-site-header--${theme}`}>
      <a className="demo-site-brand" href={pageHref("")}>
        <span className="demo-site-brand-mark">VS</span>
        <span>
          <strong>Virtual Search</strong>
          <small>Browser Find laboratory</small>
        </span>
      </a>
      <nav className="demo-site-nav" aria-label="Demo pages">
        {pages.map(page =>
          page.id === current
            ? (
              <span key={page.id} aria-current="page">
                <i>{page.index}</i>{page.label}
              </span>
            )
            : (
              <a key={page.id} href={pageHref(page.path)}>
                <i>{page.index}</i>{page.label}
              </a>
            )
        )}
      </nav>
      <a
        className="demo-site-source"
        href="https://github.com/kamikaz1k/virtual-search"
      >
        GitHub <span aria-hidden="true">↗</span>
      </a>
    </header>
  );
}

export function DemoSiteFooter({
  current,
  theme = "light",
}: DemoChromeProps) {
  return (
    <footer className={`demo-site-footer demo-site-footer--${theme}`}>
      <div className="demo-site-footer-brand">
        <span className="demo-site-brand-mark">VS</span>
        <strong>Virtual Search</strong>
      </div>
      <p>Native-like page search across DOM and virtualized content.</p>
      <nav aria-label="Demo pages">
        {pages.map(page =>
          page.id === current
            ? <span key={page.id} aria-current="page">{page.label}</span>
            : <a key={page.id} href={pageHref(page.path)}>{page.label}</a>
        )}
      </nav>
      <span className="demo-site-footer-note">Open source experiment · 2026</span>
    </footer>
  );
}
