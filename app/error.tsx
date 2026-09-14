"use client";

import { RefreshCw } from "lucide-react";
import { brandDefaults } from "@/lib/brand/config";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="system-state">
      <div className="system-state__brand">
        {brandDefaults.name}
      </div>
      <div>
        <span>500</span>
        <h1>The page hit an unexpected problem.</h1>
        <p>
          No editorial action was completed. You can retry safely while the
          page reloads. If the problem continues, contact the newsroom owner.
        </p>
        <button type="button" onClick={reset}>
          <RefreshCw size={16} /> Try again
        </button>
      </div>
    </main>
  );
}
