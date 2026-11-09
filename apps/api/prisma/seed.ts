import { MembershipRole, PrismaClient, StaffRole, TenantStatus } from "@prisma/client";
import { hash } from "bcryptjs";
import {
  CATEGORY_DESCRIPTIONS,
  CATEGORY_LABELS,
  defaultOpeningHours,
  defaultReservationHours,
  defaultSitePages,
  isReservedSlug,
} from "@boutik/domain";

const prisma = new PrismaClient();

async function seedCatalog() {
  const categories = [
    { code: "VITRINE" as const, sortOrder: 1 },
    { code: "RESTAURANT" as const, sortOrder: 2 },
    { code: "BOUTIQUE" as const, sortOrder: 3 },
  ];

  for (const item of categories) {
    await prisma.siteCategory.upsert({
      where: { code: item.code },
      update: {
        label: CATEGORY_LABELS[item.code],
        description: CATEGORY_DESCRIPTIONS[item.code],
        isActive: true,
        sortOrder: item.sortOrder,
      },
      create: {
        code: item.code,
        label: CATEGORY_LABELS[item.code],
        description: CATEGORY_DESCRIPTIONS[item.code],
        isActive: true,
        sortOrder: item.sortOrder,
      },
    });
  }

  const subcategories = [
    { category: "VITRINE" as const, slug: "artisan", name: "Artisan", description: "Atelier, créateur, métier d'art" },
    { category: "VITRINE" as const, slug: "profession-liberale", name: "Profession libérale", description: "Cabinet, consultant, indépendant" },
    { category: "VITRINE" as const, slug: "association", name: "Association", description: "Organisation, collectif" },
    { category: "RESTAURANT" as const, slug: "restaurant", name: "Restaurant", description: "Table, brasserie, gastronomie" },
    { category: "RESTAURANT" as const, slug: "fast-food", name: "Restauration rapide", description: "Street food, snacks" },
    { category: "RESTAURANT" as const, slug: "traiteur", name: "Traiteur", description: "Événementiel et livraison" },
    { category: "BOUTIQUE" as const, slug: "mode", name: "Mode", description: "Prêt-à-porter et accessoires" },
    { category: "BOUTIQUE" as const, slug: "alimentaire", name: "Alimentaire", description: "Épicerie, produits locaux" },
    { category: "BOUTIQUE" as const, slug: "artisanat", name: "Artisanat", description: "Objets faits main" },
  ];

  for (const [index, item] of subcategories.entries()) {
    await prisma.siteSubcategory.upsert({
      where: { category_slug: { category: item.category, slug: item.slug } },
      update: { name: item.name, description: item.description, isActive: true, sortOrder: index },
      create: { ...item, isActive: true, sortOrder: index },
    });
  }

  const plans = [
    {
      slug: "vitrine-starter",
      name: "Découverte",
      description: "Offre d’entrée — présentation et limites de base",
      category: "VITRINE" as const,
      isDefault: true,
      includesPremiumTemplates: false,
      sortOrder: 1,
      capabilities: ["pages", "gallery", "contact", "seo", "theme", "hours"],
      prices: [
        { interval: "MONTHLY" as const, amountXof: 0 },
        { interval: "YEARLY" as const, amountXof: 0 },
      ],
      options: [],
    },
    {
      slug: "vitrine-pro",
      name: "Pro",
      description: "Offre Pro — plus de capacité et modèles premium",
      category: "VITRINE" as const,
      isDefault: false,
      includesPremiumTemplates: true,
      sortOrder: 2,
      capabilities: ["pages", "gallery", "contact", "seo", "theme", "hours", "reservations"],
      prices: [
        { interval: "MONTHLY" as const, amountXof: 9900 },
        { interval: "YEARLY" as const, amountXof: 99000 },
      ],
      options: [],
    },
    {
      slug: "vitrine-business",
      name: "Business",
      description: "Offre Business — volume et collaborateurs étendus",
      category: "VITRINE" as const,
      isDefault: false,
      includesPremiumTemplates: true,
      sortOrder: 3,
      capabilities: ["pages", "gallery", "contact", "seo", "theme", "hours", "reservations"],
      prices: [
        { interval: "MONTHLY" as const, amountXof: 24900 },
        { interval: "YEARLY" as const, amountXof: 249000 },
      ],
      options: [],
    },
    {
      slug: "restaurant-starter",
      name: "Découverte",
      description: "Offre d’entrée — présentation et limites de base",
      category: "RESTAURANT" as const,
      isDefault: true,
      includesPremiumTemplates: false,
      sortOrder: 1,
      capabilities: ["pages", "gallery", "contact", "seo", "theme", "menu", "hours"],
      prices: [
        { interval: "MONTHLY" as const, amountXof: 0 },
        { interval: "YEARLY" as const, amountXof: 0 },
      ],
      options: [],
    },
    {
      slug: "restaurant-pro",
      name: "Pro",
      description: "Offre Pro — plus de capacité et modèles premium",
      category: "RESTAURANT" as const,
      isDefault: false,
      includesPremiumTemplates: true,
      sortOrder: 2,
      capabilities: ["pages", "gallery", "contact", "seo", "theme", "menu", "hours", "reservations"],
      prices: [
        { interval: "MONTHLY" as const, amountXof: 9900 },
        { interval: "YEARLY" as const, amountXof: 99000 },
      ],
      options: [],
    },
    {
      slug: "restaurant-business",
      name: "Business",
      description: "Offre Business — volume et collaborateurs étendus",
      category: "RESTAURANT" as const,
      isDefault: false,
      includesPremiumTemplates: true,
      sortOrder: 3,
      capabilities: [
        "pages",
        "gallery",
        "contact",
        "seo",
        "theme",
        "menu",
        "hours",
        "reservations",
        "click_collect",
        "wallet",
        "customers",
      ],
      prices: [
        { interval: "MONTHLY" as const, amountXof: 24900 },
        { interval: "YEARLY" as const, amountXof: 249000 },
      ],
      options: [],
    },
    {
      slug: "boutique-starter",
      name: "Découverte",
      description: "Offre d’entrée — présentation et limites de base",
      category: "BOUTIQUE" as const,
      isDefault: true,
      includesPremiumTemplates: false,
      sortOrder: 1,
      capabilities: ["pages", "gallery", "contact", "seo", "theme", "catalog"],
      prices: [
        { interval: "MONTHLY" as const, amountXof: 0 },
        { interval: "YEARLY" as const, amountXof: 0 },
      ],
      options: [],
    },
    {
      slug: "boutique-pro",
      name: "Pro",
      description: "Offre Pro — plus de capacité et modèles premium",
      category: "BOUTIQUE" as const,
      isDefault: false,
      includesPremiumTemplates: true,
      sortOrder: 2,
      capabilities: [
        "pages",
        "gallery",
        "contact",
        "seo",
        "theme",
        "catalog",
        "cart",
        "checkout",
        "stock",
        "orders",
        "wallet",
        "customers",
      ],
      prices: [
        { interval: "MONTHLY" as const, amountXof: 9900 },
        { interval: "YEARLY" as const, amountXof: 99000 },
      ],
      options: [],
    },
    {
      slug: "boutique-business",
      name: "Business",
      description: "Offre Business — volume et collaborateurs étendus",
      category: "BOUTIQUE" as const,
      isDefault: false,
      includesPremiumTemplates: true,
      sortOrder: 3,
      capabilities: [
        "pages",
        "gallery",
        "contact",
        "seo",
        "theme",
        "catalog",
        "cart",
        "checkout",
        "stock",
        "orders",
        "wallet",
        "customers",
      ],
      prices: [
        { interval: "MONTHLY" as const, amountXof: 24900 },
        { interval: "YEARLY" as const, amountXof: 249000 },
      ],
      options: [],
    },
  ];

  for (const item of plans) {
    const isActive = "isActive" in item && item.isActive === false ? false : true;
    const limits = planLimitsFor(item.slug, item.category);
    const plan = await prisma.plan.upsert({
      where: { slug: item.slug },
      update: {
        name: item.name,
        description: item.description,
        category: item.category,
        isActive,
        isDefault: item.isDefault,
        includesPremiumTemplates: item.includesPremiumTemplates,
        sortOrder: item.sortOrder,
        capabilities: item.capabilities,
        commissionPct: limits.commissionPct,
        maxCatalogItems: limits.maxCatalogItems,
        maxCollaborators: limits.maxCollaborators,
        maxAppointments: limits.maxAppointments,
        graceDays: 7,
        expiredRestriction: "READ_ONLY",
      },
      create: {
        slug: item.slug,
        name: item.name,
        description: item.description,
        category: item.category,
        isActive,
        isDefault: item.isDefault,
        includesPremiumTemplates: item.includesPremiumTemplates,
        sortOrder: item.sortOrder,
        capabilities: item.capabilities,
        commissionPct: limits.commissionPct,
        maxCatalogItems: limits.maxCatalogItems,
        maxCollaborators: limits.maxCollaborators,
        maxAppointments: limits.maxAppointments,
        graceDays: 7,
        expiredRestriction: "READ_ONLY",
      },
    });

    for (const price of item.prices) {
      await prisma.planPrice.upsert({
        where: { planId_interval: { planId: plan.id, interval: price.interval } },
        update: { amountXof: price.amountXof, isActive: true },
        create: { planId: plan.id, interval: price.interval, amountXof: price.amountXof, isActive: true },
      });
    }

    // Désactive les anciennes options à la carte (offres packagées).
    await prisma.planOption.updateMany({
      where: { planId: plan.id, slug: { notIn: item.options.map((option) => option.slug) } },
      data: { isActive: false },
    });

    for (const [index, option] of item.options.entries()) {
      await prisma.planOption.upsert({
        where: { planId_slug: { planId: plan.id, slug: option.slug } },
        update: {
          name: option.name,
          amountXof: option.amountXof,
          capability: option.capability,
          isActive: true,
          sortOrder: index,
        },
        create: {
          planId: plan.id,
          slug: option.slug,
          name: option.name,
          amountXof: option.amountXof,
          capability: option.capability,
          isActive: true,
          sortOrder: index,
        },
      });
    }
  }

  const templates = [
    {
      slug: "vitrine-atelier",
      name: "Atelier",
      description: "Modèle clair pour un artisan.",
      isPremium: false,
      categories: ["VITRINE" as const],
    },
    {
      slug: "vitrine-studio",
      name: "Studio",
      description: "Mise en page éditoriale premium.",
      isPremium: true,
      categories: ["VITRINE" as const],
    },
    {
      slug: "resto-terrasse",
      name: "Terrasse",
      description: "Carte et ambiance pour un restaurant.",
      isPremium: false,
      categories: ["RESTAURANT" as const],
    },
    {
      slug: "resto-noir",
      name: "Noir gastronomie",
      description: "Template premium contrasté.",
      isPremium: true,
      categories: ["RESTAURANT" as const],
    },
    {
      slug: "boutique-souk",
      name: "Souk",
      description: "Grille produit pour une boutique.",
      isPremium: false,
      categories: ["BOUTIQUE" as const],
    },
    {
      slug: "boutique-luxe",
      name: "Luxe",
      description: "Template e-commerce premium.",
      isPremium: true,
      categories: ["BOUTIQUE" as const, "VITRINE" as const],
    },
  ];

  for (const [index, item] of templates.entries()) {
    const template = await prisma.siteTemplate.upsert({
      where: { slug: item.slug },
      update: {
        name: item.name,
        description: item.description,
        isPremium: item.isPremium,
        isActive: true,
        sortOrder: index,
      },
      create: {
        slug: item.slug,
        name: item.name,
        description: item.description,
        isPremium: item.isPremium,
        isActive: true,
        sortOrder: index,
      },
    });
    await prisma.templateCategory.deleteMany({ where: { templateId: template.id } });
    await prisma.templateCategory.createMany({
      data: item.categories.map((category) => ({ templateId: template.id, category })),
    });
  }
}

