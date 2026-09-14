"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  FileImage,
  FileText,
  Gauge,
  Settings,
  Users,
} from "lucide-react";
import styles from "./portal.module.css";

const navigation = [
  { href: "/advertiser", label: "Overview", icon: Gauge },
  { href: "/advertiser/campaigns", label: "Campaigns", icon: Building2 },
  { href: "/advertiser/creatives", label: "Creatives", icon: FileImage },
  { href: "/advertiser/reports", label: "Reports", icon: BarChart3 },
  { href: "/advertiser/invoices", label: "Invoices", icon: FileText },
  { href: "/advertiser/team", label: "Team", icon: Users },
  { href: "/advertiser/settings", label: "Settings", icon: Settings },
] as const;

export function AdvertiserNavigation() {
  const pathname = usePathname();
  return (
    <nav aria-label="Advertiser portal" className={styles.portalNav}>
      {navigation.map((item) => {
        const Icon = item.icon;
        const active =
          item.href === "/advertiser"
            ? pathname === item.href
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={active ? styles.active : undefined}
          >
            <Icon aria-hidden size={17} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

