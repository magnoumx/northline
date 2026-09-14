"use client";

import { Check, LoaderCircle, Mail } from "lucide-react";
import { FormEvent, useState } from "react";

type Status = "idle" | "loading" | "success" | "error";

type BriefingProduct = {
  id: "daily-brief" | "breaking-updates" | "weekend-deep-reads";
  name: string;
  schedule: string;
  description: string;
};

export function NewsletterForm({
  compact = false,
  list = "daily-brief",
}: {
  compact?: boolean;
  list?: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [confirmationUrl, setConfirmationUrl] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");
    setConfirmationUrl("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, list }),
      });
      const payload = (await response.json()) as {
        message?: string;
        confirmationUrl?: string;
      };
      if (!response.ok) throw new Error(payload.message || "Unable to subscribe.");
      setStatus("success");
      setMessage(payload.message ?? "Check your inbox to confirm.");
      setConfirmationUrl(payload.confirmationUrl ?? "");
      event.currentTarget.reset();
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Unable to subscribe right now.",
      );
    }
  }

  return (
    <form
      className={`newsletter-form${compact ? " newsletter-form--compact" : ""}`}
      onSubmit={submit}
    >
      <label>
        <span className="sr-only">Email address</span>
        <Mail size={18} aria-hidden="true" />
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          disabled={status === "loading"}
        />
      </label>
      <button type="submit" disabled={status === "loading"}>
        {status === "loading" ? (
          <LoaderCircle className="spin" size={17} />
        ) : status === "success" ? (
          <Check size={17} />
        ) : null}
        {status === "success" ? "Added" : "Get the briefing"}
      </button>
      <NewsletterStatus
        confirmationUrl={confirmationUrl}
        message={message}
        status={status}
      />
    </form>
  );
}

export function UnifiedNewsletterForm({
  products,
}: {
  products: readonly BriefingProduct[];
}) {
  const [selected, setSelected] = useState<BriefingProduct["id"][]>([
    "daily-brief",
    "weekend-deep-reads",
  ]);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [confirmationUrl, setConfirmationUrl] = useState("");

  function toggle(id: BriefingProduct["id"]) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((candidate) => candidate !== id)
        : [...current, id],
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setConfirmationUrl("");
    if (selected.length === 0) {
      setStatus("error");
      setMessage("Choose at least one briefing.");
      return;
    }

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    setStatus("loading");
    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, lists: selected }),
      });
      const payload = (await response.json()) as {
        message?: string;
        confirmationUrl?: string;
      };
      if (!response.ok) throw new Error(payload.message || "Unable to subscribe.");
      setStatus("success");
      setMessage(payload.message ?? "Check your inbox to confirm your choices.");
      setConfirmationUrl(payload.confirmationUrl ?? "");
      event.currentTarget.reset();
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Unable to subscribe right now.",
      );
    }
  }

  return (
    <form className="unified-newsletter" onSubmit={submit}>
      <fieldset>
        <legend className="sr-only">Choose your briefings</legend>
        <div className="unified-newsletter__products">
          {products.map((product) => {
            const isSelected = selected.includes(product.id);
            return (
              <label
                className={`newsletter-product newsletter-product--selectable${
                  isSelected ? " is-selected" : ""
                }`}
                key={product.id}
              >
                <input
                  checked={isSelected}
                  name="briefings"
                  onChange={() => toggle(product.id)}
                  type="checkbox"
                  value={product.id}
                />
                <span className="newsletter-product__check" aria-hidden="true">
                  {isSelected ? <Check size={16} /> : null}
                </span>
                <Mail aria-hidden="true" />
                <span>{product.schedule}</span>
                <h2>{product.name}</h2>
                <p>{product.description}</p>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="unified-newsletter__submit">
        <label>
          <span>Email address</span>
          <span className="unified-newsletter__input">
            <Mail size={18} aria-hidden="true" />
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              disabled={status === "loading"}
            />
          </span>
        </label>
        <button type="submit" disabled={status === "loading" || selected.length === 0}>
          {status === "loading" ? <LoaderCircle className="spin" size={17} /> : null}
          Subscribe to selected briefings
        </button>
      </div>

      <NewsletterStatus
        confirmationUrl={confirmationUrl}
        message={message}
        status={status}
      />
    </form>
  );
}

function NewsletterStatus({
  confirmationUrl,
  message,
  status,
}: {
  confirmationUrl: string;
  message: string;
  status: Status;
}) {
  if (!message) return null;
  return (
    <p className={`form-message form-message--${status}`} role="status">
      {message}
      {confirmationUrl ? (
        <>
          {" "}
          <a href={confirmationUrl}>Confirm this local-preview subscription</a>
        </>
      ) : null}
    </p>
  );
}