async function main() {
  const passwordHash = await hash("changeme", 10);
  const verifiedAt = new Date();
  await seedCatalog();

  const staff = await prisma.user.upsert({
    where: { email: "admin@boutik.local" },
    update: {
      passwordHash,
      staffRole: StaffRole.OWNER,
      staffStatus: "ACTIVE",
      staffTwoFaEnabled: true,
      emailVerifiedAt: verifiedAt,
      name: "Aminata Koné",
    },
    create: {
      email: "admin@boutik.local",
      name: "Aminata Koné",
      passwordHash,
      staffRole: StaffRole.OWNER,
      staffStatus: "ACTIVE",
      staffTwoFaEnabled: true,
      emailVerifiedAt: verifiedAt,
    },
  });

  const tenants = [
    {
      slug: "atelier",
      name: "Atelier Nord",
      category: "VITRINE" as const,
      ownerEmail: "lea@atelier.local",
      ownerName: "Léa Martin",
      jobTitle: "Créatrice",
      legalName: "Atelier Nord",
      city: "Dakar",
      planSlug: "vitrine-pro",
      templateSlug: "vitrine-studio",
      subcategorySlug: "artisan",
    },
    {
      slug: "table",
      name: "La Table de Claire",
      category: "RESTAURANT" as const,
      ownerEmail: "claire@table.local",
      ownerName: "Claire Dupont",
      jobTitle: "Cheffe",
      legalName: "La Table de Claire",
      city: "Dakar",
      planSlug: "restaurant-pro",
      templateSlug: "resto-terrasse",
      subcategorySlug: "restaurant",
    },
    {
      slug: "marie",
      name: "Chez Marie",
      category: "BOUTIQUE" as const,
      ownerEmail: "marie@marie.local",
      ownerName: "Marie Bernard",
      jobTitle: "Commerçante",
      legalName: "Chez Marie",
      city: "Dakar",
      planSlug: "boutique-pro",
      templateSlug: "boutique-souk",
      subcategorySlug: "alimentaire",
    },
  ];

  for (const item of tenants) {
    if (isReservedSlug(item.slug)) {
      throw new Error(`Slug réservé: ${item.slug}`);
    }

    const owner = await prisma.user.upsert({
      where: { email: item.ownerEmail },
      update: { passwordHash, emailVerifiedAt: verifiedAt },
      create: {
        email: item.ownerEmail,
        name: item.ownerName,
        passwordHash,
        staffRole: StaffRole.NONE,
        emailVerifiedAt: verifiedAt,
      },
    });

    let professional = await prisma.professional.findFirst({
      where: { ownerUserId: owner.id },
    });
    if (!professional) {
      professional = await prisma.professional.create({
        data: {
          ownerUserId: owner.id,
          displayName: item.ownerName,
          jobTitle: item.jobTitle,
          phone: "+221771234567",
        },
      });
    } else {
      professional = await prisma.professional.update({
        where: { id: professional.id },
        data: { displayName: item.ownerName, jobTitle: item.jobTitle, phone: "+221771234567" },
      });
    }

    const plan = await prisma.plan.findUniqueOrThrow({ where: { slug: item.planSlug } });
    const template = await prisma.siteTemplate.findUniqueOrThrow({ where: { slug: item.templateSlug } });
    const subcategory = await prisma.siteSubcategory.findUniqueOrThrow({
      where: { category_slug: { category: item.category, slug: item.subcategorySlug } },
    });

    const tenantData = {
      name: item.name,
      category: item.category,
      status: TenantStatus.ACTIVE,
      professionalId: professional.id,
      legalName: item.legalName,
      city: item.city,
      country: "SN",
      contactEmail: item.ownerEmail,
      contactPhone: "+221771234567",
      timezone: "Africa/Dakar",
      locale: "fr",
      currency: "XOF",
      planId: plan.id,
      planInterval: "MONTHLY" as const,
      templateId: template.id,
      subcategoryId: subcategory.id,
    };

    const tenant = await prisma.tenant.upsert({
      where: { slug: item.slug },
      update: tenantData,
      create: { slug: item.slug, ...tenantData },
    });

    await prisma.membership.upsert({
      where: {
        userId_tenantId: {
          userId: owner.id,
          tenantId: tenant.id,
        },
      },
      update: { role: MembershipRole.OWNER },
      create: {
        userId: owner.id,
        tenantId: tenant.id,
        role: MembershipRole.OWNER,
      },
    });

    await seedPublishedSite(tenant);
  }

  const marie = await prisma.tenant.findUniqueOrThrow({ where: { slug: "marie" } });
  const customer = await prisma.user.upsert({
    where: { email: "client@marie.local" },
    update: { passwordHash, emailVerifiedAt: verifiedAt },
    create: {
      email: "client@marie.local",
      name: "Client Marie",
      passwordHash,
      staffRole: StaffRole.NONE,
      emailVerifiedAt: verifiedAt,
    },
  });
  await prisma.tenantCustomer.upsert({
    where: { userId_tenantId: { userId: customer.id, tenantId: marie.id } },
    update: {},
    create: { userId: customer.id, tenantId: marie.id },
  });

  await seedMarieCatalog(marie.id);
  await seedMarieOrders(marie.id, customer.id);

  const claire = await prisma.tenant.findUniqueOrThrow({ where: { slug: "table" } });
  await seedClaireReservations(claire.id);

  await seedSubscriptions();
  await seedPlatformModules();

  console.log(`Seed OK — MEGA ${staff.email}, ${tenants.length} pros, catalogue, abonnements, modules, commandes, réservations, client ${customer.email}`);
}

