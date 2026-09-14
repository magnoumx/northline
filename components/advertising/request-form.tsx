"use client";

import { useState, type FormEvent } from "react";
import styles from "./commercial-pages.module.css";

type SubmissionState =
  | { phase: "idle" }
  | { phase: "sending" }
  | { phase: "success"; message: string; reference?: string }
  | { phase: "error"; message: string };

const categories = ["Business", "Technology", "Politics", "Climate", "Sports"];
const placements = [
  "Homepage",
  "Article",
  "Category",
  "Newsletter",
  "Sponsored collection",
];

export function AdvertisingRequestForm({
  captchaServerConfigured,
  captchaRequired,
}: {
  captchaServerConfigured: boolean;
  captchaRequired: boolean;
}) {
  const [state, setState] = useState<SubmissionState>({ phase: "idle" });
  const [formStartedAt] = useState(() => Date.now());
  // The server verifies Turnstile whenever a secret is configured, even when
  // the environment does not require it. Until this form renders a real
  // browser challenge and receives a token, keeping submission enabled would
  // create a control that can only fail.
  const unavailable = captchaRequired || captchaServerConfigured;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (unavailable || state.phase === "sending") return;
    const formElement = event.currentTarget;
    setState({ phase: "sending" });
    const form = new FormData(formElement);
    const value = (name: string) => String(form.get(name) ?? "").trim();
    const values = (name: string) =>
      form.getAll(name).map(String).map((item) => item.trim()).filter(Boolean);
    const budget = value("estimatedBudget");
    const targetCountries = values("targetCountries");
    const desiredStartDate = value("desiredStartDate");
    const desiredEndDate = value("desiredEndDate");
    if (targetCountries.length === 0) {
      setState({
        phase: "error",
        message: "Select at least one target country.",
      });
      return;
    }
    if (
      desiredStartDate &&
      desiredEndDate &&
      desiredEndDate < desiredStartDate
    ) {
      setState({
        phase: "error",
        message: "The desired end date cannot be earlier than the start date.",
      });
      return;
    }
    const payload = {
      fullName: value("fullName"),
      workEmail: value("workEmail"),
      company: value("company"),
      companyWebsite: value("companyWebsite"),
      campaignObjective: value("campaignObjective"),
      productOrService: value("productOrService"),
      targetAudience: value("targetAudience"),
      targetCountries,
      preferredCategories: values("preferredCategories"),
      preferredPlacements: values("preferredPlacements"),
      estimatedBudget: budget ? Number(budget) : null,
      desiredStartDate: desiredStartDate || null,
      desiredEndDate: desiredEndDate || null,
      creativeStatus: value("creativeStatus"),
      sponsoredContentInterest: form.has("sponsoredContentInterest"),
      newsletterSponsorshipInterest: form.has("newsletterSponsorshipInterest"),
      message: value("message"),
      consent: form.has("consent"),
      captchaToken: value("captchaToken"),
      website: value("website"),
      formStartedAt,
    };
    try {
      const response = await fetch("/api/advertising/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as {
        message?: string;
        reference?: string;
        error?: { message?: string };
      };
      if (!response.ok) {
        setState({
          phase: "error",
          message:
            result.error?.message ??
            "We could not accept the request. Review the form and try again.",
        });
        return;
      }
      setState({
        phase: "success",
        message: result.message ?? "Your request was received.",
        reference: result.reference,
      });
      formElement.reset();
    } catch {
      setState({
        phase: "error",
        message: "The request could not be sent. Check your connection and try again.",
      });
    }
  }

  return (
    <form className={styles.requestForm} onSubmit={submit}>
      <div className={styles.formIntro}>
        <p>Campaign request</p>
        <h1>Tell us what a useful partnership looks like.</h1>
        <span>
          This starts a review—not a reservation, contract, or charge. We do not
          accept sensitive-trait targeting or unlabeled editorial coverage.
        </span>
      </div>

      <div className={styles.formGrid}>
        <Field label="Full name" name="fullName" autoComplete="name" required />
        <Field
          label="Work email"
          name="workEmail"
          type="email"
          autoComplete="email"
          required
        />
        <Field label="Company" name="company" autoComplete="organization" required />
        <Field
          label="Company website"
          name="companyWebsite"
          type="url"
          placeholder="https://"
          pattern="https://.+"
          title="Enter a public HTTPS website."
          required
        />
        <Field label="Campaign objective" name="campaignObjective" required />
        <Field label="Product or service" name="productOrService" required />
      </div>

      <label className={styles.fullField}>
        <span>Target audience</span>
        <textarea name="targetAudience" rows={4} maxLength={1000} required />
      </label>

      <fieldset className={styles.choiceGroup}>
        <legend>Target countries (choose at least one)</legend>
        {["US", "CA", "MX", "GB"].map((country) => (
          <Check key={country} name="targetCountries" value={country} label={country} />
        ))}
      </fieldset>

      <fieldset className={styles.choiceGroup}>
        <legend>Preferred categories</legend>
        {categories.map((category) => (
          <Check
            key={category}
            name="preferredCategories"
            value={category}
            label={category}
          />
        ))}
      </fieldset>

      <fieldset className={styles.choiceGroup}>
        <legend>Preferred placements</legend>
        {placements.map((placement) => (
          <Check
            key={placement}
            name="preferredPlacements"
            value={placement}
            label={placement}
          />
        ))}
      </fieldset>

      <div className={styles.formGrid}>
        <Field
          label="Estimated budget (USD)"
          name="estimatedBudget"
          type="number"
          min="0"
          max="100000000"
          step="1"
        />
        <label>
          <span>Creative status</span>
          <select name="creativeStatus" defaultValue="UNKNOWN" required>
            <option value="UNKNOWN">Not sure yet</option>
            <option value="READY">Creative is ready</option>
            <option value="NEEDS_SUPPORT">Need creative support</option>
            <option value="NOT_STARTED">Not started</option>
          </select>
        </label>
        <Field label="Desired start date" name="desiredStartDate" type="date" />
        <Field label="Desired end date" name="desiredEndDate" type="date" />
      </div>

      <div className={styles.interests}>
        <Check
          name="sponsoredContentInterest"
          value="yes"
          label="I want to discuss clearly labeled sponsored content."
        />
        <Check
          name="newsletterSponsorshipInterest"
          value="yes"
          label="I want to discuss newsletter sponsorship."
        />
      </div>

      <label className={styles.fullField}>
        <span>Anything else we should know?</span>
        <textarea name="message" rows={5} maxLength={5000} />
      </label>

      <label className={styles.consent}>
        <input type="checkbox" name="consent" required />
        <span>
          I agree that the commercial team may use these details to evaluate and
          respond to this request.
        </span>
      </label>

      <div className={styles.honeypot} aria-hidden="true">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {unavailable ? (
        <p className={styles.formNotice} role="status">
          {captchaServerConfigured
            ? "Requests are paused because the browser abuse-verification challenge is not connected to this form yet."
            : "Requests are temporarily paused while required abuse verification is configured."}{" "}
          No details have been submitted.
        </p>
      ) : null}
      {state.phase === "success" ? (
        <div className={styles.formSuccess} role="status">
          <strong>Request received</strong>
          <span>{state.message}</span>
          {state.reference ? <small>Reference: {state.reference}</small> : null}
        </div>
      ) : null}
      {state.phase === "error" ? (
        <p className={styles.formError} role="alert">
          {state.message}
        </p>
      ) : null}
      <button
        className={styles.primaryAction}
        type="submit"
        disabled={unavailable || state.phase === "sending"}
      >
        {state.phase === "sending" ? "Sending…" : "Send campaign request"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  ...props
}: {
  label: string;
  name: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label>
      <span>{label}</span>
      <input name={name} {...props} />
    </label>
  );
}

function Check({
  name,
  value,
  label,
}: {
  name: string;
  value: string;
  label: string;
}) {
  return (
    <label className={styles.check}>
      <input type="checkbox" name={name} value={value} />
      <span>{label}</span>
    </label>
  );
}
