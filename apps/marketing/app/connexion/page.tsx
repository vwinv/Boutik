import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Connexion — Boutik",
  description: "Connectez-vous pour reprendre la création de votre site.",
};

export default function LoginPage() {
  return <LoginForm />;
}