async function seedPlatformModules() {
  await prisma.platformModule.upsert({
    where: { slug: "sms" },
    update: {
      name: "SMS",
      description:
        "Notifie vos clients par SMS à chaque changement de statut de commande (Boutique).",
      categories: ["BOUTIQUE", "RESTAURANT", "VITRINE"],
      isActive: true,
      sortOrder: 0,
    },
    create: {
      slug: "sms",
      name: "SMS",
      description:
        "Notifie vos clients par SMS à chaque changement de statut de commande (Boutique).",
      categories: ["BOUTIQUE", "RESTAURANT", "VITRINE"],
      amountXof: 2500,
      isActive: true,
      sortOrder: 0,
    },
  });

  await prisma.platformModule.upsert({
    where: { slug: "whatsapp-orders" },
    update: {
      name: "Commande WhatsApp",
      description:
        "Boutique WhatsApp complète : vos clients commandent directement dans WhatsApp, sans passer par le site (Boutique).",
      categories: ["BOUTIQUE"],
      isActive: true,
      sortOrder: 1,
    },
    create: {
      slug: "whatsapp-orders",
      name: "Commande WhatsApp",
      description:
        "Boutique WhatsApp complète : vos clients commandent directement dans WhatsApp, sans passer par le site (Boutique).",
      categories: ["BOUTIQUE"],
      amountXof: 9900,
      isActive: true,
      sortOrder: 1,
    },
  });
}

