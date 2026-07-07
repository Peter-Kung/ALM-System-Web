export const appSections = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/manage/accounts", label: "Accounts" },
  { href: "/manage/assets", label: "Assets" },
  { href: "/manage/holdings", label: "Holdings" },
  { href: "/manage/liabilities", label: "Liabilities" },
  { href: "/manage/prices", label: "Prices" },
  { href: "/manage/valuation", label: "Valuation" },
  { href: "/manage/snapshots", label: "Snapshots" },
] as const;

export const managementSections = new Set(
  appSections
    .map((section) => section.href)
    .filter((href) => href.startsWith("/manage/"))
    .map((href) => href.replace("/manage/", "")),
);
