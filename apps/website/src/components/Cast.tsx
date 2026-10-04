import { getAllMaids } from "../utils/maids.js";
import { MaidCard } from "./MaidCard.js";
import type { Locale } from "../i18n.js";

/** Who greets you at the door. The rest of the cast keeps their pages; the
 * homepage only introduces these three. */
const ON_SHIFT = ["kurumi", "kotone", "kokona"];

const copy = {
  en: {
    title: "Pick your maid",
    lede: "Each with her own personality, and her own way of talking.",
  },
  zh: {
    title: "挑一位女僕",
    lede: "每一位都有自己的個性，和自己說話的方式。",
  },
} as const;

export function Cast({ locale }: { locale: Locale }) {
  const t = copy[locale];
  const maids = getAllMaids(locale);
  const cast = ON_SHIFT.map((slug) => maids.find((m) => m.slug === slug)).filter((m) => m !== undefined);

  return (
    <>
      <section class="home-cast">
        <h2>{t.title}</h2>
        <p class="home-lead">{t.lede}</p>
      </section>

      <div class="maid-list">
        {cast.map((maid) => (
          <MaidCard maid={maid} locale={locale} />
        ))}
      </div>
    </>
  );
}