async function seedPublishedSite(tenant: {
  id: string;
  name: string;
  description: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  addressLine: string | null;
  city: string | null;
}) {
  const existing = await prisma.tenantSite.findUnique({ where: { tenantId: tenant.id } });
  if (existing) {
    await prisma.tenantSite.update({
      where: { id: existing.id },
      data: {
        status: "PUBLISHED",
        title: tenant.name,
        tagline: existing.tagline ?? tenant.description,
        email: existing.email ?? tenant.contactEmail,
        phone: existing.phone ?? tenant.contactPhone,
        publishedAt: existing.publishedAt ?? new Date(),
        unpublishedAt: null,
        suspendedAt: null,
        suspendedReason: null,
      },
    });
    await seedSiteHours(existing.id);
    return;
  }

  const created = await prisma.tenantSite.create({
    data: {
      tenantId: tenant.id,
      status: "PUBLISHED",
      title: tenant.name,
      tagline: tenant.description,
      about: tenant.description,
      email: tenant.contactEmail,
      phone: tenant.contactPhone,
      addressLine: tenant.addressLine,
      city: tenant.city,
      publishedAt: new Date(),
      pages: {
        create: defaultSitePages(tenant.name).map((page) => ({
          slug: page.slug,
          title: page.title,
          isHome: page.isHome,
          sortOrder: page.sortOrder,
          sections: {
            create: page.sections.map((section) => ({
              type: section.type,
              title: section.title,
              body: section.body,
              sortOrder: section.sortOrder,
            })),
          },
        })),
      },
    },
  });
  await seedSiteHours(created.id);
}

