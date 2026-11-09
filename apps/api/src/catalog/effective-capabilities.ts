import {
  API_ERROR_CODES,
  CORE_CAPABILITIES,
  effectiveCapabilities,
  isCapability,
  type Capability,
  type Category,
} from "@boutik/domain";
import { ApiException } from "../common/api-exception";

type OfferingSource = {
  category: Category;
  plan: { capabilities: string[] } | null;
  selectedOptions: Array<{ option: { capability: string | null } }>;
};

export function capabilitiesFromOffering(source: OfferingSource): Capability[] {
  const granted: Capability[] = [];
  if (source.plan) {
    for (const item of source.plan.capabilities) {
      if (isCapability(item)) {
        granted.push(item);
      }
    }
  }
  for (const selected of source.selectedOptions) {
    if (selected.option.capability && isCapability(selected.option.capability)) {
      granted.push(selected.option.capability);
    }
  }
  if (granted.length === 0) {
    return effectiveCapabilities(source.category, CORE_CAPABILITIES);
  }
  return effectiveCapabilities(source.category, granted);
}

export function offeringHasCapability(source: OfferingSource, capability: Capability) {
  return capabilitiesFromOffering(source).includes(capability);
}

export function assertOfferingCapability(source: OfferingSource, capability: Capability) {
  if (!offeringHasCapability(source, capability)) {
    throw new ApiException(API_ERROR_CODES.CAPABILITY_NOT_ALLOWED, undefined, { capability });
  }
}
