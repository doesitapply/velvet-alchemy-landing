import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  LayoutDashboard,
  Users,
  Search,
  Download,
  Mail,
  Cog,
  Shield,
  HelpCircle,
  LogOut,
} from "lucide-react";

export default function AppHeader() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const navItems = [
    { path: "/command-center", label: "Dashboard", icon: LayoutDashboard },
    { path: "/leads", label: "Leads", icon: Users },
    { path: "/scraper", label: "Scraper", icon: Search },
    { path: "/orchestrator", label: "Orchestrator", icon: Cog },
    { path: "/charmer", label: "Charmer", icon: Mail },
    { path: "/export", label: "Export", icon: Download },
    { path: "/governor", label: "Governor", icon: Shield },
    { path: "/help", label: "Help", icon: HelpCircle },
  ];

  if (!user) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b-2 border-gold/30 bg-black shadow-lg shadow-gold/10">
      <div className="container flex h-20 items-center justify-between px-6">
        {/* Logo - Larger and more prominent */}
        <Link href="/command-center">
          <div className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer">
            <div className="h-12 w-12 bg-[url('/images/alchemy-symbol.jpg')] bg-cover bg-center rounded-md border-2 border-gold/50 shadow-lg shadow-gold/20" />
            <div className="flex flex-col">
              <span className="font-serif text-2xl italic tracking-wide text-gold font-bold">
                Velvet Alchemy
              </span>
              <span className="text-xs text-white/50 tracking-wider uppercase">
                Revenue Instrument
              </span>
            </div>
          </div>
        </Link>

        {/* Main Navigation - Larger buttons with better contrast */}
        <nav className="hidden lg:flex items-center gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;

            return (
              <Button
                key={item.path}
                asChild
                variant={isActive ? "default" : "ghost"}
                size="lg"
                className={`gap-2 px-6 text-base font-medium ${
                  isActive
                    ? "bg-gold text-black hover:bg-gold/90 shadow-lg shadow-gold/30"
                    : "text-white/70 hover:text-white hover:bg-white/10 border border-white/10"
                }`}
              >
                <Link href={item.path}>
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              </Button>
            );
          })}
        </nav>

        {/* User Menu - Larger and more visible */}
        <div className="flex items-center gap-4">
          {user && (
            <div className="hidden md:flex flex-col items-end gap-1">
              <span className="text-base font-medium text-white">{user.name}</span>
              <span className="text-xs px-3 py-1 rounded-full bg-gold/20 text-gold border border-gold/40 uppercase tracking-wider font-bold">
                {user.role}
              </span>
            </div>
          )}
          
          <Button
            variant="outline"
            size="lg"
            onClick={() => logout()}
            className="border-2 border-white/30 text-white hover:bg-red-500/20 hover:border-red-500 hover:text-red-400 transition-all"
          >
            <LogOut className="h-5 w-5 mr-2" />
            <span className="font-medium">Logout</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
