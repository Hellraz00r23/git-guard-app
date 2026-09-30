import Link from 'next/link';

export default function PrivacyPage() {
  const supportEmail = process.env.SUPPORT_EMAIL;

  return (
    <main className="page">
      <header className="topbar">
        <Link className="brand" href="/">
          <span aria-hidden="true" className="brand-mark">G</span>
          GitGuard
        </Link>
        <Link className="top-link" href="/">Home</Link>
      </header>
      <article className="content">
        <p className="eyebrow">Privacy</p>
        <h1>GitGuard privacy notice</h1>
        <p>Last updated: September 29, 2026</p>
        <h2>Information GitGuard processes</h2>
        <p>
          When GitGuard receives a subscribed pull request webhook, it requests the pull request&apos;s
          changed file names and patches from GitHub. It examines added patch lines for known
          credential patterns and checks filenames for common sensitive-file names.
        </p>
        <h2>Findings and retention</h2>
        <p>
          GitGuard does not save webhook payloads, patch contents, or detected credential values
          in an application database. Findings contain only a file path, line number when available,
          and detector name; they are returned to GitHub as Check Run annotations and a pull request
          comment. GitHub retains those reports under the repository&apos;s settings and policies.
          The application does not intentionally log webhook payloads or secret values.
        </p>
        <h2>Infrastructure</h2>
        <p>
          The service must be deployed by its operator. The hosting provider may process request
          metadata and operational logs under its own terms and retention settings. Review and
          configure the hosting provider before offering this service to customers.
        </p>
        <h2>Contact</h2>
        <p>
          {supportEmail
            ? <>For privacy questions, email <a href={`mailto:${supportEmail}`}>{supportEmail}</a>.</>
            : 'The operator must configure SUPPORT_EMAIL before publishing this notice.'}
        </p>
        <p>This notice must be reviewed and adapted by the service operator before Marketplace publication.</p>
      </article>
    </main>
  );
}
