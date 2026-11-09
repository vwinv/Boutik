"use client";

import { useEffect, useRef, useState } from "react";
import { CONTRACT_DIALOG, CONTRACT_SUMMARY } from "./contract-text";
import { ContentStep } from "./content-step";
import { contentCopy, emptyContent, newContentId, type ContentDraft } from "./content-data";
import { PreviewStep } from "./preview-step";
import { PublishStep, type PublishResult } from "./publish-step";
import { storeSession } from "./resume";
import { TemplateStep } from "./template-step";
import { emptyTemplate, type TemplateDraft, type TemplateId } from "./templates";

const DRAFT_KEY = "boutik.onboarding.account";
const INFO_KEY = "boutik.onboarding.info";
const COVER_PREVIEW_KEY = "boutik.onboarding.coverPreview";
const CONTRACT_KEY = "boutik.onboarding.contract";
const TEMPLATE_KEY = "boutik.onboarding.template";
const CONTENT_KEY = "boutik.onboarding.content";
const VERIFY_KEY = "boutik.onboarding.verify";

const STEPS = ["Compte", "Activité", "Informations", "Contrat", "Modèle", "Contenu", "Aperçu", "Publication"] as const;

type Draft = {
  lastName: string;
  firstName: string;
  email: string;
  phone: string;
  terms: boolean;
};

const emptyDraft: Draft = {
  lastName: "",
  firstName: "",
  email: "",
  phone: "",
  terms: false,
};

type Fields = Draft & {
  password: string;
  confirm: string;
};

const emptyFields: Fields = {
  ...emptyDraft,
  password: "",
  confirm: "",
};

type Activity = "BOUTIQUE" | "RESTAURANT" | "VITRINE";

type BusinessDraft = {
  businessName: string;
  phone: string;
  description: string;
  managerLastName: string;
  managerFirstName: string;
  professionalEmail: string;
  address: string;
  city: string;
  hours: string;
  instagramUrl: string;
  tiktokUrl: string;
  facebookUrl: string;
  logoName: string;
  coverName: string;
};

const emptyBusiness: BusinessDraft = {
  businessName: "",
  phone: "",
  description: "",
  managerLastName: "",
  managerFirstName: "",
  professionalEmail: "",
  address: "",
  city: "",
  hours: "",
  instagramUrl: "",
  tiktokUrl: "",
  facebookUrl: "",
  logoName: "",
  coverName: "",
};

type ContractDraft = {
  accepted: boolean;
  signature: string | null;
  signedAt: string | null;
};

const emptyContract: ContractDraft = {
  accepted: false,
  signature: null,
  signedAt: null,
};

type VerifySession = {
  email: string;
  phone: string;
  debugCode: string | null;
  confirmed: boolean;
  category?: Activity;
  phase?: "phone" | "activity" | "info" | "contract" | "template" | "content" | "preview" | "publish";
  accountCreated?: boolean;
};