async function seedSiteHours(siteId: string) {
  for (const day of defaultOpeningHours()) {
    await prisma.siteOpeningHour.upsert({
      where: { siteId_weekday: { siteId, weekday: day.weekday } },
      update: {},
      create: { siteId, ...day },
    });
  }
}

async function seedClaireReservations(tenantId: string) {
  await prisma.reservationSettings.upsert({
    where: { tenantId },
    update: {},
    create: { tenantId },
  });
  for (const day of defaultReservationHours()) {
    await prisma.reservationHour.upsert({
      where: { tenantId_weekday: { tenantId, weekday: day.weekday } },
      update: {},
      create: { tenantId, ...day },
    });
  }

  const date = new Date("2026-11-06T00:00:00.000Z");
  const existing = await prisma.reservation.count({ where: { tenantId } });
  if (existing > 0) {
    return;
  }
  await prisma.reservation.createMany({
    data: [
      {
        tenantId,
        date,
        time: "19:30",
        partySize: 2,
        guestName: "Aminata Sow",
        guestEmail: "aminata@example.local",
        guestPhone: "+221770000001",
        status: "CONFIRMED",
        source: "STOREFRONT",
      },
      {
        tenantId,
        date,
        time: "20:00",
        partySize: 4,
        guestName: "Ibrahima Fall",
        guestPhone: "+221770000002",
        status: "PENDING",
        source: "PRO",
        note: "Anniversaire",
      },
    ],
  });
}

