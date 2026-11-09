export const CONTRACT_VERSION = "2026-11-02";

export const CONTRACT_SUMMARY = [
  {
    title: "Article 1 — Objet.",
    text: "Boutik met à disposition du professionnel une plateforme de création et de gestion de site internet, selon l'offre choisie.",
  },
  {
    title: "Article 2 — Durée.",
    text: "Le contrat prend effet à la signature, pour une durée d'un mois renouvelable tacitement.",
  },
  {
    title: "Article 3 — Commissions.",
    text: "Une commission est prélevée sur chaque vente encaissée via la plateforme, selon le taux de l'offre en vigueur.",
  },
  {
    title: "Article 4 — Retraits.",
    text: "Les fonds encaissés sont immédiatement disponibles et peuvent être retirés vers un compte au nom du professionnel.",
  },
  {
    title: "Article 5 — Résiliation.",
    text: "Le professionnel peut résilier à tout moment depuis son espace Abonnement.",
  },
] as const;

export const CONTRACT_DIALOG = [
  {
    title: "Objet.",
    text: "Boutik met à disposition du professionnel une plateforme en ligne de création, de publication et de gestion de site internet (vitrine, restaurant ou boutique), ainsi que les services associés : hébergement, nom de domaine boutik.app, encaissement et wallet.",
  },
  {
    title: "Durée.",
    text: "Le contrat prend effet à la signature électronique pour une durée d'un mois, renouvelée tacitement à chaque échéance.",
  },
  {
    title: "Prix et commissions.",
    text: "L'abonnement est facturé selon l'offre choisie. Une commission est prélevée sur chaque vente encaissée via la plateforme : 5 % (Découverte), 2,5 % (Pro), 1,5 % (Business).",
  },
  {
    title: "Fonds et retraits.",
    text: "Les sommes encaissées sont immédiatement disponibles. Le professionnel peut demander un retrait à partir de 5 000 F CFA vers un compte mobile money ou bancaire à son nom.",
  },
  {
    title: "Contenus.",
    text: "Le professionnel est seul responsable des contenus publiés et garantit disposer des droits nécessaires sur les textes et images importés.",
  },
  {
    title: "Suspension.",
    text: "Boutik peut suspendre un site en cas de manquement grave aux conditions générales, après notification par e-mail.",
  },
  {
    title: "Résiliation.",
    text: "Le professionnel peut résilier à tout moment depuis son espace Abonnement. Les fonds disponibles restent retirables pendant 90 jours.",
  },
  {
    title: "Données personnelles.",
    text: "Les données des clients finaux sont traitées pour le compte du professionnel et ne sont jamais revendues.",
  },
] as const;

