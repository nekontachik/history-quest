import Link from "next/link";
import YearSection from "@/components/features/YearSection";
import HomeSubtitle from "@/components/layout/HomeSubtitle";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <h1 className="mb-2 text-4xl font-bold tracking-tight text-white sm:text-6xl">
        Time Machine
      </h1>
      <HomeSubtitle />
      <YearSection />
      <Link
        href="/play"
        data-testid="play-chronicle-link"
        className="relative mt-6 rounded-lg px-3 py-2 text-sm text-gray-400 underline decoration-gray-600 underline-offset-4 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400"
      >
        Play Chronicle — 1648
      </Link>
    </main>
  );
}