async function seedSubscriptions() {
  const slugs = ["atelier", "table", "marie"];
  const startedAt = new Date("2026-11-01T00:00:00.000Z");
  const endsAt = new Date("2026-12-01T00:00:00.000Z");
  for (const slug of slugs) {
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { slug },
      include: {
        plan: { include: { prices: true } },
        selectedOptions: { include: { option: true } },
      },
    });
    const existing = await prisma.subscription.findFirst({ where: { tenantId: tenant.id, status: "ACTIVE" } });
    if (existing || !tenant.planId || !tenant.plan) {
      continue;
    }
    const price = tenant.plan.prices.find((item) => item.interval === tenant.planInterval && item.isActive);
    const amountXof =
      (price?.amountXof ?? 0) + tenant.selectedOptions.reduce((sum, selected) => sum + selected.option.amountXof, 0);
    const subscription = await prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        planId: tenant.planId,
        interval: tenant.planInterval,
        status: "ACTIVE",
        graceDays: tenant.plan.graceDays,
        expiredRestriction: tenant.plan.expiredRestriction,
        startedAt,
        currentPeriodEndsAt: endsAt,
        periods: { create: { sequence: 1, startedAt, endsAt } },
        events: { create: { type: "CREATED", message: "Abonnement initial" } },
      },
      include: { periods: true },
    });
    const period = subscription.periods[0];
    if (!period) {
      continue;
    }
    await prisma.subscriptionPayment.create({
      data: {
        subscriptionId: subscription.id,
        periodId: period.id,
        amountXof,
        status: "VALIDATED",
        method: "TRANSFER",
        reference: "SEED",
        paidAt: startedAt,
      },
    });
  }
}

async function seedMarieOrders(tenantId: string, customerUserId: string) {
  await prisma.orderSettings.upsert({
    where: { tenantId },
    update: {},
    create: { tenantId, deliveryFeeXof: 1500, freeDeliveryFromXof: 20000 },
  });
  const existing = await prisma.order.count({ where: { tenantId } });
  if (existing > 0) {
    return;
  }
  const mangues = await prisma.product.findUniqueOrThrow({
    where: { tenantId_slug: { tenantId, slug: "mangues" } },
  });
  await prisma.order.create({
    data: {
      tenantId,
      number: "CMD-0001",
      fulfillment: "DELIVERY",
      status: "PENDING",
      customerUserId,
      customerName: "Client Marie",
      customerEmail: "client@marie.local",
      customerPhone: "+221771234567",
      addressLine: "12 rue des Almadies",
      city: "Dakar",
      subtotalXof: 3000,
      deliveryFeeXof: 1500,
      totalXof: 4500,
      items: {
        create: {
          productId: mangues.id,
          productName: mangues.name,
          unitPriceXof: mangues.priceXof,
          quantity: 2,
          lineTotalXof: mangues.priceXof * 2,
        },
      },
      events: {
        create: { type: "CREATED", toStatus: "PENDING", message: "Commande de démonstration" },
      },
    },
  });
}

