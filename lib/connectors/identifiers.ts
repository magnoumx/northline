export async function externalIdentifier(
  namespace: string,
  value: string,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${namespace}\u0000${value}`),
  );
  const hash = Array.from(new Uint8Array(digest).slice(0, 16), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${namespace}:${hash}`;
}
