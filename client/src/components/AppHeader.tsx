import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import {
  LayoutDashboard,
  Eye,
  Sparkles,
  Mail,
  Shield,
  Zap,
  LogOut,
  Home,
  HelpCircle,
  Search,
  Download,
} from "lucide-react";

export default function AppHeader() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const navItems = [
    { path: "/command-center", label: "Command Center", icon: LayoutDashboard },
    { path: "/leads", label: "Leads", icon: Eye },
    { path: "/scraper", label: "Scraper", icon: Search },
    { path: "/export", label: "Export", icon: Download },
    { path: "/charmer", label: "Charmer", icon: Mail },
    { path: "/orchestrator", label: "Orchestrator", icon: Zap },
    { path: "/governor", label: "Governor", icon: Shield },
    { path: "/help", label: "Help", icon: HelpCircle },
  ];

  if (!user) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-black/80 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="h-8 w-8 bg-[url('/images/alchemy-symbol.jpg')] bg-cover bg-center rounded-sm border border-white/20" />
            <span className="font-serif text-xl italic tracking-wide text-gold">
              Velvet Alchemy
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.path;

              return (
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className={`gap-2 ${
                    isActive
                      ? "bg-white/10 text-gold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Link key={item.path} href={item.path} className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </Button>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground hidden sm:inline-block">
            {user.name || user.email}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => logout()}
            className="gap-2 border-white/20 hover:bg-white/5"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
