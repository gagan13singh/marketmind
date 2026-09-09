import { Hero } from "@/components/landing/hero";
import { Pipeline, Modules, HorizonSection, HonestySection, ClosingCta } from "@/components/landing/sections";
import { AppFooter } from "@/components/layout/app-nav";

export default function LandingPage() {
  return (
    <main>
      <Hero />
      <Pipeline />
      <Modules />
      <HorizonSection />
      <HonestySection />
      <ClosingCta />
      <AppFooter />
    </main>
  );
}
