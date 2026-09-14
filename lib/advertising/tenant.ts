export class TenantAccessError extends Error {
  readonly code = "TENANT_ACCESS_DENIED";
}

export function assertOrganizationAccess(input: {
  requestedOrganizationId: string;
  sessionOrganizationIds: readonly string[];
  isStaffWithCommercialAccess: boolean;
}): void {
  if (input.isStaffWithCommercialAccess) return;
  if (!input.sessionOrganizationIds.includes(input.requestedOrganizationId)) {
    throw new TenantAccessError("The requested resource is outside this organization.");
  }
}

export function selectTenantResource<T extends { advertiserOrganizationId: string }>(
  rows: readonly T[],
  requestedId: string,
  allowedOrganizationIds: readonly string[],
): T | null {
  return (
    rows.find(
      (row) =>
        "id" in row &&
        (row as T & { id?: unknown }).id === requestedId &&
        allowedOrganizationIds.includes(row.advertiserOrganizationId),
    ) ?? null
  );
}

