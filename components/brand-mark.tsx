/* eslint-disable @next/next/no-img-element -- brand assets are runtime-configured */
import Link from "next/link";
import { NorthlineMonogram } from "./brand/northline-monogram";
import {
  brandDefaults,
  isAssetReference,
  type BrandConfig,
} from "@/lib/brand/config";

export function BrandMark({
  brand = brandDefaults,
  inverted = false,
  showWordmark = false,
}: {
  brand?: BrandConfig;
  inverted?: boolean;
  showWordmark?: boolean;
}) {
  return (
    <Link
      className={`brand-mark${inverted ? " brand-mark--inverted" : ""}`}
      href="/"
      aria-label={`${brand.name} home`}
    >
      <span className="brand-mark__signal" aria-hidden="true">
        {isAssetReference(brand.logo) ? (
          <img src={brand.logo} alt="" width="32" height="32" />
        ) : (
          <NorthlineMonogram size={32} variant={inverted ? "mono" : "brand"} />
        )}
      </span>
      <span className="brand-mark__wordmark">
        {showWordmark ? (
          isAssetReference(brand.wordmark) ? (
            <img
              className="brand-mark__wordmark-image"
              src={brand.wordmark}
              alt={brand.name}
              height="28"
            />
          ) : (
            <span className="brand-mark__word">{brand.wordmark}</span>
          )
        ) : (
          <span className="sr-only">{brand.name}</span>
        )}
      </span>
    </Link>
  );
}
