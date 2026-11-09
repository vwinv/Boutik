import { SetMetadata } from "@nestjs/common";
import type { Audience } from "@boutik/domain";

export const AUDIENCE_KEY = "audiences";

export const RequireAudience = (...audiences: Audience[]) => SetMetadata(AUDIENCE_KEY, audiences);
