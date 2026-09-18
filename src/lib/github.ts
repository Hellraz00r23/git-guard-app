import { App } from 'octokit';

if (!process.env.GITHUB_APP_ID || !process.env.GITHUB_PRIVATE_KEY) {
  throw new Error('Missing GitHub App environment variables.');
}

const formattedPrivateKey = process.env.GITHUB_PRIVATE_KEY.replace(/\\n/g, '\n');

export const ghApp = new App({
  appId: process.env.GITHUB_APP_ID,
  privateKey: formattedPrivateKey,
  webhooks: { secret: process.env.GITHUB_WEBHOOK_SECRET || '' },
});
