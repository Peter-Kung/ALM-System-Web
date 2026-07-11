type NavigationItem = {
  href: string;
  label: string;
  shortLabel: string;
};

export type NavigationRole = "ADMIN" | "USER";

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

export const adminNavigation: readonly NavigationGroup[] = [
  {
    heading: "Admin",
    items: [{ href: "/manage/users", label: "Users", shortLabel: "09" }],
  },
] as const;

export const footerNavigation: readonly NavigationItem[] = [
  { href: "/settings/account", label: "Settings", shortLabel: "10" },
] as const;

export const appSections: readonly NavigationItem[] = primaryNavigation.flatMap(
  (group) => group.items,
);

export const adminSections: readonly NavigationItem[] = adminNavigation.flatMap(
  (group) => group.items,
);

export function getPrimaryNavigationForRole(role: NavigationRole) {
  return role === "ADMIN" ? [...primaryNavigation, ...adminNavigation] : primaryNavigation;
}

export function canAccessManagementSection(section: string, role: NavigationRole) {
  if (role === "ADMIN" && section === "users") {
    return true;
  }

  return baseManagementSections.has(section);
}

export const baseManagementSections = new Set(
  appSections
    .map((section) => section.href)
    .filter((href) => href.startsWith("/manage/"))
    .map((href) => href.replace("/manage/", "")),
);

export const managementSections = new Set([
  ...baseManagementSections,
  ...adminSections
    .map((section) => section.href)
    .filter((href) => href.startsWith("/manage/"))
    .map((href) => href.replace("/manage/", "")),
]);
