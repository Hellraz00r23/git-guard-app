import Link from 'next/link';

export default function HomePage() {
  const appSlug = process.env.GITHUB_APP_SLUG;
  const installUrl = appSlug
    ? `https://github.com/apps/${encodeURIComponent(appSlug)}/installations/new`
    : null;

  return (
    <main className="page">
      <header className="topbar">
        <Link className="brand" href="/">
          <span aria-hidden="true" className="brand-mark">G</span>
          GitGuard
        </Link>
        <Link className="top-link" href="/privacy">Privacy</Link>
      </header>

      <section className="hero">
        <p className="eyebrow">Security where code ships</p>
        <h1>Catch leaked credentials before they reach production.</h1>
        <p className="hero-copy">
          GitGuard scans added pull request changes for common secrets and sensitive filenames,
          then reports redacted findings in a GitHub Check and pull request comment.
        </p>
        <div className="actions">
          {installUrl ? (
            <a className="button button-primary" href={installUrl}>Install GitGuard</a>
          ) : (
            <a className="button button-primary" href="https://github.com/marketplace">
              GitHub Marketplace
            </a>
          )}
          <a className="button" href="https://github.com/Hellraz00r23/git-guard-app">
            View source
          </a>
        </div>
        {!appSlug && (
          <p className="setup-note">
            Configure <code>GITHUB_APP_SLUG</code> after registering the GitHub App to show a direct install link here.
          </p>
        )}
      </section>

      <section aria-label="GitGuard features" className="features">
        <article className="feature">
          <h2>Scan the actual changes</h2>
          <p>Inspect added lines in pull request patches as well as filenames commonly used for credentials.</p>
        </article>
        <article className="feature">
          <h2>Keep values out of reports</h2>
          <p>Reports include file, line, and detector only. Detected secret values are never returned or stored by the app.</p>
        </article>
        <article className="feature">
          <h2>Make findings actionable</h2>
          <p>See a GitHub Check Run with annotations and a single updating pull request comment for each scan.</p>
        </article>
      </section>

      <footer className="footer">
        <span>GitGuard helps catch common accidental credential commits; it is not a guarantee that code is secret-free.</span>
        <Link href="/privacy">Privacy notice</Link>
      </footer>
    </main>
  );
}
