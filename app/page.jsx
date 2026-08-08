"use client";

import Script from "next/script";
import { APP_MARKUP } from "./appMarkup";

// Next.js hosts the NiveshOS engine unchanged: exact legacy markup injected
// once, then the vendored GSAP + engine scripts load in original order after
// hydration, so the engine boots exactly as it did on the static site.
export default function Page() {
  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: APP_MARKUP }} />

      <Script id="gsap" src="/vendor/gsap.min.js" strategy="afterInteractive" />
      <Script id="scrolltrigger" src="/vendor/ScrollTrigger.min.js" strategy="afterInteractive" />
      <Script id="real-quotes" src="/real-quotes.js" strategy="afterInteractive" />
      <Script id="nivesh-data" src="/data.js" strategy="afterInteractive" />
      <Script id="nivesh-app" src="/app.js" strategy="afterInteractive" />
      <Script id="nivesh-anim" src="/anim.js" strategy="afterInteractive" />
    </>
  );
}
