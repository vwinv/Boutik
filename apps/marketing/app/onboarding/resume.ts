const DRAFT_KEY = "boutik.onboarding.account";
const INFO_KEY = "boutik.onboarding.info";
const COVER_PREVIEW_KEY = "boutik.onboarding.coverPreview";
const CONTRACT_KEY = "boutik.onboarding.contract";
const TEMPLATE_KEY = "boutik.onboarding.template";
const CONTENT_KEY = "boutik.onboarding.content";
const VERIFY_KEY = "boutik.onboarding.verify";
export const AUTH_KEY = "boutik.auth";

export type OnboardingResume = {
  phase: "phone" | "activity" | "info" | "contract" | "template" | "content" | "preview" | "publish";
  category: "VITRINE" | "RESTAURANT" | "BOUTIQUE" | null;
  name: string;
  email: string;
  phone: string | null;
  profile: {
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
    coverPreview: string;
    signature: string;
    signedAt: string | null;
    templateId: "eclat" | "minimal" | "atelier" | "nocturne" | null;
    primary: string;
    secondary: string;
    contentItems: { name: string; priceXof: number; tag?: string; image?: string }[];
    publishedSlug: string | null;
    publishedAt: string | null;
  };
};

export function storeSession(accessToken: string, refreshToken: string) {
  const payload = JSON.stringify({ accessToken, refreshToken });
  window.localStorage.setItem(AUTH_KEY, payload);
  window.sessionStorage.setItem(AUTH_KEY, payload);
}

export function storeResume(resume: OnboardingResume) {
  const [firstName, ...rest] = resume.name.trim().split(/\s+/);
  const accountRaw = window.localStorage.getItem(DRAFT_KEY);
  let sameAccount = false;
  if (accountRaw) {
    try {
      const saved = JSON.parse(accountRaw) as { email?: string };
      sameAccount = saved.email?.trim().toLowerCase() === resume.email.trim().toLowerCase();
    } catch {
      sameAccount = false;
    }
  }

  window.localStorage.setItem(
    DRAFT_KEY,
    JSON.stringify({
      firstName: firstName ?? "",
      lastName: rest.join(" "),
      email: resume.email,
      phone: resume.phone ?? "",
      terms: true,
    }),
  );
  window.sessionStorage.setItem(
    VERIFY_KEY,
    JSON.stringify({
      email: resume.email,
      phone: resume.phone ?? "",
      debugCode: null,
      confirmed: resume.phase !== "phone",
      category: resume.category ?? undefined,
      phase: resume.phase,
      accountCreated: true,
    }),
  );

  if (resume.profile.businessName) {
    window.localStorage.setItem(
      INFO_KEY,
      JSON.stringify({
        businessName: resume.profile.businessName,
        phone: resume.profile.phone,
        description: resume.profile.description,
        managerLastName: resume.profile.managerLastName,
        managerFirstName: resume.profile.managerFirstName,
        professionalEmail: resume.profile.professionalEmail,
        address: resume.profile.address,
        city: resume.profile.city,
        hours: resume.profile.hours,
        instagramUrl: resume.profile.instagramUrl,
        tiktokUrl: resume.profile.tiktokUrl,
        facebookUrl: resume.profile.facebookUrl,
        logoName: resume.profile.logoName,
        coverName: resume.profile.coverName,
      }),
    );
    if (resume.profile.coverPreview) {
      window.localStorage.setItem(COVER_PREVIEW_KEY, resume.profile.coverPreview);
    } else if (!sameAccount) {
      window.localStorage.removeItem(COVER_PREVIEW_KEY);
    }
  } else if (!sameAccount) {
    window.localStorage.removeItem(INFO_KEY);
    window.localStorage.removeItem(COVER_PREVIEW_KEY);
  }

  if (resume.profile.signedAt) {
    window.localStorage.setItem(
      CONTRACT_KEY,
      JSON.stringify({
        accepted: true,
        signature: resume.profile.signature,
        signedAt: resume.profile.signedAt,
      }),
    );
  } else if (!sameAccount) {
    window.localStorage.removeItem(CONTRACT_KEY);
  }

  if (resume.profile.templateId) {
    window.localStorage.setItem(
      TEMPLATE_KEY,
      JSON.stringify({
        templateId: resume.profile.templateId,
        primary: resume.profile.primary || "#111111",
        secondary: resume.profile.secondary || "#111111",
        applied: true,
      }),
    );
  } else if (!sameAccount) {
    window.localStorage.removeItem(TEMPLATE_KEY);
  }

  if (resume.profile.contentItems?.length) {
    window.localStorage.setItem(
      CONTENT_KEY,
      JSON.stringify({
        items: resume.profile.contentItems.map((item, index) => ({
          id: `resume_${index}`,
          name: item.name,
          priceXof: item.priceXof,
          tag: item.tag || "Produits",
          image: item.image || null,
        })),
      }),
    );
  } else if (!sameAccount) {
    window.localStorage.removeItem(CONTENT_KEY);
  }

  if (resume.profile.publishedSlug) {
    const slug = resume.profile.publishedSlug;
    window.localStorage.setItem(
      "boutik.onboarding.publish",
      JSON.stringify({
        name: resume.profile.businessName,
        slug,
        host: `${slug}.localhost:3000`,
        siteUrl: `http://${slug}.localhost:3000`,
        dashboardUrl: `http://admin.${slug}.localhost:3000`,
        dashboardHost: `admin.${slug}.localhost:3000`,
      }),
    );
  } else if (!sameAccount) {
    window.localStorage.removeItem("boutik.onboarding.publish");
  }
}
