export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="text-center max-w-2xl">
        <h1 className="text-5xl font-bold tracking-tight">🔎 SCOUT</h1>

        <p className="mt-6 text-xl text-gray-600 dark:text-gray-400">
          Open-Source Multi-Agent Research &amp; Intelligence Platform
        </p>

        <p className="mt-2 text-base text-gray-500 dark:text-gray-500">
          Ask. Investigate. Verify. Understand.
        </p>

        <div className="mt-10 p-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 text-sm text-gray-500 dark:text-gray-400">
          Development environment is running.
        </div>
      </div>
    </main>
  );
}
