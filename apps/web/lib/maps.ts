/** Lien Google Maps (itinéraire) vers une adresse. */
export function googleMapsDirectionsUrl(address: string | null | undefined) {
  const query = address?.trim();
  if (!query) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
}
