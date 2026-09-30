import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GitGuard - Pull request secret scanning',
  description: 'Catch accidentally committed credentials in GitHub pull requests before they are merged.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
