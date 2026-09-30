# GitGuard

GitGuard is a GitHub App that scans added pull request patch lines for common credentials and flags commonly sensitive filenames. It posts a GitHub Check Run and maintains one report comment per pull request. Secret values are omitted from reports.

The scanner is a lightweight first line of defense, not a replacement for a dedicated secret-scanning product. Pattern-based scanners can miss secrets and can report false positives.

## Run locally

Requirements: Node.js 20 or newer and npm.

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Register a GitHub App as described below and fill in `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_WEBHOOK_SECRET`, and `GITHUB_PRIVATE_KEY`.
4. Run `npm run dev`.
5. Expose the local server through a secure webhook tunnel and set the GitHub App webhook URL to `https://<your-host>/api/webhook`.

`GET /api/webhook` is a configuration health check. It returns `200` when the GitHub App configuration is present and valid enough to initialize, or `503` when it is not configured.

## GitHub App configuration

Create a GitHub App under your account or organization and configure:

- **Webhook URL:** `https://<deployed-host>/api/webhook`
- **Webhook secret:** a unique random value matching `GITHUB_WEBHOOK_SECRET`
- **Repository permissions:** Pull requests: Read; Checks: Read and write; Issues: Read and write
- **Subscribe to events:** Pull request
- **Pull request actions scanned:** `opened`, `synchronize`, `reopened`, and `ready_for_review`

GitHub provides repository metadata access automatically. Do not grant contents write or administration permissions. The private key belongs only in the deployment environment; store it as a secret and encode newlines as `\n` if the host requires a single-line value.

The app lists changed PR files through GitHub's API, scans their patches, and does not clone repositories. Files without a patch (for example binary files or very large diffs) are checked by filename only. GitHub limits the PR-files endpoint to 3,000 files.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `GITHUB_APP_ID` | Yes | Numeric GitHub App ID |
| `GITHUB_PRIVATE_KEY` | Yes | App private key PEM |
| `GITHUB_WEBHOOK_SECRET` | Yes | HMAC secret used to verify webhook deliveries |
| `GITHUB_APP_SLUG` | For install button | App slug from its GitHub URL |
| `SUPPORT_EMAIL` | Marketplace launch | Contact displayed on the privacy notice |

No database or Supabase account is required for the current MVP.

## Checks

```sh
npm test
npm run typecheck
npm run build
```

## Deploy

Deploy this Next.js application to a host that supports Node.js server routes, configure the environment variables there, and set the GitHub App webhook URL to the deployed `/api/webhook` endpoint. Verify `GET /api/webhook`, install the app on a test repository, and open test pull requests containing known fake credentials before enabling it for customers.

## Marketplace launch checklist

Marketplace publication is an owner-controlled GitHub operation; deploying this repository does not publish a listing. Before submitting a listing:

- Deploy the site and webhook, set the environment variables, and test app installation, pull request scanning, comments, checks, retries, and uninstall behavior on a test organization.
- Create a public GitHub App profile and complete its Marketplace listing with accurate branding, description, screenshots, pricing, support contact, and website.
- Set the listing's privacy policy URL to the deployed `/privacy` page, configure `SUPPORT_EMAIL`, and have the operator review the notice for their hosting, support, and legal practices.
- Decide on a license for this repository and publish the app terms and other business/legal information required for the operator's offering.
- Submit the Marketplace listing for GitHub's review and address any requested changes.

Do not claim the app guarantees detection or prevention of all secrets. Review scan results and GitHub app permissions before inviting production customers.
