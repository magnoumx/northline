"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>;
  }
}

type GoogleAdSlotProps = {
  clientId: string | undefined;
  enabled: boolean;
  slot: string | undefined;
  placement: "article_top" | "article_mid" | "article_end" | "home";
  className?: string;
};

function validSlot(value: string | undefined): value is string {
  return Boolean(value?.trim() && /^\d{6,30}$/u.test(value.trim()));
}

export function GoogleAdSlot({
  clientId,
  enabled,
  slot,
  placement,
  className,
}: GoogleAdSlotProps) {
  const client = clientId?.trim();

  useEffect(() => {
    if (!enabled || !validSlot(slot) || !client) return;
    try {
      window.adsbygoogle = window.adsbygoogle ?? [];
      window.adsbygoogle.push({});
    } catch {
      // Ad blockers and consent tools may intentionally prevent loading.
    }
  }, [client, enabled, slot]);

  if (
    !enabled ||
    !validSlot(slot) ||
    !client ||
    !/^ca-pub-\d{10,30}$/u.test(client)
  ) {
    return null;
  }

  return (
    <aside
      className={["google-ad-slot", className].filter(Boolean).join(" ")}
      aria-label="Advertisement"
      data-ad-placement={placement}
    >
      <span className="google-ad-slot__label">Advertisement</span>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
