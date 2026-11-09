import type { Metadata } from "next";
import { Onboarding } from "./onboarding";

export const metadata: Metadata = {
  title: "Créer votre site — Boutik",
  description: "Créez votre compte pour mettre votre site Boutik en ligne.",
};

export default function OnboardingPage() {
  return <Onboarding />;
}
