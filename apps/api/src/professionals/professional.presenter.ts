import type { Professional } from "@prisma/client";

export function presentProfessional(
  professional: Pick<Professional, "id" | "ownerUserId" | "displayName" | "jobTitle" | "bio" | "phone" | "avatarUrl" | "createdAt" | "updatedAt">,
) {
  return {
    id: professional.id,
    ownerUserId: professional.ownerUserId,
    displayName: professional.displayName,
    jobTitle: professional.jobTitle,
    bio: professional.bio,
    phone: professional.phone,
    avatarUrl: professional.avatarUrl,
    createdAt: professional.createdAt,
    updatedAt: professional.updatedAt,
  };
}
