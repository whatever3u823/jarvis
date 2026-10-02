import { member } from "@/club.config";
import { getLamp, requireReader } from "@/lib/session";
import { Masthead } from "@/components/shell/Masthead";
import { Footer } from "@/components/shell/Footer";
import { LampCord } from "@/components/shell/LampCord";
import { PocketNav } from "@/components/shell/Nav";
import { Mischief } from "@/components/shell/Mischief";

export default async function ClubLayout({ children }: { children: React.ReactNode }) {
  const [reader, lamp] = await Promise.all([requireReader(), getLamp()]);
  return (
    <div className="md:px-6 md:py-8 lg:py-10">
      <div className="sheet mx-auto min-h-dvh max-w-[78rem] md:min-h-[calc(100dvh-4rem)]">
        <a href="#page" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-paper focus:p-2">
          Skip to the page
        </a>
        <LampCord lamp={lamp} />
        <Masthead reader={reader} />
        <main id="page" className="px-5 sm:px-10 md:px-14">
          {children}
        </main>
        <Footer reader={reader} />
      </div>
      <PocketNav reader={reader}>{member(reader).name}</PocketNav>
      <Mischief />
    </div>
  );
}