export const CONTRACT_SECTIONS: { heading: string; paragraphs: string[] }[] = [
  {
    heading: "Parties",
    paragraphs: [
      "Le présent contrat de service est conclu entre Boutik, éditeur de la plateforme accessible sur boutik.app, et le professionnel qui crée un compte, renseigne son activité et signe électroniquement.",
      "Le professionnel agit pour les besoins de son activité. Il garantit avoir le pouvoir d'engager l'entreprise dont il indique le nom.",
    ],
  },
  {
    heading: "Définitions",
    paragraphs: [
      "La plateforme est l'ensemble des outils Boutik : création du site, espace professionnel, commandes, réservations, paiements en ligne et retraits.",
      "Le site est la vitrine, la boutique ou le restaurant publié par le professionnel, d'abord à l'adresse sous-domaine qui lui est attribuée.",
      "Une vente encaissée est un paiement reçu en ligne par l'intermédiaire de la plateforme, à l'exclusion des paiements reçus directement par le professionnel en dehors de Boutik.",
      "L'offre est la formule en vigueur au moment de la facturation : Découverte, Pro ou Business, en mensualité ou à l'année.",
    ],
  },
  {
    heading: "Article 1 — Objet",
    paragraphs: [
      "Boutik met à disposition du professionnel une plateforme de création et de gestion de site internet, selon l'offre choisie.",
      "Boutik n'achète pas les produits, ne prépare pas les commandes et n'exécute pas les prestations du professionnel. Le contrat de vente ou de service est conclu entre le professionnel et son client.",
    ],
  },
  {
    heading: "Article 2 — Site et espace professionnel",
    paragraphs: [
      "Le professionnel choisit la nature de son site : boutique, restaurant ou site vitrine. Il peut compléter les fonctions prévues pour cette nature.",
      "Le site est publié sur un sous-domaine Boutik. Un nom de domaine propre est possible lorsque l'offre le prévoit.",
      "Le professionnel reste responsable du contenu qu'il publie : textes, prix, photos, menus, horaires et disponibilités. Ces informations doivent être exactes et tenues à jour.",
    ],
  },
  {
    heading: "Article 3 — Offres, prix et essai",
    paragraphs: [
      "Les prix sont indiqués en francs CFA (XOF). L'offre Découverte est gratuite, dans la limite de 20 produits ou plats et d'un utilisateur, avec une commission de 5 %. L'offre Pro est de 9 900 F CFA par mois, dans la limite de 200 produits ou plats et de 3 utilisateurs, avec une commission de 2,5 %. L'offre Business est de 24 900 F CFA par mois, avec des produits illimités, 10 utilisateurs et une commission de 1,5 %.",
      "L'abonnement annuel correspond à dix mensualités : deux mois sont offerts. Un modèle premium est facturé 15 000 F CFA, une seule fois.",
      "Les offres Pro et Business peuvent commencer par un essai de 14 jours. Pendant l'essai, l'abonnement n'est pas facturé. La commission sur les ventes encaissées reste due. Sans résiliation avant la fin de l'essai, l'offre choisie est facturée.",
      "Boutik peut faire évoluer les offres. Une hausse de prix ou de commission est annoncée au moins 30 jours avant son application. Le professionnel peut résilier avant cette date.",
    ],
  },
  {
    heading: "Article 4 — Commission",
    paragraphs: [
      "Une commission est prélevée sur chaque vente encaissée via la plateforme, selon le taux de l'offre en vigueur. Elle ne s'applique pas au simple trafic, ni aux paiements reçus hors de Boutik.",
      "La commission est calculée sur le montant payé par le client, frais de livraison inclus lorsqu'ils sont encaissés par la plateforme, hors sommes remboursées.",
      "En cas de remboursement intégral, la commission correspondante est annulée. En cas de remboursement partiel, elle est recalculée sur le montant conservé.",
    ],
  },
  {
    heading: "Article 5 — Encaissement et retraits",
    paragraphs: [
      "Les sommes encaissées pour le compte du professionnel sont suivies dans son wallet, après déduction de la commission et des remboursements.",
      "Les fonds sont disponibles immédiatement dès l'encaissement de la commande.",
      "Le professionnel retire les fonds vers un compte ouvert à son nom, ou au nom de l'entreprise indiquée. Boutik peut demander un justificatif avant le premier retrait, ou si le compte de destination change.",
      "Boutik peut retenir le montant d'une opération contestée, frauduleuse ou contraire au présent contrat, le temps de la vérification. Le professionnel est informé du motif.",
    ],
  },
  {
    heading: "Article 6 — Durée",
    paragraphs: [
      "Le contrat prend effet à la signature électronique, pour une durée d'un mois, renouvelable tacitement par périodes d'un mois. L'abonnement annuel se renouvelle par périodes d'un an, sauf résiliation avant l'échéance.",
      "Le choix d'une offre payante ou le passage à l'année ne créent pas un nouveau contrat : ils précisent l'offre applicable.",
    ],
  },
  {
    heading: "Article 7 — Résiliation",
    paragraphs: [
      "Le professionnel peut résilier à tout moment depuis son espace Abonnement. La résiliation prend effet à la fin de la période déjà commencée. Les sommes d'abonnement échues restent dues. Les fonds disponibles dans le wallet peuvent encore être retirés.",
      "Boutik peut résilier en cas de manquement grave non corrigé dans les 15 jours d'une mise en demeure, ou immédiatement en cas de fraude, d'activité illicite ou de risque pour les clients.",
      "Après la fin du contrat, le professionnel peut récupérer ses contenus et l'historique de ses commandes pendant 30 jours. Passé ce délai, Boutik peut les supprimer.",
    ],
  },
  {
    heading: "Article 8 — Obligations du professionnel",
    paragraphs: [
      "Le professionnel exerce une activité licite. Il ne propose pas de produits ou de services interdits, contrefaisants, dangereux ou trompeurs.",
      "Il honore les commandes et les réservations qu'il accepte, indique des prix complets, et traite lui-même les demandes de ses clients. Boutik peut transmettre une réclamation, sans se substituer au professionnel.",
      "Il conserve les autorisations nécessaires à son activité et déclare le chiffre réalisé selon les règles fiscales qui lui sont applicables. La commission et l'abonnement sont des charges de sa plateforme, pas une dispense de ses obligations fiscales.",
    ],
  },
  {
    heading: "Article 9 — Obligations de Boutik",
    paragraphs: [
      "Boutik fournit la plateforme avec le soin attendu d'un éditeur de logiciel. Une maintenance peut interrompre l'accès de façon brève. Boutik prévient lorsqu'une interruption est prévisible.",
      "Boutik ne garantit pas un volume de visites, de commandes ou de recettes. Le référencement et la publicité restent des résultats dépendants de facteurs extérieurs.",
    ],
  },
  {
    heading: "Article 10 — Propriété",
    paragraphs: [
      "Boutik conserve la propriété de la plateforme, des modèles, des marques et des logiciels. Le professionnel reçoit un droit d'usage, non exclusif, limité à la durée du contrat et à son propre site.",
      "Le professionnel conserve la propriété de ses contenus, de son nom commercial et de sa clientèle. Il autorise Boutik à héberger et afficher ces contenus pour le seul fonctionnement du service.",
    ],
  },
  {
    heading: "Article 11 — Données personnelles",
    paragraphs: [
      "Chaque partie traite les données nécessaires à son rôle. Boutik traite les données du compte professionnel pour fournir le service, sécuriser les paiements et prévenir la fraude.",
      "Les données des clients du site sont collectées pour le compte du professionnel, qui en définit l'usage commercial. Boutik les héberge et les traite pour exécuter les commandes, les réservations et les paiements.",
      "Boutik ne vend pas ces données. Les durées de conservation sont limitées à ce qui est nécessaire au service, aux retraits et aux obligations comptables.",
    ],
  },
  {
    heading: "Article 12 — Suspension",
    paragraphs: [
      "Boutik peut suspendre le site ou les retraits en cas de défaut de paiement de l'abonnement, d'atteinte aux clients, de suspicion de fraude, ou de demande d'une autorité.",
      "La suspension est proportionnée et levée dès que le motif a disparu. Pendant une suspension pour impayé, le professionnel conserve un accès en lecture à ses commandes et à son wallet.",
    ],
  },
  {
    heading: "Article 13 — Responsabilité",
    paragraphs: [
      "Chaque partie répond des dommages directs causés par un manquement prouvé au contrat.",
      "Boutik n'est pas responsable du contenu publié par le professionnel, des produits livrés, des litiges avec ses clients, ni des indisponibilités dues à un réseau, un opérateur de paiement ou un hébergeur extérieur.",
      "Sauf faute lourde, dol, ou atteinte à une personne, la responsabilité de Boutik sur une année est limitée au montant payé par le professionnel à Boutik pendant les douze mois précédant le dommage, abonnement et commissions confondus. Si ce montant est nul, le plafond est de 50 000 F CFA.",
    ],
  },
  {
    heading: "Article 14 — Évolution du contrat",
    paragraphs: [
      "Boutik peut modifier le contrat pour suivre le service ou une obligation légale. La nouvelle version est notifiée au moins 30 jours avant son entrée en vigueur, sauf obligation légale plus rapide.",
      "La poursuite de l'usage après cette date vaut acceptation. Le professionnel qui refuse peut résilier avant l'entrée en vigueur, sans frais de sortie.",
    ],
  },
  {
    heading: "Article 15 — Signature électronique",
    paragraphs: [
      "La signature est réalisée dans l'espace de création du site. Le professionnel coche qu'il a lu le contrat et saisit son nom complet.",
      "Ce geste, relié à son compte, à son téléphone vérifié, à la date et à la version du contrat, constitue la signature électronique. Entre les parties, il vaut signature du présent contrat.",
      "Boutik conserve la preuve de la signature : nom, date, version et identifiant du compte.",
    ],
  },
  {
    heading: "Article 16 — Droit applicable",
    paragraphs: [
      "Le contrat est soumis au droit sénégalais, sans priver le professionnel des règles impératives du pays où il est établi.",
      "En cas de différend, les parties cherchent d'abord une solution amiable pendant 30 jours. À défaut, les tribunaux de Dakar sont compétents.",
    ],
  },
];
