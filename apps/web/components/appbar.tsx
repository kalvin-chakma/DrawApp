"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";
import { Menu, X, Pencil, LogIn, CircleUser, LogOut } from "lucide-react";
import { dashboardNavItems } from "./dashboard/nav-items";

// const navigation = [
//   { name: "About", href: "#about" },
//   { name: "Contact", href: "#contact" },
// ];

function ProfileMenu({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();

  const handleSignOut = () => {
    localStorage.removeItem("token");
    onNavigate?.();
    router.push("/signin");
  };

  return (
    <div className="relative group">
      <button
        type="button"
        className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-teal-600 to-green-600 text-white shadow-md hover:shadow-lg transition-shadow"
        aria-label="Account menu"
      >
        <CircleUser className="w-5 h-5" />
      </button>

      <div className="absolute right-0 top-full pt-2 opacity-0 invisible translate-y-1 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 transition-all duration-200 pointer-events-none group-hover:pointer-events-auto">
        <div className="w-56 bg-white rounded-xl border border-gray-100 shadow-xl py-2 overflow-hidden">
          <nav className="px-2 space-y-0.5">
            {dashboardNavItems.map(({ label, href, icon: Icon }) => {
              const isActive =
                href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(href);

              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                    isActive
                      ? "bg-gradient-to-r from-teal-50 to-green-50 text-teal-700 border border-teal-100"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                  )}
                >
                  <Icon
                    className={cn(
                      "w-4 h-4 flex-shrink-0",
                      isActive ? "text-teal-600" : "text-gray-400",
                    )}
                  />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-2 pt-2 border-t border-gray-100 px-2">
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-all duration-150"
            >
              <LogOut className="w-4 h-4 flex-shrink-0 text-gray-400" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Appbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem("token"));
  }, [pathname]);

  const handleSignIn = () => {
    router.push("/signin");
  };
  const handleSignUp = () => {
    router.push("/signup");
  };

  const handleSignOut = () => {
    localStorage.removeItem("token");
    setIsLoggedIn(false);
    setMobileMenuOpen(false);
    router.push("/signin");
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-200/50">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-teal-600 to-green-600 rounded-lg flex items-center justify-center">
              <Pencil className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-teal-600 to-green-600 bg-clip-text text-transparent">
              DrawTogether
            </span>
          </div>

          {/* Desktop Navigation
          <div className="hidden md:flex items-center gap-8">
            {navigation.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className="text-gray-600 hover:text-gray-900 transition-colors font-medium"
              >
                {item.name}
              </a>
            ))}
          </div> */}

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-4">
            {isLoggedIn ? (
              <ProfileMenu />
            ) : (
              <>
                <Button
                  variant="fam"
                  icon="LogIn"
                  className="text-gray-600 hover:text-gray-900 border"
                  onClick={handleSignIn}
                >
                  Sign In
                </Button>
                <Button
                  variant="gradient"
                  className="shadow-lg hover:shadow-xl"
                  onClick={handleSignUp}
                >
                  Get Started
                </Button>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button
              variant="fam"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div
          className={cn(
            "md:hidden overflow-hidden transition-all duration-300 ease-in-out",
            mobileMenuOpen ? "max-h-96 opacity-100 pb-4" : "max-h-0 opacity-0",
          )}
        >
          <div className="space-y-4 pt-4 border-t border-gray-200">
            {/* {navigation.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className="block text-gray-600 hover:text-gray-900 transition-colors font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.name}
              </a>
            ))} */}

            {isLoggedIn ? (
              <div className="space-y-1 pt-2 border-t border-gray-200">
                {dashboardNavItems.map(({ label, href, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                  >
                    <Icon className="w-4 h-4 text-gray-400" />
                    {label}
                  </Link>
                ))}
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex items-center gap-3 w-full px-2 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
                >
                  <LogOut className="w-4 h-4 text-gray-400" />
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="flex flex-col text-center gap-2 pt-4">
                <Button
                  variant="fam"
                  className="justify-center border"
                  onClick={handleSignIn}
                >
                  Sign In
                </Button>
                <Button variant="gradient" onClick={handleSignUp}>
                  Get Started
                </Button>
              </div>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
