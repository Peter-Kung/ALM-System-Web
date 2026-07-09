type NavigationItem = {
  href: string;
  label: string;
  shortLabel: string;
};

type NavigationGroup = {
  heading: string;
  items: readonly NavigationItem[];
};

export const primaryNavigation: readonly NavigationGroup[] = [
  {
    heading: "Dashboard",
    items: [{ href: "/dashboard", label: "Dashboard", shortLabel: "01" }],
  },
  {
    heading: "Data",
    items: [
      { href: "/manage/accounts", label: "Accounts", shortLabel: "02" },
      { href: "/manage/assets", label: "Assets", shortLabel: "03" },
      { href: "/manage/holdings", label: "Holdings", shortLabel: "04" },
      { href: "/manage/liabilities", label: "Liabilities", shortLabel: "05" },
      { href: "/manage/prices", label: "Prices", shortLabel: "06" },
    ],
  },
  {
    heading: "Workflow",
    items: [
      { href: "/manage/valuation", label: "Valuation", shortLabel: "07" },
      { href: "/manage/snapshots", label: "Snapshots", shortLabel: "08" },
    ],
  },
] as const;

export const footerNavigation: readonly NavigationItem[] = [
  { href: "/settings/account", label: "Settings", shortLabel: "09" },
] as const;

export const appSections: readonly NavigationItem[] = primaryNavigation.flatMap(
  (group) => group.items,
);

export const managementSections = new Set(
  appSections
    .map((section) => section.href)
    .filter((href) => href.startsWith("/manage/"))
    .map((href) => href.replace("/manage/", "")),
);
