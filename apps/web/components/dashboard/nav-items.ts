import {
  LayoutDashboard,
  DoorOpen,
  FileText,
  User,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface DashboardNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const dashboardNavItems: DashboardNavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Rooms", href: "/dashboard/rooms", icon: DoorOpen },
  { label: "Notes", href: "/dashboard/notes", icon: FileText },
  { label: "Profile", href: "/dashboard/profile", icon: User },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];
