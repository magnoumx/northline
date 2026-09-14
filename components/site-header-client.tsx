"use client";

import {
  Bookmark,
  Menu,
  Moon,
  Search,
  Sun,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { BrandConfig } from "@/lib/brand/config";
import {
  LEGACY_READER_PREFERENCES_KEY,
  normalizeReadingPreferences,
  READER_PREFERENCES_EVENT,
  READER_PREFERENCES_KEY,
  resolveReaderTheme,
  type ReaderTheme,
} from "@/lib/reader/preferences";
import { BrandMark } from "./brand-mark";

/**
 * The five sections a reader actually browses by. Everything else that used
 * to live here - Trending, Sections, Newsletter, Advertise, Saved, My
 * briefing, the theme toggle - competed for the same 80px of height. Trend
 * intelligence is a newsroom tool, not a public nav item; the rest moved into
 * the account menu or the footer, where they still work but no longer crowd
 * the one row a reader actually scans.
 */
const primaryLinks = [
  ["Latest", "/latest"],
  ["U.S.", "/topics/u-s-news"],
  ["Sports", "/topics/sports"],
  ["Entertainment", "/topics/entertainment"],
  ["Weather", "/topics/weather"],
] as const;

export function SiteHeaderClient({
  brand,
  demoMode = false,
  suggestedSearches = [],
}: {
  brand: BrandConfig;
  demoMode?: boolean;
  suggestedSearches?: string[];
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
    const syncTheme = () => {
      const preferredTheme = readPreferredTheme();
      const resolved = resolveReaderTheme(preferredTheme, colorScheme.matches);
      document.documentElement.dataset.theme = resolved;
      setDark(resolved === "dark");
    };
    const timer = window.setTimeout(syncTheme, 0);
    window.addEventListener("storage", syncTheme);
    window.addEventListener(READER_PREFERENCES_EVENT, syncTheme);
    colorScheme.addEventListener("change", syncTheme);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("storage", syncTheme);
      window.removeEventListener(READER_PREFERENCES_EVENT, syncTheme);
      colorScheme.removeEventListener("change", syncTheme);
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (searchOpen && !dialog.open) {
      dialog.showModal();
      window.setTimeout(() => searchInputRef.current?.focus(), 0);
    } else if (!searchOpen && dialog.open) {
      dialog.close();
    }
  }, [searchOpen]);

  useEffect(() => {
    function handleOutsideActivity(event: KeyboardEvent | MouseEvent) {
      if (event instanceof KeyboardEvent && event.key === "Escape") {
        setMenuOpen(false);
        return;
      }
      if (
        event instanceof MouseEvent &&
        menuOpen &&
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !menuTriggerRef.current?.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    }
    window.addEventListener("keydown", handleOutsideActivity);
    window.addEventListener("mousedown", handleOutsideActivity);
    return () => {
      window.removeEventListener("keydown", handleOutsideActivity);
      window.removeEventListener("mousedown", handleOutsideActivity);
    };
  }, [menuOpen]);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    writePreferredTheme(next ? "dark" : "light");
  }

  function closeSearch() {
    setSearchOpen(false);
    window.setTimeout(() => searchTriggerRef.current?.focus(), 0);
  }

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {demoMode ? (
        <div className="demo-ribbon" role="note">
          <strong>PRODUCT PREVIEW</strong>
          <span>Fictional stories and demo newsroom data — never current news</span>
        </div>
      ) : null}
      <header className="site-header">
        {/* Its own row, full width: the wordmark used to lose to a 32px mark
            beside a dense action row. Nothing competes with it here. */}
        <div className="shell site-header__brand-row">
          <BrandMark brand={brand} showWordmark />
        </div>
        <div className="shell site-header__nav-row">
          <nav
            id="primary-navigation"
            className="primary-navigation"
            aria-label="Primary navigation"
          >
            {primaryLinks.map(([label, href]) => (
              <Link key={href} href={href}>
                {label}
              </Link>
            ))}
          </nav>
          <div className="site-header__actions">
            <button
              ref={searchTriggerRef}
              className="icon-button"
              type="button"
              aria-label={`Search ${brand.name}`}
              onClick={() => setSearchOpen(true)}
            >
              <Search aria-hidden="true" />
            </button>
            <div className="account-menu">
              <button
                ref={menuTriggerRef}
                className="icon-button"
                type="button"
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                aria-expanded={menuOpen}
                aria-controls="account-menu-panel"
                onClick={() => setMenuOpen((value) => !value)}
              >
                {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
              </button>
              {menuOpen ? (
                <div id="account-menu-panel" className="account-menu__panel" ref={menuRef}>
                  {/* Visible only where the row above is hidden (narrow
                      viewports) - the section links still need a path
                      somewhere once they stop fitting inline. */}
                  <nav className="account-menu__sections" aria-label="Sections">
                    {primaryLinks.map(([label, href]) => (
                      <Link key={href} href={href} onClick={() => setMenuOpen(false)}>
                        {label}
                      </Link>
                    ))}
                  </nav>
                  <Link href="/saved" onClick={() => setMenuOpen(false)}>
                    <Bookmark aria-hidden="true" /> Saved stories
                  </Link>
                  <Link href="/account" onClick={() => setMenuOpen(false)}>
                    <UserRound aria-hidden="true" /> My briefing
                  </Link>
                  <button type="button" onClick={toggleTheme}>
                    {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
                    {dark ? "Light theme" : "Dark theme"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <dialog
        ref={dialogRef}
        className="search-dialog"
        aria-labelledby="search-dialog-title"
        onCancel={(event) => {
          event.preventDefault();
          closeSearch();
        }}
        onClose={() => setSearchOpen(false)}
      >
        <div className="search-dialog__header">
          <div>
            <p>SEARCH</p>
            <h2 id="search-dialog-title">Search {brand.name}</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Close search"
            onClick={closeSearch}
          >
            <X aria-hidden="true" />
          </button>
        </div>
        <form action="/search" className="search-dialog__form">
          <label htmlFor="site-search">Stories, topics, people, and sources</label>
          <div>
            <Search aria-hidden="true" />
            <input
              ref={searchInputRef}
              id="site-search"
              name="q"
              type="search"
              autoComplete="off"
              placeholder="Search Northline"
            />
            <button type="submit">Search</button>
          </div>
        </form>
        {suggestedSearches.length > 0 ? (
          <div className="search-dialog__suggestions">
            <span>Try</span>
            {suggestedSearches.map((term) => (
              <Link
                key={term}
                href={`/search?q=${encodeURIComponent(term)}`}
                onClick={closeSearch}
              >
                {term}
              </Link>
            ))}
          </div>
        ) : null}
      </dialog>
    </>
  );
}

function readPreferredTheme(): ReaderTheme {
  const current = readStoredPreferenceRecord(READER_PREFERENCES_KEY);
  if (Object.keys(current).length) {
    return normalizeReadingPreferences(current).theme;
  }
  const legacyTheme = window.localStorage.getItem("northline-theme");
  return legacyTheme === "light" || legacyTheme === "dark"
    ? legacyTheme
    : "system";
}

function writePreferredTheme(theme: "light" | "dark") {
  try {
    const current = readStoredPreferenceRecord(READER_PREFERENCES_KEY);
    const legacy = readStoredPreferenceRecord(LEGACY_READER_PREFERENCES_KEY);
    const source = Object.keys(current).length ? current : legacy;
    const next = {
      ...source,
      ...normalizeReadingPreferences(source),
      theme,
    };
    window.localStorage.setItem(READER_PREFERENCES_KEY, JSON.stringify(next));
    window.localStorage.setItem("northline-theme", theme);
    window.dispatchEvent(new CustomEvent(READER_PREFERENCES_EVENT));
  } catch {
    window.localStorage.setItem("northline-theme", theme);
  }
}

function readStoredPreferenceRecord(key: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) ?? "{}") as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
