import type { DnsResolver } from "../security/ssrf";

export type PinnedFetchRequest = {
  url: URL;
  pinnedAddresses: readonly string[];
  maximumBytes: number;
  timeoutMs: number;
};

/**
 * Built-in Worker fetch cannot prove which resolved address was used. A live
 * implementation must therefore use an approved egress service that accepts
 * the validated address set and reports the connected address.
 */
export interface PinnedHttpTransport {
  fetchPinned(request: PinnedFetchRequest): Promise<{
    status: number;
    headers: Readonly<Record<string, string>>;
    body: Uint8Array;
    connectedAddress: string;
  }>;
}

export interface SourceSnapshotWriter {
  store(snapshot: {
    sourceUrl: string;
    finalUrl: string;
    contentHash: string;
    contentType: string;
    byteLength: number;
    fetchedAt: string;
    untrustedText: string;
    injectionIndicators: readonly string[];
  }): Promise<{ storageKey: string }>;
}

export type SafeSourceAcquisitionDependencies = {
  resolver: DnsResolver;
  transport: PinnedHttpTransport;
  snapshotWriter?: SourceSnapshotWriter;
};

export type AcquiredSource = {
  sourceUrl: string;
  finalUrl: string;
  contentType: string;
  byteLength: number;
  contentHash: string;
  fetchedAt: string;
  untrustedText: string;
  injectionIndicators: readonly string[];
  storageKey: string | null;
  redirects: number;
};

export class SourceAcquisitionError extends Error {
  constructor(
    readonly category:
      | "FEATURE_DISABLED"
      | "UNSAFE_TARGET"
      | "REDIRECT_LIMIT"
      | "TRANSPORT_IDENTITY_MISMATCH"
      | "HTTP_STATUS"
      | "UNSUPPORTED_CONTENT"
      | "OVERSIZED_RESPONSE"
      | "EMPTY_CONTENT",
    message: string,
  ) {
    super(message);
    this.name = "SourceAcquisitionError";
  }
}
