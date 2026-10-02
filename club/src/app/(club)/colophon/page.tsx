import type { Metadata } from "next";
import { club } from "@/club.config";
import { requireReader } from "@/lib/session";
import { longDate } from "@/lib/format";
import { Bookplate, Eternity } from "@/components/ornaments";

export const metadata: Metadata = { title: "Colophon" };

/** Found only by following the pilcrow at the foot of every page. */
export default async function Colophon() {
  await requireReader();
  return (
    <article className="mx-auto max-w-xl pt-12 pb-6 text-center">
      <div className="label">Colophon</div>
      <h1 className="mt-4 font-display text-5xl italic">Of this edition</h1>
      <div className="mt-10 space-y-5 text-[1.15rem] leading-relaxed text-ink-soft">
        <p>
          Titles are set in <i>IM Fell English</i>, from types given to the University of Oxford by Bishop John Fell in the 1670s; text in{" "}
          <i>EB Garamond</i>, after Claude Garamont; records in <i>Special Elite</i>, a typewriter that has seen things. Marginalia are in two hands,
          neither of them a font anyone would choose on purpose.
        </p>
        <p>
          Printed in an edition of two copies on imaginary paper, from {longDate(club.founded)} onwards.
          <br />
          Copy no. 1 belongs to the monkey. Copy no. 2 belongs to the cat. Neither is for sale, loan, or inspection.
        </p>
        <p>
          The red ink is <i>sinopia</i>, the earth painters used to sketch frescoes before the colour went on. The blue is <i>lapis</i>, as in the
          gospels illuminated by Toros Roslin. The wax is just wax.
        </p>
      </div>
      <Bookplate className="mx-auto mt-12 max-w-xs" />
      <p className="mx-auto mt-12 max-w-md text-[1.1rem] leading-relaxed italic">{club.colophonNote}</p>
      <div className="mt-10 flex items-center justify-center gap-4 text-ink-faint">
        <span className="italic" title="Sicilian: my breath">sciatu miu</span>
        <Eternity width={18} height={18} />
        <span lang="hy" title="Armenian: my soul">հոգիս</span>
      </div>
    </article>
  );
}
