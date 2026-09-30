import assert from 'node:assert/strict';
import test from 'node:test';
import { scanPullRequestFiles } from './scanner';

test('finds credential patterns only on added lines and reports new-file line numbers', () => {
  const findings = scanPullRequestFiles([
    {
      filename: 'src/config.ts',
      patch: [
        '@@ -1,2 +1,3 @@',
        ' const existing = "password = not-a-secret";',
        '-const removed = "token=removed-secret-value";',
        '+const aws = "AKIA1234567890ABCDEF";',
        '+const token = "ghp_1234567890abcdefghijklmnopqrstuv";',
      ].join('\n'),
    },
  ]);

  assert.deepEqual(
    findings.map(({ line, detector }) => ({ line, detector })),
    [
      { line: 2, detector: 'AWS access key' },
      { line: 3, detector: 'GitHub token' },
    ],
  );
  assert.equal(JSON.stringify(findings).includes('AKIA1234567890ABCDEF'), false);
  assert.equal(JSON.stringify(findings).includes('ghp_1234567890abcdefghijklmnopqrstuv'), false);
});

test('finds secret assignments and ignores common placeholders', () => {
  const findings = scanPullRequestFiles([
    {
      filename: 'config.ts',
      patch: [
        '@@ -0,0 +1,2 @@',
        '+const API_KEY = "sk_live_secretvalue123";',
        '+const STRIPE_SECRET_KEY = "sk_live_anothersecret123";',
        '+const password = "your-secret-here";',
      ].join('\n'),
    },
  ]);

  assert.deepEqual(findings, [
    { filePath: 'config.ts', line: 1, detector: 'API_KEY assignment' },
    { filePath: 'config.ts', line: 2, detector: 'STRIPE_SECRET_KEY assignment' },
  ]);
});

test('flags sensitive filenames even when GitHub does not provide a patch', () => {
  assert.deepEqual(
    scanPullRequestFiles([{ filename: 'config/production.env', patch: null }]),
    [{ filePath: 'config/production.env', line: null, detector: 'Sensitive filename' }],
  );
});

test('does not flag a documented environment template', () => {
  assert.deepEqual(
    scanPullRequestFiles([
      {
        filename: '.env.example',
        patch: [
          '@@ -0,0 +1,2 @@',
          '+GITHUB_WEBHOOK_SECRET="replace-with-a-random-webhook-secret"',
          '+GITHUB_PRIVATE_KEY="replace-with-your-private-key"',
        ].join('\n'),
      },
    ]),
    [],
  );
});

test('does not flag a sensitive file that is being deleted', () => {
  assert.deepEqual(
    scanPullRequestFiles([{ filename: 'secrets/production.env', status: 'removed' }]),
    [],
  );
});

test('does not report ordinary changes or placeholder key files as secrets', () => {
  assert.deepEqual(
    scanPullRequestFiles([
      {
        filename: 'src/config.ts',
        patch: [
          '@@ -1 +1 @@',
          '-const API_KEY = "old-placeholder";',
          '+const API_KEY = "placeholder";',
        ].join('\n'),
      },
      { filename: 'README.md', patch: '+No credentials here.' },
    ]),
    [],
  );
});