export function Onboarding() {
  const [fields, setFields] = useState<Fields>(emptyFields);
  const [hydrated, setHydrated] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [phase, setPhase] = useState<"account" | "phone" | "activity" | "info" | "contract" | "template" | "content" | "preview" | "publish">("account");
  const [category, setCategory] = useState<Activity>("BOUTIQUE");
  const [info, setInfo] = useState<BusinessDraft>(emptyBusiness);
  const [contract, setContract] = useState<ContractDraft>(emptyContract);
  const [template, setTemplate] = useState<TemplateDraft>(emptyTemplate);
  const [content, setContent] = useState<ContentDraft>(emptyContent);
  const [publish, setPublish] = useState<PublishResult | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [showInfoErrors, setShowInfoErrors] = useState(false);
  const [code, setCode] = useState("");
  const [debugCode, setDebugCode] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [contractOpen, setContractOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (raw) {
      try {
        const saved = JSON.parse(raw) as Partial<Draft>;
        setFields((current) => ({
          ...current,
          lastName: saved.lastName ?? "",
          firstName: saved.firstName ?? "",
          email: saved.email ?? "",
          phone: saved.phone ?? "",
          terms: Boolean(saved.terms),
        }));
      } catch {
        window.localStorage.removeItem(DRAFT_KEY);
      }
    }
    const savedVerify = window.sessionStorage.getItem(VERIFY_KEY);
    if (savedVerify) {
      try {
        const session = JSON.parse(savedVerify) as VerifySession;
        if (session.email) {
          setDebugCode(session.debugCode);
          setConfirmed(session.confirmed);
          setAccountCreated(Boolean(session.accountCreated));
          setCategory("BOUTIQUE");
          const nextPhase = session.phase ?? (session.confirmed ? "activity" : "phone");
          setPhase(nextPhase);
          setFields((current) => ({
            ...current,
            email: current.email || session.email,
            phone: current.phone || session.phone,
          }));
        }
      } catch {
        window.sessionStorage.removeItem(VERIFY_KEY);
      }
    }
    const savedInfo = window.localStorage.getItem(INFO_KEY);
    if (savedInfo) {
      try {
        const saved = JSON.parse(savedInfo) as Partial<BusinessDraft>;
        setInfo((current) => ({ ...current, ...saved }));
      } catch {
        window.localStorage.removeItem(INFO_KEY);
      }
    }
    const savedCover = window.localStorage.getItem(COVER_PREVIEW_KEY);
    if (savedCover?.startsWith("data:image/")) {
      setCoverPreview(savedCover);
      const restored = dataUrlToFile(savedCover, "cover.jpg");
      if (restored) setCoverFile(restored);
    }
    const savedContract = window.localStorage.getItem(CONTRACT_KEY);
    if (savedContract) {
      try {
        const saved = JSON.parse(savedContract) as Partial<ContractDraft>;
        setContract({
          accepted: Boolean(saved.accepted),
          signature: saved.signature ?? null,
          signedAt: saved.signedAt ?? null,
        });
      } catch {
        window.localStorage.removeItem(CONTRACT_KEY);
      }
    }
    const savedTemplate = window.localStorage.getItem(TEMPLATE_KEY);
    if (savedTemplate) {
      try {
        const saved = JSON.parse(savedTemplate) as Partial<TemplateDraft>;
        setTemplate({
          templateId: saved.templateId ?? "eclat",
          primary: saved.primary ?? emptyTemplate.primary,
          secondary: saved.secondary ?? emptyTemplate.secondary,
          applied: Boolean(saved.applied),
        });
      } catch {
        window.localStorage.removeItem(TEMPLATE_KEY);
      }
    }
    const savedContent = window.localStorage.getItem(CONTENT_KEY);
    if (savedContent) {
      try {
        const saved = JSON.parse(savedContent) as Partial<ContentDraft>;
        setContent({
          items: Array.isArray(saved.items)
            ? saved.items.filter((item) => item && typeof item.name === "string" && typeof item.priceXof === "number")
            : [],
        });
      } catch {
        window.localStorage.removeItem(CONTENT_KEY);
      }
    }
    const savedPublish = window.localStorage.getItem("boutik.onboarding.publish");
    if (savedPublish) {
      try {
        setPublish(JSON.parse(savedPublish) as PublishResult);
      } catch {
        window.localStorage.removeItem("boutik.onboarding.publish");
      }
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const draft: Draft = {
      lastName: fields.lastName,
      firstName: fields.firstName,
      email: fields.email,
      phone: fields.phone,
      terms: fields.terms,
    };
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [fields, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(INFO_KEY, JSON.stringify(info));
  }, [info, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(CONTRACT_KEY, JSON.stringify(contract));
  }, [contract, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(TEMPLATE_KEY, JSON.stringify(template));
  }, [template, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(CONTENT_KEY, JSON.stringify(content));
  }, [content, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const phone = fields.phone.trim();
    const lastName = fields.lastName.trim();
    const firstName = fields.firstName.trim();
    const email = fields.email.trim();
    if (!phone && !lastName && !firstName && !email) return;
    setInfo((current) => ({
      ...current,
      phone: current.phone.trim() || phone,
      managerLastName: current.managerLastName.trim() || lastName,
      managerFirstName: current.managerFirstName.trim() || firstName,
      professionalEmail: current.professionalEmail.trim() || email,
    }));
  }, [hydrated, fields.phone, fields.lastName, fields.firstName, fields.email]);

  function update<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  function rememberVerify(session: VerifySession) {
    window.sessionStorage.setItem(VERIFY_KEY, JSON.stringify(session));
    setDebugCode(session.debugCode);
    setConfirmed(session.confirmed);
    setPhase("phone");
    setCode("");
    setNotice(null);
    setFormError(null);
  }

  function fillDemo() {
    if (phase === "preview") {
      setFormError(null);
      if (!template.applied) {
        setTemplate({ templateId: "eclat", primary: "#c4457a", secondary: "#111111", applied: true });
      }
      if (content.items.length === 0) {
        setContent({
          items: contentCopy(category).demo.map((item) => ({ ...item, id: newContentId() })),
        });
      }
      return;
    }
    if (phase === "content") {
      setFormError(null);
      setContent({
        items: contentCopy(category).demo.map((item) => ({ ...item, id: newContentId() })),
      });
      return;
    }
    if (phase === "template") {
      setFormError(null);
      setTemplate({ templateId: "eclat", primary: "#111111", secondary: "#111111", applied: true });
      return;
    }
    if (phase === "contract") {
      if (contract.signedAt) return;
      setFormError(null);
      setContract((current) => ({ ...current, accepted: true }));
      return;
    }
    if (phase === "info") {
      setShowInfoErrors(false);
      setFormError(null);
      setInfo({
        businessName: "Maison Awa",
        phone: "+225 07 12 34 56 78",
        description: "Vêtements, sacs et soins faits à la main.",
        managerLastName: "Koné",
        managerFirstName: "Awa",
        professionalEmail: "awa.kone@example.com",
        address: "Rue des Jardins",
        city: "Abidjan",
        hours: "Lun – Sam · 9 h – 19 h",
        instagramUrl: "https://instagram.com/maisonawa",
        tiktokUrl: "https://tiktok.com/@maisonawa",
        facebookUrl: "https://facebook.com/maisonawa",
        logoName: "",
        coverName: "",
      });
      setLogoFile(null);
      setCoverFile(null);
      setLogoPreview((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
      setCoverPreview(null);
      window.localStorage.removeItem(COVER_PREVIEW_KEY);
      return;
    }
    if (phase === "activity") {
      setCategory("BOUTIQUE");
      setFormError(null);
      return;
    }
    if (phase === "phone") {
      if (debugCode) setCode(debugCode);
      setFormError(null);
      return;
    }
    setShowErrors(false);
    setFormError(null);
    setFields({
      lastName: "Koné",
      firstName: "Awa",
      email: "awa.kone@example.com",
      phone: "+225 07 12 34 56 78",
      password: "boutik2026",
      confirm: "boutik2026",
      terms: true,
    });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setShowErrors(true);
    if (Object.keys(validate(fields)).length > 0) return;

    setPending(true);
    setFormError(null);
    try {
      const data = await postAuth<{ debugCode?: string }>("pro/register", {
        name: `${fields.firstName.trim()} ${fields.lastName.trim()}`,
        email: fields.email.trim(),
        password: fields.password,
        phone: fields.phone.replace(/[^\d+]/g, ""),
      });
      rememberVerify({
        email: fields.email.trim(),
        phone: fields.phone,
        debugCode: data.debugCode ?? null,
        confirmed: false,
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  async function resend(channel: "sms" | "email") {
    setPending(true);
    setFormError(null);
    setNotice(null);
    try {
      const saved = window.sessionStorage.getItem(VERIFY_KEY);
      const sessionEmail = saved ? (JSON.parse(saved) as VerifySession).email : "";
      const data = await postAuth<{ debugCode?: string }>(channel === "sms" ? "resend-phone" : "phone-code-email", {
        email: (sessionEmail || fields.email).trim(),
      });
      const nextCode = data.debugCode ?? null;
      setDebugCode(nextCode);
      if (channel === "sms" || (nextCode && nextCode !== debugCode)) setCode("");
      setNotice(channel === "sms" ? "Nouveau code envoyé par SMS." : "Le même code a été envoyé par e-mail.");
      const raw = window.sessionStorage.getItem(VERIFY_KEY);
      if (raw) {
        const session = JSON.parse(raw) as VerifySession;
        window.sessionStorage.setItem(VERIFY_KEY, JSON.stringify({ ...session, debugCode: nextCode }));
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (code.length !== 6) {
      setFormError("Saisissez le code à 6 chiffres.");
      return;
    }
    setPending(true);
    setFormError(null);
    try {
      const raw = window.sessionStorage.getItem(VERIFY_KEY);
      const session = raw ? (JSON.parse(raw) as VerifySession) : null;
      await postAuth("verify-phone-code", { email: (session?.email || fields.email).trim(), code });
      setConfirmed(true);
      setNotice(null);
      setPhase("activity");
      if (session) {
        window.sessionStorage.setItem(
          VERIFY_KEY,
          JSON.stringify({ ...session, confirmed: true, category, phase: "activity" }),
        );
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  async function continueActivity() {
    const raw = window.sessionStorage.getItem(VERIFY_KEY);
    const session = raw ? (JSON.parse(raw) as VerifySession) : null;
    const email = (session?.email || fields.email).trim();
    setPending(true);
    setFormError(null);
    try {
      await postAuth("onboarding/activity", { email, category });
      if (session) {
        window.sessionStorage.setItem(
          VERIFY_KEY,
          JSON.stringify({ ...session, category, phase: "info" }),
        );
      }
      setPhase("info");
      setFormError(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  async function continueBusiness() {
    setShowInfoErrors(true);
    if (Object.keys(validateBusiness(info)).length > 0) return;
    const raw = window.sessionStorage.getItem(VERIFY_KEY);
    const session = raw ? (JSON.parse(raw) as VerifySession) : null;
    const email = (session?.email || fields.email).trim();
    const body = new FormData();
    body.set("email", email);
    body.set("businessName", info.businessName.trim());
    body.set("phone", info.phone.trim());
    body.set("description", info.description.trim());
    body.set("managerLastName", info.managerLastName.trim());
    body.set("managerFirstName", info.managerFirstName.trim());
    body.set("professionalEmail", info.professionalEmail.trim());
    body.set("address", info.address.trim());
    body.set("city", info.city.trim());
    body.set("hours", info.hours.trim());
    body.set("instagramUrl", info.instagramUrl.trim());
    body.set("tiktokUrl", info.tiktokUrl.trim());
    body.set("facebookUrl", info.facebookUrl.trim());
    if (logoFile) body.set("logo", logoFile);
    const coverToUpload =
      coverFile ??
      (coverPreview?.startsWith("data:image/")
        ? dataUrlToFile(coverPreview, info.coverName || "cover.jpg")
        : null);
    if (coverToUpload) body.set("cover", coverToUpload);
    setPending(true);
    setFormError(null);
    try {
      const saved = await postForm<{ logoName: string | null; coverName: string | null }>(
        "onboarding/business",
        body,
      );
      setInfo((current) => ({
        ...current,
        logoName: saved.logoName ?? current.logoName,
        coverName: saved.coverName ?? current.coverName,
      }));
      setLogoFile(null);
      setCoverFile(null);
      if (session) {
        window.sessionStorage.setItem(VERIFY_KEY, JSON.stringify({ ...session, phase: "contract" }));
      }
      setPhase("contract");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  async function continueContract() {
    if (contract.signedAt && contract.signature) {
      const raw = window.sessionStorage.getItem(VERIFY_KEY);
      if (raw) {
        const session = JSON.parse(raw) as VerifySession;
        window.sessionStorage.setItem(VERIFY_KEY, JSON.stringify({ ...session, phase: "template" }));
      }
      setPhase("template");
      setFormError(null);
      return;
    }
    if (!contract.accepted) {
      setFormError("Cochez la case pour accepter le contrat.");
      return;
    }
    if (!contract.signature) {
      setFormError("Signez dans le cadre.");
      return;
    }
    const raw = window.sessionStorage.getItem(VERIFY_KEY);
    const session = raw ? (JSON.parse(raw) as VerifySession) : null;
    const email = (session?.email || fields.email).trim();
    const image = await fetch(contract.signature);
    const blob = await image.blob();
    const body = new FormData();
    body.set("email", email);
    body.set("signature", new File([blob], "signature.png", { type: "image/png" }));
    setPending(true);
    setFormError(null);
    try {
      const saved = await postForm<{ signedAt: string }>("onboarding/contract", body);
      setContract((current) => ({ ...current, signedAt: saved.signedAt }));
      if (session) {
        window.sessionStorage.setItem(VERIFY_KEY, JSON.stringify({ ...session, phase: "template" }));
      }
      setPhase("template");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  function applyTemplate(templateId: TemplateId) {
    setTemplate((current) => ({ ...current, templateId, applied: true }));
    setFormError(null);
  }

  async function continueTemplate() {
    if (!template.applied) {
      setFormError("Choisissez un modèle pour continuer.");
      return;
    }
    const raw = window.sessionStorage.getItem(VERIFY_KEY);
    const session = raw ? (JSON.parse(raw) as VerifySession) : null;
    const email = (session?.email || fields.email).trim();
    setPending(true);
    setFormError(null);
    try {
      await postAuth("onboarding/template", {
        email,
        templateId: template.templateId,
        primary: template.primary,
        secondary: template.secondary,
      });
      if (session) {
        window.sessionStorage.setItem(VERIFY_KEY, JSON.stringify({ ...session, phase: "content" }));
      }
      setPhase("content");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  async function continueContent() {
    if (content.items.length === 0) {
      setFormError(contentCopy(category).emptyError);
      return;
    }
    const raw = window.sessionStorage.getItem(VERIFY_KEY);
    const session = raw ? (JSON.parse(raw) as VerifySession) : null;
    const email = (session?.email || fields.email).trim();
    setPending(true);
    setFormError(null);
    try {
      await postAuth("onboarding/content", {
        email,
        items: content.items.map((item) => ({
          name: item.name,
          priceXof: item.priceXof,
          tag: item.tag,
          image: item.image,
        })),
      });
      if (session) {
        window.sessionStorage.setItem(VERIFY_KEY, JSON.stringify({ ...session, phase: "preview" }));
      }
      setPhase("preview");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  async function continuePreview() {
    const raw = window.sessionStorage.getItem(VERIFY_KEY);
    const session = raw ? (JSON.parse(raw) as VerifySession) : null;
    const email = (session?.email || fields.email).trim();
    setPending(true);
    setFormError(null);
    try {
      await postAuth("onboarding/preview", { email });
      const published = await postAuth<{
        accessToken: string;
        refreshToken: string;
        name: string;
        slug: string;
        host: string;
        siteUrl: string;
        dashboardUrl?: string;
        dashboardHost?: string;
      }>("onboarding/publish", { email });
      storeSession(published.accessToken, published.refreshToken);
      const result = {
        name: published.name,
        slug: published.slug,
        host: published.host,
        siteUrl: published.siteUrl,
        dashboardUrl: published.dashboardUrl,
        dashboardHost: published.dashboardHost,
      };
      setPublish(result);
      window.localStorage.setItem("boutik.onboarding.publish", JSON.stringify(result));
      if (session) {
        window.sessionStorage.setItem(VERIFY_KEY, JSON.stringify({ ...session, phase: "publish" }));
      }
      setPhase("publish");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  function chooseLogo(file: File | undefined) {
    if (!file) return;
    const allowed = /\.(png|jpe?g|svg)$/i.test(file.name);
    if (!allowed) {
      setFormError("Le logo doit être un PNG, JPG ou SVG.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFormError("Le logo dépasse 5 Mo.");
      return;
    }
    setFormError(null);
    setLogoFile(file);
    setLogoPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
    setInfo((current) => ({ ...current, logoName: file.name }));
  }

  function chooseCover(file: File | undefined) {
    if (!file) return;
    const allowed = /\.(png|jpe?g|webp)$/i.test(file.name);
    if (!allowed) {
      setFormError("La photo de couverture doit être un PNG, JPG ou WEBP.");
      return;
    }
    if (file.size < 5 * 1024) {
      setFormError("La photo de couverture est trop petite (minimum 5 Ko).");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setFormError("La photo de couverture dépasse 8 Mo.");
      return;
    }
    setFormError(null);
    setCoverFile(file);
    const objectUrl = URL.createObjectURL(file);
    setCoverPreview((current) => {
      if (current?.startsWith("blob:")) URL.revokeObjectURL(current);
      return objectUrl;
    });
    setInfo((current) => ({ ...current, coverName: file.name }));
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        window.localStorage.setItem(COVER_PREVIEW_KEY, reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  const errors = showErrors ? validate(fields) : {};
  const infoErrors = showInfoErrors ? validateBusiness(info) : {};
  const stepIndex =
    phase === "publish"
      ? 7
      : phase === "preview"
        ? 6
        : phase === "content"
          ? 5
          : phase === "template"
            ? 4
            : phase === "contract"
              ? 3
              : phase === "info"
                ? 2
                : phase === "activity"
                  ? 1
                  : 0;

  return (
    <main className="min-h-screen bg-[#ececee] p-3 text-neutral-950 sm:p-4">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-[1440px] flex-col gap-3 md:flex-row sm:min-h-[calc(100vh-2rem)]">
        <aside className="flex w-full shrink-0 flex-col rounded-[28px] bg-[#161616] px-5 py-6 text-white md:w-[300px] md:px-6 md:py-7">
          <a href="/" className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight">
            <span className="grid size-8 place-items-center rounded-[9px] bg-black text-sm text-white">B</span>
            Boutik
          </a>
          <h1 className="mt-8 text-[26px] leading-[1.15] font-semibold tracking-tight">
            Créez votre site en quelques minutes
          </h1>
          <p className="mt-3 text-sm text-neutral-400">Étape {stepIndex + 1} sur 8</p>
          <div className="mt-6 h-px bg-white/10" />
          <ol className="mt-6 space-y-4">
            {STEPS.map((label, index) => {
              const done = index < stepIndex;
              const current = index === stepIndex;
              return (
                <li key={label} className="flex items-start gap-3">
                  <span
                    className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold ${
                      done || current ? "bg-white text-neutral-950" : "bg-[#2c2c2c] text-neutral-500"
                    }`}
                  >
                    {done ? <CheckIcon /> : index + 1}
                  </span>
                  <span>
                    <span className={`block text-sm font-medium ${done || current ? "text-white" : "text-neutral-500"}`}>
                      {label}
                    </span>
                    <span className="mt-0.5 block text-xs text-neutral-500">
                      {done ? "Terminé" : current ? "En cours" : "À faire"}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="mt-auto pt-8">
            <p className="flex items-center gap-2 text-xs whitespace-nowrap text-neutral-400">
              <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
              Brouillon enregistré automatiquement
            </p>
            <a
              href="/connexion"
              className="soft mt-4 block rounded-full bg-[#2a2a2a] px-4 py-2.5 text-center text-[13px] whitespace-nowrap text-neutral-100"
            >
              Quitter et reprendre plus tard
            </a>
          </div>
        </aside>

        <section className="rise relative flex min-h-[720px] flex-1 flex-col rounded-[28px] bg-white px-5 py-7 sm:px-10 sm:py-9">
          <button
            type="button"
            onClick={fillDemo}
            className="soft absolute top-7 right-5 rounded-full bg-neutral-100 px-3.5 py-1.5 text-[13px] font-medium text-neutral-600 sm:top-9 sm:right-10"
          >
            Remplir avec la démo
          </button>
          {phase === "publish" ? (
            <PublishStep
              result={publish}
              pending={pending}
              error={formError}
              onBack={() => {
                const raw = window.sessionStorage.getItem(VERIFY_KEY);
                if (raw) {
                  const session = JSON.parse(raw) as VerifySession;
                  window.sessionStorage.setItem(VERIFY_KEY, JSON.stringify({ ...session, phase: "preview" }));
                }
                setPhase("preview");
                setFormError(null);
              }}
            />
          ) : phase === "preview" ? (
            <PreviewStep
              template={template}
              items={content.items}
              businessName={info.businessName}
              category={category}
              coverUrl={coverPreview}
              pending={pending}
              error={formError}
              onBack={() => {
                const raw = window.sessionStorage.getItem(VERIFY_KEY);
                if (raw) {
                  const session = JSON.parse(raw) as VerifySession;
                  window.sessionStorage.setItem(VERIFY_KEY, JSON.stringify({ ...session, phase: "content" }));
                }
                setPhase("content");
                setFormError(null);
              }}
              onContinue={() => void continuePreview()}
            />
          ) : phase === "content" ? (
            <ContentStep
              draft={content}
              category={category}
              pending={pending}
              error={formError}
              onChange={(items) => setContent({ items })}
              onBack={() => {
                const raw = window.sessionStorage.getItem(VERIFY_KEY);
                if (raw) {
                  const session = JSON.parse(raw) as VerifySession;
                  window.sessionStorage.setItem(VERIFY_KEY, JSON.stringify({ ...session, phase: "template" }));
                }
                setPhase("template");
                setFormError(null);
              }}
              onContinue={() => void continueContent()}
            />
          ) : phase === "template" ? (
            <TemplateStep
              draft={template}
              businessName={info.businessName}
              coverUrl={coverPreview}
              pending={pending}
              error={formError}
              onChange={(next) => setTemplate((current) => ({ ...current, ...next }))}
              onApply={applyTemplate}
              onBack={() => {
                const raw = window.sessionStorage.getItem(VERIFY_KEY);
                if (raw) {
                  const session = JSON.parse(raw) as VerifySession;
                  window.sessionStorage.setItem(VERIFY_KEY, JSON.stringify({ ...session, phase: "contract" }));
                }
                setPhase("contract");
                setFormError(null);
              }}
              onContinue={() => void continueTemplate()}
            />
          ) : phase === "contract" ? (
            <ContractStep
              draft={contract}
              pending={pending}
              error={formError}
              onAccept={(accepted) => setContract((current) => ({ ...current, accepted }))}
              onSignature={(signature) => setContract((current) => ({ ...current, signature, signedAt: null }))}
              onBack={() => {
                const raw = window.sessionStorage.getItem(VERIFY_KEY);
                if (raw) {
                  const session = JSON.parse(raw) as VerifySession;
                  window.sessionStorage.setItem(VERIFY_KEY, JSON.stringify({ ...session, phase: "info" }));
                }
                setPhase("info");
                setFormError(null);
              }}
              onContinue={() => void continueContract()}
              onOpen={() => setContractOpen(true)}
            />
          ) : phase === "info" ? (
            <InfoStep
              draft={info}
              errors={infoErrors}
              pending={pending}
              error={formError}
              onChange={(key, value) => setInfo((current) => ({ ...current, [key]: value }))}
              onLogo={chooseLogo}
              logoPreview={logoPreview}
              onCover={chooseCover}
              coverPreview={coverPreview}
              onBack={() => {
                const raw = window.sessionStorage.getItem(VERIFY_KEY);
                if (raw) {
                  const session = JSON.parse(raw) as VerifySession;
                  window.sessionStorage.setItem(VERIFY_KEY, JSON.stringify({ ...session, phase: "activity" }));
                }
                setPhase("activity");
                setFormError(null);
              }}
              onContinue={() => void continueBusiness()}
            />
          ) : phase === "activity" ? (
            <ActivityStep
              category={category}
              pending={pending}
              error={formError}
              onSelect={setCategory}
              onBack={() => {
                setPhase("phone");
                setFormError(null);
              }}
              onContinue={() => void continueActivity()}
            />
          ) : phase === "phone" ? (
            <PhoneStep
              email={fields.email}
              phone={fields.phone}
              code={code}
              debugCode={debugCode}
              notice={notice}
              error={formError}
              pending={pending}
              confirmed={confirmed}
              resumed={accountCreated}
              onCode={setCode}
              onResend={() => void resend("sms")}
              onEmail={() => void resend("email")}
              onBack={() => {
                setPhase("account");
                setFormError(null);
                setNotice(null);
              }}
              onSubmit={(event) => void verify(event)}
            />
          ) : (
            <>
          <div className="pr-0 sm:pr-40">
            <h2 className="text-[32px] leading-none font-semibold tracking-tight">Créez votre compte</h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-neutral-500">
              Quelques informations pour sécuriser votre espace. Tous les champs sont obligatoires.
            </p>
          </div>

          <form className="mt-10 flex flex-1 flex-col" onSubmit={(event) => void submit(event)} noValidate>
            <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
              <Field
                label="Nom"
                name="lastName"
                autoComplete="family-name"
                value={fields.lastName}
                error={errors.lastName}
                onChange={(value) => update("lastName", value)}
              />
              <Field
                label="Prénom"
                name="firstName"
                autoComplete="given-name"
                value={fields.firstName}
                error={errors.firstName}
                onChange={(value) => update("firstName", value)}
              />
              <Field
                label="Email"
                name="email"
                type="email"
                autoComplete="email"
                value={fields.email}
                error={errors.email}
                onChange={(value) => update("email", value)}
              />
              <Field
                label="Téléphone"
                name="phone"
                type="tel"
                autoComplete="tel"
                placeholder="+225 ..."
                value={fields.phone}
                error={errors.phone}
                onChange={(value) => update("phone", value)}
              />
              <Field
                label="Mot de passe"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder="8 caractères minimum"
                value={fields.password}
                error={errors.password}
                onChange={(value) => update("password", value)}
              />
              <Field
                label="Confirmation du mot de passe"
                name="confirm"
                type="password"
                autoComplete="new-password"
                value={fields.confirm}
                error={errors.confirm}
                onChange={(value) => update("confirm", value)}
              />
            </div>

            <label className="mt-6 flex max-w-xl items-start gap-3 text-sm text-neutral-700">
              <input
                type="checkbox"
                name="terms"
                checked={fields.terms}
                onChange={(event) => update("terms", event.target.checked)}
                className="mt-0.5 size-4 rounded border-neutral-300 accent-neutral-950"
              />
              <span>J&apos;accepte les conditions générales et la politique de confidentialité</span>
            </label>
            {errors.terms ? <p className="mt-2 text-sm text-red-600">{errors.terms}</p> : null}
            {formError ? <p className="mt-4 text-sm text-red-600">{formError}</p> : null}

            <div className="mt-auto border-t border-neutral-100 pt-5">
              <button
                type="submit"
                disabled={pending}
                className="soft ml-auto flex items-center gap-2 rounded-full bg-neutral-950 px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
              >
                {pending ? "Création…" : "Créer mon compte"}
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </form>
            </>
          )}
        </section>
      </div>
      {contractOpen ? (
        <ContractDialog
          party={info.businessName.trim() || "le professionnel"}
          onClose={() => setContractOpen(false)}
          onAccept={() => {
            setContract((current) => ({ ...current, accepted: true }));
            setContractOpen(false);
          }}
        />
      ) : null}
    </main>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  error,
  type = "text",
  placeholder,
  autoComplete,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-neutral-800">{label}</span>
      <input
        name={name}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-2 w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-400 ${
          error ? "border-red-400" : "border-neutral-200"
        }`}
      />
      {error ? <span className="mt-1.5 block text-sm text-red-600">{error}</span> : null}
    </label>
  );
}

const ACTIVITIES: {
  id: Activity;
  title: string;
  text: string;
  image: string;
  features: string[];
  available: boolean;
}[] = [
  {
    id: "BOUTIQUE",
    title: "Boutique",
    text: "Présentez et vendez vos produits en ligne.",
    image: "/onboarding/boutique.jpg",
    features: ["Catalogue et fiches produits", "Panier et paiement", "Commandes, stock, clients"],
    available: true,
  },
  {
    id: "RESTAURANT",
    title: "Restaurant",
    text: "Présentez votre établissement, votre menu, et gérez réservations et commandes.",
    image: "/onboarding/restaurant.jpg",
    features: ["Menu avec catégories", "Réservations en ligne", "Commande à emporter"],
    available: false,
  },
  {
    id: "VITRINE",
    title: "Site vitrine",
    text: "Présentez votre entreprise, vos services ou votre activité.",
    image: "/onboarding/vitrine.jpg",
    features: ["Pages services et galerie", "Formulaire de devis", "Appel, WhatsApp, itinéraire"],
    available: false,
  },
];

function ActivityStep({
  category,
  pending,
  error,
  onSelect,
  onBack,
  onContinue,
}: {
  category: Activity;
  pending: boolean;
  error: string | null;
  onSelect: (category: Activity) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <>
      <div className="pr-0 sm:pr-44">
        <h2 className="text-[32px] leading-none font-semibold tracking-tight">Quelle est votre activité ?</h2>
        <p className="mt-3 text-sm text-neutral-500">Vous pourrez ajouter des fonctionnalités plus tard.</p>
      </div>

      <div className="mt-8 grid flex-1 content-start items-stretch gap-4 md:grid-cols-3">
        {ACTIVITIES.map((item) => {
          const selected = item.id === category;
          const disabled = !item.available;
          return (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (!disabled) onSelect(item.id);
              }}
              aria-pressed={selected}
              aria-disabled={disabled}
              title={disabled ? "Bientôt disponible" : undefined}
              className={`relative flex h-full min-w-0 flex-col rounded-[22px] border-2 bg-white p-3 text-left transition-colors ${
                disabled
                  ? "cursor-not-allowed border-neutral-200 opacity-45 grayscale"
                  : selected
                    ? "border-neutral-950"
                    : "border-neutral-200"
              }`}
            >
              {disabled ? (
                <span className="absolute top-5 right-5 z-10 rounded-full bg-neutral-950/80 px-2.5 py-1 text-[11px] font-semibold text-white">
                  Bientôt
                </span>
              ) : null}
              <img
                src={item.image}
                alt=""
                className="h-28 w-full rounded-xl object-cover object-center sm:h-36"
              />
              <span className="mt-4 px-1.5 text-[15px] font-semibold">{item.title}</span>
              <span className="mt-2 px-1.5 text-sm leading-relaxed break-words text-neutral-500">{item.text}</span>
              <ul className="mt-3 space-y-1.5 px-1.5">
                {item.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <CheckIcon className="mt-0.5" />
                    <span className="min-w-0 break-words">{feature}</span>
                  </li>
                ))}
              </ul>
              <span className="mt-auto block w-full px-1 pt-5 pb-1">
                <span
                  className={`block w-full rounded-full py-2.5 text-center text-sm font-medium ${
                    disabled
                      ? "bg-neutral-200 text-neutral-500"
                      : "bg-neutral-950 text-white"
                  }`}
                >
                  {disabled ? "Bientôt disponible" : selected ? "Sélectionné" : "Choisir"}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      <div className="mt-auto flex items-center justify-between border-t border-neutral-100 pt-5">
        <button
          type="button"
          onClick={onBack}
          className="soft rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800"
        >
          ← Retour
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onContinue}
          className="soft flex items-center gap-2 rounded-full bg-neutral-950 px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Enregistrement…" : "Continuer"}
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </>
  );
}

function ContractDialog({
  party,
  onClose,
  onAccept,
}: {
  party: string;
  onClose: () => void;
  onAccept: () => void;
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/45 p-4 print:bg-white">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="contract-title"
        className="contract-print max-h-[min(40rem,calc(100vh-2rem))] w-full max-w-xl overflow-y-auto rounded-3xl bg-white px-6 py-6 shadow-xl sm:px-8"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="contract-title" className="text-lg font-semibold tracking-tight">
            Contrat de service Boutik
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="grid size-8 place-items-center rounded-full text-neutral-500 print:hidden"
          >
            ×
          </button>
        </div>
        <p className="mt-2 text-sm text-neutral-500">Version du 1er septembre 2026 · entre Boutik SAS et {party}</p>
        <ol className="mt-5 space-y-3 text-sm leading-relaxed">
          {CONTRACT_DIALOG.map((article, index) => (
            <li key={article.title}>
              <span className="font-semibold">
                {index + 1}. {article.title}
              </span>{" "}
              {article.text}
            </li>
          ))}
        </ol>
        <div className="mt-6 flex items-center justify-end gap-3 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-full border border-neutral-200 px-4 py-2.5 text-sm font-medium"
          >
            Imprimer
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="rounded-full bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white"
          >
            J&apos;ai lu et j&apos;accepte
          </button>
        </div>
      </div>
    </div>
  );
}

function ContractStep({
  draft,
  pending,
  error,
  onAccept,
  onSignature,
  onBack,
  onContinue,
  onOpen,
}: {
  draft: ContractDraft;
  pending: boolean;
  error: string | null;
  onAccept: (accepted: boolean) => void;
  onSignature: (value: string | null) => void;
  onBack: () => void;
  onContinue: () => void;
  onOpen: () => void;
}) {
  const signed = Boolean(draft.signedAt && draft.signature);
  return (
    <>
      <div className="pr-0 sm:pr-44">
        <h2 className="text-[32px] leading-none font-semibold tracking-tight">Votre contrat Boutik</h2>
        <p className="mt-3 text-sm text-neutral-500">Lisez et signez le contrat de service pour continuer.</p>
      </div>

      <div className="mt-8 grid items-start gap-6 md:grid-cols-[minmax(0,1.15fr)_minmax(14rem,0.85fr)]">
        <article className="rounded-2xl bg-neutral-50 px-5 py-5 text-sm leading-relaxed sm:px-6">
          <h3 className="font-semibold">Contrat de service Boutik</h3>
          <div className="mt-4 space-y-3 text-neutral-800">
            {CONTRACT_SUMMARY.map((article) => (
              <p key={article.title}>
                <span className="font-semibold">{article.title} </span>
                {article.text}
              </p>
            ))}
          </div>
        </article>

        <div>
          <button
            type="button"
            onClick={onOpen}
            className="soft block w-full rounded-full border border-neutral-200 px-4 py-2.5 text-center text-sm font-medium"
          >
            Consulter le contrat complet (PDF)
          </button>
          <label className="mt-5 flex items-start gap-3 text-sm text-neutral-800">
            <input
              type="checkbox"
              checked={draft.accepted}
              disabled={signed}
              onChange={(event) => onAccept(event.target.checked)}
              className="mt-0.5 size-4 rounded border-neutral-300 accent-neutral-950"
            />
            <span>J&apos;ai lu et j&apos;accepte le contrat</span>
          </label>
          <div className="mt-5">
            {signed && draft.signature ? (
              <img src={draft.signature} alt="Signature" className="h-32 w-full rounded-xl border border-neutral-200 bg-white object-contain" />
            ) : (
              <SignaturePad value={draft.signature} onChange={onSignature} />
            )}
          </div>
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      <div className="mt-auto flex items-center justify-between border-t border-neutral-100 pt-5">
        <button
          type="button"
          onClick={onBack}
          className="soft rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800"
        >
          ← Retour
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onContinue}
          className="soft flex items-center gap-2 rounded-full bg-neutral-950 px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
        >
          Continuer
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </>
  );
}

function SignaturePad({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const ink = useRef(Boolean(value));
  const ratioRef = useRef(1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    ratioRef.current = ratio;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(ratio, ratio);
    context.lineWidth = 2.2;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#171717";
    if (!value) return;
    const image = new Image();
    image.onload = () => context.drawImage(image, 0, 0, width, height);
    image.src = value;
    // The saved image is drawn once. Later strokes stay on this canvas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    drawing.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    const next = point(event);
    context.beginPath();
    context.moveTo(next.x, next.y);
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    const next = point(event);
    context.lineTo(next.x, next.y);
    context.stroke();
    ink.current = true;
  }

  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    if (canvas && ink.current) onChange(canvas.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.scale(ratioRef.current, ratioRef.current);
    context.lineWidth = 2.2;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#171717";
    ink.current = false;
    onChange(null);
  }

  return (
    <div className="relative h-32 overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div className="pointer-events-none absolute right-[12%] bottom-8 left-[12%] border-b border-neutral-200" />
      <canvas
        ref={canvasRef}
        aria-label="Signature"
        className="relative h-full w-full touch-none"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      />
      {value ? (
        <button type="button" onClick={clear} className="absolute top-2 right-3 text-xs font-medium text-neutral-500">
          Effacer
        </button>
      ) : null}
    </div>
  );
}

function InfoStep({
  draft,
  errors,
  pending,
  error,
  onChange,
  onLogo,
  logoPreview,
  onCover,
  coverPreview,
  onBack,
  onContinue,
}: {
  draft: BusinessDraft;
  errors: Partial<Record<keyof BusinessDraft, string>>;
  pending: boolean;
  error: string | null;
  onChange: (key: keyof BusinessDraft, value: string) => void;
  onLogo: (file: File | undefined) => void;
  logoPreview: string | null;
  onCover: (file: File | undefined) => void;
  coverPreview: string | null;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <>
      <div className="pr-0 sm:pr-44">
        <h2 className="text-[32px] leading-none font-semibold tracking-tight">Parlez-nous de votre activité</h2>
        <p className="mt-3 text-sm text-neutral-500">
          Les champs marqués * sont obligatoires, le reste peut être complété plus tard.
        </p>
      </div>

      <div className="mt-8 grid gap-x-8 gap-y-5">
        <div className="grid gap-x-8 gap-y-5 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,0.9fr)]">
          <InfoField
            label="Nom de l'entreprise / activité *"
            value={draft.businessName}
            error={errors.businessName}
            onChange={(value) => onChange("businessName", value)}
          />
          <InfoField
            label="Téléphone *"
            value={draft.phone}
            error={errors.phone}
            onChange={(value) => onChange("phone", value)}
          />
        </div>

        <label className="block">
          <span className="text-sm font-medium text-neutral-800">Description</span>
          <span className="mt-0.5 block text-xs text-neutral-400">facultatif</span>
          <textarea
            rows={2}
            value={draft.description}
            onChange={(event) => onChange("description", event.target.value)}
            className="mt-2 w-full resize-y rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-400"
          />
        </label>

        <div className="grid gap-x-8 gap-y-5 md:grid-cols-3">
          <InfoField
            label="Nom du gérant"
            value={draft.managerLastName}
            onChange={(value) => onChange("managerLastName", value)}
          />
          <InfoField
            label="Prénom du gérant"
            value={draft.managerFirstName}
            onChange={(value) => onChange("managerFirstName", value)}
          />
          <InfoField
            label="Email professionnel"
            type="email"
            value={draft.professionalEmail}
            error={errors.professionalEmail}
            onChange={(value) => onChange("professionalEmail", value)}
          />
        </div>

        <div className="grid gap-x-8 gap-y-5 md:grid-cols-3">
          <InfoField label="Adresse" value={draft.address} onChange={(value) => onChange("address", value)} />
          <InfoField label="Ville / localisation" value={draft.city} onChange={(value) => onChange("city", value)} />
          <InfoField
            label="Horaires"
            value={draft.hours}
            placeholder="Lun – Sam · 9 h – 19 h"
            onChange={(value) => onChange("hours", value)}
          />
        </div>

        <div className="grid gap-x-8 gap-y-5 md:grid-cols-3">
          <InfoField
            label="Instagram"
            value={draft.instagramUrl}
            placeholder="https://instagram.com/votrecompte"
            onChange={(value) => onChange("instagramUrl", value)}
          />
          <InfoField
            label="TikTok"
            value={draft.tiktokUrl}
            placeholder="https://tiktok.com/@votrecompte"
            onChange={(value) => onChange("tiktokUrl", value)}
          />
          <InfoField
            label="Facebook"
            value={draft.facebookUrl}
            placeholder="https://facebook.com/votrepage"
            onChange={(value) => onChange("facebookUrl", value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FileDrop
            title="Logo"
            hint={draft.logoName || "Importer votre logo (PNG, JPG, SVG)"}
            accept="image/png,image/jpeg,image/svg+xml,.png,.jpg,.jpeg,.svg"
            preview={logoPreview}
            onFile={onLogo}
          />
          <FileDrop
            title="Photo couverture"
            hint={draft.coverName || "Image du hero de votre site (PNG, JPG, WEBP)"}
            accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
            preview={coverPreview}
            previewFit="cover"
            onFile={onCover}
          />
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      <div className="mt-auto flex items-center justify-between border-t border-neutral-100 pt-5">
        <button
          type="button"
          onClick={onBack}
          className="soft rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800"
        >
          ← Retour
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onContinue}
          className="soft flex items-center gap-2 rounded-full bg-neutral-950 px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Enregistrement…" : "Continuer"}
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </>
  );
}

function InfoField({
  label,
  value,
  onChange,
  error,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-sm font-medium text-neutral-800">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-2 w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-400 ${
          error ? "border-red-400" : "border-neutral-200"
        }`}
      />
      {error ? <span className="mt-1.5 block text-sm text-red-600">{error}</span> : null}
    </label>
  );
}

function FileDrop({
  title,
  hint,
  accept,
  preview,
  previewFit = "contain",
  onFile,
}: {
  title: string;
  hint: string;
  accept: string;
  preview?: string | null;
  previewFit?: "contain" | "cover";
  onFile: (file: File | undefined) => void;
}) {
  return (
    <label
      className="flex min-h-36 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-neutral-300 px-4 py-5 text-center"
      style={{ background: "repeating-linear-gradient(-45deg, #f7f7f7 0 8px, #efefef 8px 16px)" }}
    >
      <input
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(event) => {
          onFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {preview ? (
        <img
          src={preview}
          alt=""
          className={`max-h-28 w-full ${previewFit === "cover" ? "rounded-xl object-cover" : "object-contain"}`}
        />
      ) : (
        <>
          <span className="text-sm font-semibold">{title}</span>
          <span className="mt-1 text-xs leading-relaxed text-neutral-500">{hint}</span>
        </>
      )}
    </label>
  );
}

function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={`size-4 shrink-0 ${className}`} aria-hidden="true">
      <path
        d="M3.2 8.2 6.4 11.3 12.8 4.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PhoneStep({
  email,
  phone,
  code,
  debugCode,
  notice,
  error,
  pending,
  confirmed,
  resumed,
  onCode,
  onResend,
  onEmail,
  onBack,
  onSubmit,
}: {
  email: string;
  phone: string;
  code: string;
  debugCode: string | null;
  notice: string | null;
  error: string | null;
  pending: boolean;
  confirmed: boolean;
  resumed: boolean;
  onCode: (value: string) => void;
  onResend: () => void;
  onEmail: () => void;
  onBack: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <>
      <div className="pr-0 sm:max-w-xl sm:pr-44">
        <h2 className="text-[32px] leading-none font-semibold tracking-tight">Vérifiez votre téléphone</h2>
        <p className="mt-3 text-sm leading-relaxed text-neutral-500">
          {resumed
            ? `Pour continuer, saisissez le code envoyé au ${maskPhone(phone)} et à ${maskEmail(email)}. Vous pouvez le renvoyer.`
            : `Nous avons envoyé un code à 6 chiffres au ${maskPhone(phone)} et à ${maskEmail(email)}.`}
        </p>
      </div>

      <form className="mt-8 flex flex-1 flex-col" onSubmit={onSubmit}>
        <label className="relative block max-w-sm">
          <span className="sr-only">Code à 6 chiffres</span>
          <span
            className={`flex h-14 items-center justify-center gap-3 rounded-xl border bg-white ${
              error ? "border-red-400" : "border-neutral-200"
            }`}
          >
            {Array.from({ length: 6 }, (_, index) => (
              <span
                key={index}
                className={`w-5 text-center text-xl font-semibold tracking-normal ${
                  code[index] ? "text-neutral-950" : "text-neutral-300"
                }`}
              >
                {code[index] ?? "•"}
              </span>
            ))}
          </span>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            aria-invalid={error ? true : undefined}
            onChange={(event) => onCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            className="absolute inset-0 cursor-text opacity-0"
          />
        </label>

        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-500">
          {debugCode ? <span>Code de démonstration : {debugCode}</span> : null}
          {debugCode ? <span aria-hidden="true">·</span> : null}
          <button
            type="button"
            disabled={pending || confirmed}
            onClick={onResend}
            className="font-medium text-neutral-950 underline-offset-2 hover:underline disabled:opacity-50"
          >
            Renvoyer le code
          </button>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            disabled={pending || confirmed}
            onClick={onEmail}
            className="font-medium text-neutral-950 underline-offset-2 hover:underline disabled:opacity-50"
          >
            Envoyer le code par mail
          </button>
        </p>
        {notice ? <p className="mt-2 text-sm text-neutral-700">{notice}</p> : null}
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

        <div className="mt-auto flex items-center justify-between border-t border-neutral-100 pt-5">
          {resumed ? (
            <span />
          ) : (
            <button
              type="button"
              onClick={onBack}
              className="soft rounded-full border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800"
            >
              ← Retour
            </button>
          )}
          <button
            type="submit"
            disabled={pending || confirmed}
            className="soft flex items-center gap-2 rounded-full bg-neutral-950 px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
          >
            {confirmed ? "Téléphone confirmé" : pending ? "Vérification…" : "Vérifier le code"}
            {confirmed ? null : <span aria-hidden="true">→</span>}
          </button>
        </div>
      </form>
    </>
  );
}

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.slice(-2) || "••";
}

function maskEmail(email: string) {
  const [local, domain] = email.trim().split("@");
  if (!local || !domain) return email;
  const [name, ...rest] = domain.split(".");
  const suffix = rest.length > 0 ? `.${rest.join(".")}` : "";
  return `${local.slice(0, 2)}@${(name ?? "").slice(0, 1)}${suffix}`;
}

async function postAuth<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/auth/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Le serveur ne répond pas.");
  }

  let payload: {
    ok?: boolean;
    data?: T;
    error?: { message?: string; details?: { messages?: string[] }[] };
  };
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    throw new Error("Réponse du serveur illisible.");
  }

  if (!payload.ok) {
    const detail = payload.error?.details?.find((item) => item.messages?.[0])?.messages?.[0];
    throw new Error(detail || payload.error?.message || "Une erreur est survenue.");
  }

  return payload.data as T;
}

async function postForm<T>(path: string, body: FormData): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/auth/${path}`, { method: "POST", body });
  } catch {
    throw new Error("Le serveur ne répond pas.");
  }
  let payload: {
    ok?: boolean;
    data?: T;
    error?: { message?: string; details?: { messages?: string[] }[] };
  };
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    throw new Error("Réponse du serveur illisible.");
  }
  if (!payload.ok) {
    const detail = payload.error?.details?.find((item) => item.messages?.[0])?.messages?.[0];
    throw new Error(detail || payload.error?.message || "Une erreur est survenue.");
  }
  return payload.data as T;
}

function validateBusiness(draft: BusinessDraft) {
  const errors: Partial<Record<keyof BusinessDraft, string>> = {};
  if (draft.businessName.trim().length < 2) errors.businessName = "Indiquez le nom de l'entreprise";
  if (draft.phone.replace(/\D/g, "").length < 8) errors.phone = "Indiquez un numéro de téléphone";
  if (draft.professionalEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.professionalEmail.trim())) {
    errors.professionalEmail = "Adresse e-mail invalide";
  }
  return errors;
}

function validate(fields: Fields) {
  const errors: Partial<Record<keyof Fields, string>> = {};
  if (fields.lastName.trim().length < 2) errors.lastName = "Indiquez votre nom.";
  if (fields.firstName.trim().length < 2) errors.firstName = "Indiquez votre prénom.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) errors.email = "Adresse e-mail invalide.";
  if (fields.phone.replace(/\D/g, "").length < 8) errors.phone = "Indiquez votre numéro de téléphone.";
  if (fields.password.length < 8) errors.password = "8 caractères minimum.";
  if (fields.confirm !== fields.password) errors.confirm = "Les mots de passe ne correspondent pas.";
  if (!fields.terms) errors.terms = "Acceptez les conditions pour continuer.";
  return errors;
}

function dataUrlToFile(dataUrl: string, filename: string): File | null {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) return null;
  const mime = match[1]!;
  const raw = match[2]!;
  try {
    const binary = atob(raw);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const ext = mime.includes("webp") ? "webp" : mime.includes("png") ? "png" : "jpg";
    const safeName = filename.trim() || `cover.${ext}`;
    return new File([bytes], safeName, { type: mime });
  } catch {
    return null;
  }
}
