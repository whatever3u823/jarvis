import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = (await searchParams).next ?? "/";
  return (
    <div className="mx-auto max-w-md px-4 pt-[20vh]">
      <div className="flex items-center gap-3">
        <span className="block h-3 w-3 rotate-45 border border-brass" />
        <span className="label">Private library</span>
      </div>
      <h1 className="mt-5 font-display text-[40px] leading-tight text-ivory">This collection is private.</h1>
      <LoginForm next={next} />
    </div>
  );
}
