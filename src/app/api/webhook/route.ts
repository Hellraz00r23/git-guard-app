import { NextResponse } from 'next/server';
import { verify } from '@octokit/webhooks-methods';
import { getGithubApp } from '@/lib/github';
import { scanPullRequestFiles, type SecretFinding } from '@/lib/scanner';

export const runtime = 'nodejs';

const CHECK_NAME = 'GitGuard Secret Scan';
const COMMENT_MARKER = '<!-- gitguard-secret-scan -->';
const MAX_WEBHOOK_BODY_BYTES = 25 * 1024 * 1024;
const SCANNED_ACTIONS = new Set(['opened', 'synchronize', 'reopened', 'ready_for_review']);

interface PullRequestWebhookPayload {
  action?: unknown;
  installation?: { id?: unknown } | null;
  repository?: { name?: unknown; owner?: { login?: unknown } } | null;
  number?: unknown;
  pull_request?: { head?: { sha?: unknown } } | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getPullRequestPayload(value: unknown): PullRequestWebhookPayload | null {
  if (!isRecord(value)) return null;
  return value as PullRequestWebhookPayload;
}

function markdownPath(filePath: string): string {
  return filePath.replace(/[\r\n]/g, '\\n').replace(/[`\\]/g, '\\$&');
}

function createReport(findings: SecretFinding[], unscannedFileCount: number): string {
  const header = findings.length
    ? `## GitGuard found ${findings.length} potential secret${findings.length === 1 ? '' : 's'}\n\nReview and rotate any exposed credentials, then remove them from the pull request.`
    : unscannedFileCount
      ? '## GitGuard scan has limited coverage\n\nNo known findings were detected in the available patch text.'
      : '## GitGuard scan passed\n\nNo known secrets or sensitive filenames were detected in the pull request changes.';
  const details = findings.length
    ? `\n\n${findings
        .map(
          (finding) =>
            `- \`${markdownPath(finding.filePath)}\`${finding.line === null ? '' : `:${finding.line}`} — ${finding.detector}`,
        )
        .join('\n')}`
    : '';
  const coverageNote = unscannedFileCount
    ? `\n\n**Limited coverage:** GitHub did not provide patch text for ${unscannedFileCount} changed file(s); those files were checked by filename only.`
    : '';
  return `${COMMENT_MARKER}\n${header}${details}${coverageNote}`;
}

export async function GET() {
  try {
    getGithubApp();
    return NextResponse.json({ status: 'ok' });
  } catch {
    return NextResponse.json({ status: 'not_configured' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const deliveryId = request.headers.get('x-github-delivery');
  const event = request.headers.get('x-github-event');
  const signature = request.headers.get('x-hub-signature-256');
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook is not configured' }, { status: 503 });
  }
  if (!signature) return NextResponse.json({ error: 'Missing webhook signature' }, { status: 401 });

  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_WEBHOOK_BODY_BYTES) {
    return NextResponse.json({ error: 'Webhook payload is too large' }, { status: 413 });
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'Unable to read webhook payload' }, { status: 400 });
  }
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_WEBHOOK_BODY_BYTES) {
    return NextResponse.json({ error: 'Webhook payload is too large' }, { status: 413 });
  }

  let validSignature: boolean;
  try {
    validSignature = await verify(webhookSecret, rawBody, signature);
  } catch {
    validSignature = false;
  }
  if (!validSignature) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
  }

  if (event !== 'pull_request') {
    return NextResponse.json({ status: 'ignored' });
  }

  let payload: PullRequestWebhookPayload | null;
  try {
    payload = getPullRequestPayload(JSON.parse(rawBody) as unknown);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }
  if (!payload || typeof payload.action !== 'string') {
    return NextResponse.json({ error: 'Invalid pull request payload' }, { status: 400 });
  }
  if (!SCANNED_ACTIONS.has(payload.action)) {
    return NextResponse.json({ status: 'ignored' });
  }

  const installationId = payload.installation?.id;
  const owner = payload.repository?.owner?.login;
  const repo = payload.repository?.name;
  const pullNumber = payload.number;
  const headSha = payload.pull_request?.head?.sha;

  if (
    typeof installationId !== 'number' ||
    !Number.isSafeInteger(installationId) ||
    typeof owner !== 'string' ||
    owner.length === 0 ||
    typeof repo !== 'string' ||
    repo.length === 0 ||
    typeof pullNumber !== 'number' ||
    !Number.isSafeInteger(pullNumber) ||
    typeof headSha !== 'string' ||
    headSha.length === 0
  ) {
    return NextResponse.json({ error: 'Pull request payload is missing required fields' }, { status: 400 });
  }

  try {
    const app = getGithubApp();
    const octokit = await app.getInstallationOctokit(installationId);
    const files = await octokit.paginate(octokit.rest.pulls.listFiles, {
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
    });
    const findings = scanPullRequestFiles(
      files.map((file) => ({ filename: file.filename, patch: file.patch, status: file.status })),
    );
    const unscannedFileCount = files.filter(
      (file) => file.status !== 'removed' && !file.patch,
    ).length;

    const existingChecks = await octokit.rest.checks.listForRef({
      owner,
      repo,
      ref: headSha,
      check_name: CHECK_NAME,
      per_page: 100,
    });
    const existingCheck = existingChecks.data.check_runs.find(
      (check) => check.app?.id === Number(process.env.GITHUB_APP_ID),
    );
    const annotations = findings
      .filter((finding): finding is SecretFinding & { line: number } => finding.line !== null)
      .slice(0, 50)
      .map((finding) => ({
        path: finding.filePath,
        start_line: finding.line,
        end_line: finding.line,
        annotation_level: 'warning' as const,
        title: finding.detector,
        message: 'Potential credential detected. The value is intentionally omitted.',
      }));
    const checkOutput = {
      title: findings.length
        ? `${findings.length} potential secret(s) detected`
        : unscannedFileCount
          ? 'Scan complete with limited coverage'
          : 'No known secrets detected',
      summary: findings.length
        ? `${findings.length} potential finding(s) detected. Secret values are never included in GitGuard reports.`
        : unscannedFileCount
          ? `No known findings in available patches. ${unscannedFileCount} changed file(s) had no patch text and were checked by filename only.`
          : 'The changed file patches and sensitive filenames were scanned. No known patterns were detected.',
      annotations,
    };

    if (existingCheck) {
      await octokit.rest.checks.update({
        owner,
        repo,
        check_run_id: existingCheck.id,
        status: 'completed',
        conclusion: findings.length ? 'action_required' : unscannedFileCount ? 'neutral' : 'success',
        completed_at: new Date().toISOString(),
        output: checkOutput,
      });
    } else {
      await octokit.rest.checks.create({
        owner,
        repo,
        name: CHECK_NAME,
        head_sha: headSha,
        status: 'completed',
        conclusion: findings.length ? 'action_required' : unscannedFileCount ? 'neutral' : 'success',
        completed_at: new Date().toISOString(),
        output: checkOutput,
      });
    }

    const comments = await octokit.paginate(octokit.rest.issues.listComments, {
      owner,
      repo,
      issue_number: pullNumber,
      per_page: 100,
    });
    const existingComment = comments.find(
      (comment) => comment.user?.type === 'Bot' && comment.body?.includes(COMMENT_MARKER),
    );
    const body = createReport(findings, unscannedFileCount);

    if (existingComment) {
      await octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: existingComment.id,
        body,
      });
    } else {
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: pullNumber,
        body,
      });
    }

    return NextResponse.json({ status: 'processed', findings: findings.length });
  } catch (error: unknown) {
    console.error('GitGuard webhook processing failed', {
      deliveryId,
      event,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    return NextResponse.json({ error: 'Unable to process pull request scan' }, { status: 500 });
  }
}