async function seedMarieCatalog(tenantId: string) {
  const fruits = await prisma.productCategory.upsert({
    where: { tenantId_slug: { tenantId, slug: "fruits" } },
    update: { name: "Fruits", isActive: true, sortOrder: 0 },
    create: { tenantId, slug: "fruits", name: "Fruits", description: "Fruits de saison", sortOrder: 0 },
  });
  const epicerie = await prisma.productCategory.upsert({
    where: { tenantId_slug: { tenantId, slug: "epicerie" } },
    update: { name: "Épicerie", isActive: true, sortOrder: 1 },
    create: { tenantId, slug: "epicerie", name: "Épicerie", description: "Produits secs", sortOrder: 1 },
  });

  const products = [
    {
      slug: "mangues",
      name: "Mangues",
      description: "Mangues Kent, le kilo.",
      priceXof: 1500,
      categoryId: fruits.id,
      availability: "IN_STOCK" as const,
      isActive: true,
      isPublished: true,
      sortOrder: 0,
      variants: [] as Array<{ name: string; priceXof: number; sku: string }>,
    },
    {
      slug: "riz",
      name: "Riz local",
      description: "Riz parfumé du Sénégal.",
      priceXof: 800,
      categoryId: epicerie.id,
      availability: "IN_STOCK" as const,
      isActive: true,
      isPublished: true,
      sortOrder: 1,
      variants: [
        { name: "1 kg", priceXof: 800, sku: "RIZ-1" },
        { name: "5 kg", priceXof: 3800, sku: "RIZ-5" },
      ],
    },
    {
      slug: "huile",
      name: "Huile d'arachide",
      description: "Bouteille de 1 L.",
      priceXof: 2500,
      categoryId: epicerie.id,
      availability: "OUT_OF_STOCK" as const,
      isActive: true,
      isPublished: true,
      sortOrder: 2,
      variants: [],
    },
    {
      slug: "sucre",
      name: "Sucre",
      description: "Brouillon, non exposé.",
      priceXof: 700,
      categoryId: epicerie.id,
      availability: "IN_STOCK" as const,
      isActive: true,
      isPublished: false,
      sortOrder: 3,
      variants: [],
    },
    {
      slug: "piment",
      name: "Piment",
      description: "Désactivé.",
      priceXof: 400,
      categoryId: fruits.id,
      availability: "IN_STOCK" as const,
      isActive: false,
      isPublished: true,
      sortOrder: 4,
      variants: [],
    },
  ];

  for (const item of products) {
    const { variants, ...data } = item;
    const product = await prisma.product.upsert({
      where: { tenantId_slug: { tenantId, slug: item.slug } },
      update: data,
      create: { tenantId, ...data },
    });
    if (variants.length === 0) {
      continue;
    }
    for (const [index, variant] of variants.entries()) {
      const existing = await prisma.productVariant.findFirst({
        where: { productId: product.id, sku: variant.sku },
      });
      if (existing) {
        await prisma.productVariant.update({
          where: { id: existing.id },
          data: { name: variant.name, priceXof: variant.priceXof, sortOrder: index, isActive: true },
        });
      } else {
        await prisma.productVariant.create({
          data: { productId: product.id, ...variant, sortOrder: index, isActive: true },
        });
      }
    }
  }
}

function planLimitsFor(slug: string, category: "VITRINE" | "RESTAURANT" | "BOUTIQUE") {
  const tier = slug.includes("business")
    ? "business"
    : slug.includes("pro")
      ? "pro"
      : "decouverte";
  const maxCollaborators = tier === "business" ? 10 : tier === "pro" ? 3 : 1;
  const catalogCap = tier === "business" ? null : tier === "pro" ? 200 : 20;
  const commissionPct = tier === "business" ? 1.5 : tier === "pro" ? 2.5 : 5;

  if (category === "VITRINE") {
    return {
      commissionPct: null as number | null,
      maxCatalogItems: null as number | null,
      maxCollaborators,
      maxAppointments: catalogCap,
    };
  }

  return {
    commissionPct,
    maxCatalogItems: catalogCap,
    maxCollaborators,
    maxAppointments: null as number | null,
  };
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
