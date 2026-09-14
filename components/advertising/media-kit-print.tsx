"use client";

import styles from "./commercial-pages.module.css";

export function MediaKitPrintButton() {
  return (
    <button
      className={styles.secondaryAction}
      type="button"
      onClick={() => window.print()}
    >
      Print or save as PDF
    </button>
  );
}

