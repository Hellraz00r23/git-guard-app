export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-2xl space-y-6">
        <h1 className="text-5xl font-extrabold tracking-tight">GitGuard Security Bot</h1>
        <p className="text-slate-400 text-lg">
          Automated Pull Request security scanner auditing file commits for unencrypted secrets and environment configs.
        </p>
      </div>
    </main>
  );
}
