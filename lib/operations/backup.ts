import { sha256Base64Url } from "../security/crypto";

export const BACKUP_VERSION = 1;

export type BackupSnapshot = {
  version: typeof BACKUP_VERSION;
  createdAt: string;
  tables: Record<string, unknown[]>;
  checksum: string;
};

export function canonicalize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

export async function buildBackupSnapshot(
  tables: Record<string, unknown[]>,
  options: { createdAt?: Date } = {},
): Promise<BackupSnapshot> {
  for (const [name, rows] of Object.entries(tables)) {
    if (!Array.isArray(rows)) {
      throw new TypeError(`Backup table "${name}" must be an array of rows.`);
    }
  }
  const createdAt = (options.createdAt ?? new Date()).toISOString();
  const payload = canonicalize({ version: BACKUP_VERSION, createdAt, tables });
  const checksum = await sha256Base64Url(payload);
  return { version: BACKUP_VERSION, createdAt, tables, checksum };
}

export async function verifyBackupSnapshot(
  snapshot: unknown,
): Promise<{ valid: true; tables: string[]; rowCount: number; createdAt: string }> {
  if (!snapshot || typeof snapshot !== "object") {
    throw new TypeError("Backup snapshot must be an object.");
  }
  const candidate = snapshot as Partial<BackupSnapshot>;
  if (candidate.version !== BACKUP_VERSION) {
    throw new TypeError(`Unsupported backup version: ${String(candidate.version)}`);
  }
  if (typeof candidate.createdAt !== "string" || !candidate.tables || typeof candidate.tables !== "object") {
    throw new TypeError("Backup snapshot is malformed.");
  }
  if (typeof candidate.checksum !== "string" || candidate.checksum.length === 0) {
    throw new TypeError("Backup snapshot is missing its integrity checksum.");
  }
  const payload = canonicalize({
    version: candidate.version,
    createdAt: candidate.createdAt,
    tables: candidate.tables,
  });
  const expected = await sha256Base64Url(payload);
  if (expected !== candidate.checksum) {
    throw new Error("Backup snapshot checksum mismatch — the file may be tampered with or corrupt.");
  }
  const tables = Object.keys(candidate.tables);
  const rowCount = Object.values(candidate.tables).reduce(
    (sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0),
    0,
  );
  return { valid: true, tables, rowCount, createdAt: candidate.createdAt };
}
