import { App } from 'octokit';

let app: App | undefined;

export function getGithubApp(): App {
  if (app) return app;

  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_PRIVATE_KEY;
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!appId || !privateKey || !webhookSecret) {
    throw new Error('GitHub App configuration is incomplete.');
  }

  const numericAppId = Number(appId);
  if (!Number.isSafeInteger(numericAppId) || numericAppId <= 0) {
    throw new Error('GITHUB_APP_ID must be a positive integer.');
  }

  const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');
  app = new App({
    appId: numericAppId,
    privateKey: formattedPrivateKey,
    webhooks: { secret: webhookSecret },
  });

  return app;
}
