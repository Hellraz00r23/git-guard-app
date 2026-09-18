import { NextResponse } from 'next/server';
import { verify } from '@octokit/webhooks-methods';
import { ghApp } from '@/lib/github';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-hub-signature-256');
    const event = req.headers.get('x-github-event');

    if (!signature || !process.env.GITHUB_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Missing webhook signature or secret' }, { status: 401 });
    }

    const isValid = await verify(process.env.GITHUB_WEBHOOK_SECRET, rawBody, signature);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);

    if (event === 'pull_request' && ['opened', 'synchronize', 'reopened'].includes(payload.action)) {
      const installationId = payload.installation?.id;
      if (!installationId) return NextResponse.json({ error: 'No installation ID' }, { status: 400 });

      const octokit = await ghApp.getInstallationOctokit(installationId);
      const owner = payload.repository.owner.login;
      const repo = payload.repository.name;
      const pullNumber = payload.number;

      const { data: files } = await octokit.rest.pulls.listFiles({
        owner,
        repo,
        pull_number: pullNumber,
      });

      const suspiciousPatterns = ['.env', 'id_rsa', 'secret', 'credentials', 'pem'];
      const flaggedFiles = files.filter((file) =>
        suspiciousPatterns.some((pattern) => file.filename.toLowerCase().includes(pattern))
      );

      const hasIssue = flaggedFiles.length > 0;
      const statusText = hasIssue ? 'FLAGGED' : 'PASSED';

      await supabaseAdmin.from('app_audit_logs').insert([
        {
          repo_name: `${owner}/${repo}`,
          pr_number: pullNumber,
          action: payload.action,
          status: statusText,
          flagged_files: flaggedFiles.map((f) => f.filename),
        },
      ]);

      let commentBody = hasIssue
        ? `⚠️ **GitGuard Security Alert**\n\nPotential sensitive file patterns detected:\n` +
          flaggedFiles.map((f) => `- \`${f.filename}\``).join('\n')
        : `🛡️ **GitGuard Audit Complete**\n\nNo sensitive credential files detected.`;

      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: pullNumber,
        body: commentBody,
      });
    }

    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server Error' }, { status: 500 });
  }
}
