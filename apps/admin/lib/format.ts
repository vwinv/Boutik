export function formatXof(value: number) {
  return `${value.toLocaleString("fr-FR").replace(/\u202f/g, " ")} FCFA`;
}

export function formatCompactXof(value: number) {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    const text = millions >= 10 ? millions.toFixed(0) : millions.toFixed(1).replace(".", ",");
    return `${text} M FCFA`;
  }
  return formatXof(value);
}

export function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "A";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

export function staffRoleLabel(role: string) {
  if (role === "OWNER") return "Super admin";
  if (role === "ADMIN") return "Admin";
  if (role === "SUPPORT") return "Support";
  if (role === "FINANCE") return "Finance";
  if (role === "MODERATION") return "Modération";
  return role;
}
