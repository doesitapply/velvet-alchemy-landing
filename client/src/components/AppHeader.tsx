import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState } from "react";
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
  Menu,
  X,
  ChevronDown,
  DollarSign,
  Activity,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export default function AppHeader() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Grouped navigation items for better organization
  const navGroups = {
    main: [
      { path: "/command-center", label: "Dashboard", icon: LayoutDashboard },
      { path: "/leads", label: "Leads", icon: Users },
      { path: "/revenue", label: "Revenue", icon: DollarSign },
      { path: "/costs", label: "Costs", icon: Activity },
    ],
    tools: [
      { path: "/scraper", label: "Scraper", icon: Search },
      { path: "/orchestrator", label: "Orchestrator", icon: Cog },
      { path: "/charmer", label: "Charmer", icon: Mail },
    ],
    system: [
      { path: "/export", label: "Export", icon: Download },
      { path: "/governor", label: "Governor", icon: Shield },
      { path: "/help", label: "Help", icon: HelpCircle },
    ],
  };

  const allNavItems = [...navGroups.main, ...navGroups.tools, ...navGroups.system];

  if (!user) {
    return null;
  }

  const NavButton = ({ item, onClick }: { item: any; onClick?: () => void }) => {
    const Icon = item.icon;
    const isActive = location === item.path;

    return (
      <Button
        asChild
        variant={isActive ? "default" : "ghost"}
        size="lg"
        className={`gap-2 px-6 text-base font-medium transition-all duration-200 ${
          isActive
            ? "bg-gold text-black hover:bg-gold/90 shadow-lg shadow-gold/30"
            : "text-white/70 hover:text-white hover:bg-white/10 border border-white/10 hover:border-white/30"
        }`}
        onClick={onClick}
      >
        <Link href={item.path}>
          <Icon className="h-5 w-5" />
          {item.label}
        </Link>
      </Button>
    );
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b-2 border-gold/30 bg-black/95 backdrop-blur-md shadow-lg shadow-gold/10">
      <div className="container flex h-20 items-center justify-between px-4 md:px-6">
        {/* Logo */}
        <Link href="/command-center">
          <div className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer">
            <div className="h-10 w-10 md:h-12 md:w-12 bg-[url('/images/alchemy-symbol.jpg')] bg-cover bg-center rounded-md border-2 border-gold/50 shadow-lg shadow-gold/20" />
            <div className="flex flex-col">
              <span className="font-serif text-xl md:text-2xl italic tracking-wide text-gold font-bold">
                Velvet Alchemy
              </span>
              <span className="hidden sm:block text-xs text-white/50 tracking-wider uppercase">
                Revenue Instrument
              </span>
            </div>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-2">
          {/* Main Items */}
          {navGroups.main.map((item) => (
            <NavButton key={item.path} item={item} />
          ))}

          {/* Tools Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="lg"
                className="gap-2 px-6 text-base font-medium text-white/70 hover:text-white hover:bg-white/10 border border-white/10 hover:border-white/30 transition-all duration-200"
              >
                <Cog className="h-5 w-5" />
                Tools
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-black/95 backdrop-blur-md border-gold/30">
              {navGroups.tools.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.path;
                return (
                  <DropdownMenuItem key={item.path} asChild>
                    <Link href={item.path}>
                      <div
                        className={`flex items-center gap-3 w-full px-2 py-2 cursor-pointer ${
                          isActive ? "text-gold font-semibold" : "text-white/70 hover:text-white"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        {item.label}
                      </div>
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* System Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="lg"
                className="gap-2 px-6 text-base font-medium text-white/70 hover:text-white hover:bg-white/10 border border-white/10 hover:border-white/30 transition-all duration-200"
              >
                <Shield className="h-5 w-5" />
                System
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-black/95 backdrop-blur-md border-gold/30">
              {navGroups.system.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.path;
                return (
                  <DropdownMenuItem key={item.path} asChild>
                    <Link href={item.path}>
                      <div
                        className={`flex items-center gap-3 w-full px-2 py-2 cursor-pointer ${
                          isActive ? "text-gold font-semibold" : "text-white/70 hover:text-white"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        {item.label}
                      </div>
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        {/* Right Side: User Info + Mobile Menu */}
        <div className="flex items-center gap-3 md:gap-4">
          {/* User Info - Desktop */}
          {user && (
            <div className="hidden md:flex flex-col items-end gap-1">
              <span className="text-sm md:text-base font-medium text-white">{user.name}</span>
              <span className="text-xs px-3 py-1 rounded-full bg-gold/20 text-gold border border-gold/40 uppercase tracking-wider font-bold">
                {user.role}
              </span>
            </div>
          )}

          {/* Logout Button - Desktop */}
          <Button
            variant="outline"
            size="lg"
            onClick={() => logout()}
            className="hidden lg:flex border-2 border-white/30 text-white hover:bg-red-500/20 hover:border-red-500 hover:text-red-400 transition-all"
          >
            <LogOut className="h-5 w-5 mr-2" />
            <span className="font-medium">Logout</span>
          </Button>

          {/* Mobile Menu Button */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="lg"
                className="lg:hidden border-2 border-gold/50 text-gold hover:bg-gold/10"
              >
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 bg-black/98 border-l-2 border-gold/30">
              <SheetHeader>
                <SheetTitle className="text-left">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-10 w-10 bg-[url('/images/alchemy-symbol.jpg')] bg-cover bg-center rounded-md border-2 border-gold/50" />
                    <div className="flex flex-col">
                      <span className="font-serif text-xl italic text-gold font-bold">
                        Velvet Alchemy
                      </span>
                      <span className="text-xs text-white/50 tracking-wider uppercase font-normal">
                        Revenue Instrument
                      </span>
                    </div>
                  </div>
                </SheetTitle>
              </SheetHeader>

              {/* Mobile Navigation */}
              <nav className="flex flex-col gap-2 mt-6">
                {/* User Info - Mobile */}
                {user && (
                  <div className="flex items-center gap-3 p-4 mb-4 rounded-lg bg-gold/10 border border-gold/30">
                    <div className="flex flex-col flex-1">
                      <span className="text-base font-medium text-white">{user.name}</span>
                      <span className="text-xs text-white/60">{user.email || "Admin User"}</span>
                    </div>
                    <span className="text-xs px-3 py-1 rounded-full bg-gold/20 text-gold border border-gold/40 uppercase tracking-wider font-bold">
                      {user.role}
                    </span>
                  </div>
                )}

                {/* Main Section */}
                <div className="mb-4">
                  <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2 px-2">
                    Main
                  </h3>
                  {navGroups.main.map((item) => {
                    const Icon = item.icon;
                    const isActive = location === item.path;
                    return (
                      <Link key={item.path} href={item.path}>
                        <div
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all ${
                            isActive
                              ? "bg-gold text-black font-semibold"
                              : "text-white/70 hover:text-white hover:bg-white/10"
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                          {item.label}
                        </div>
                      </Link>
                    );
                  })}
                </div>

                {/* Tools Section */}
                <div className="mb-4">
                  <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2 px-2">
                    Tools
                  </h3>
                  {navGroups.tools.map((item) => {
                    const Icon = item.icon;
                    const isActive = location === item.path;
                    return (
                      <Link key={item.path} href={item.path}>
                        <div
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all ${
                            isActive
                              ? "bg-gold text-black font-semibold"
                              : "text-white/70 hover:text-white hover:bg-white/10"
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                          {item.label}
                        </div>
                      </Link>
                    );
                  })}
                </div>

                {/* System Section */}
                <div className="mb-4">
                  <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2 px-2">
                    System
                  </h3>
                  {navGroups.system.map((item) => {
                    const Icon = item.icon;
                    const isActive = location === item.path;
                    return (
                      <Link key={item.path} href={item.path}>
                        <div
                          onClick={() => setMobileMenuOpen(false)}
                          className={`flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all ${
                            isActive
                              ? "bg-gold text-black font-semibold"
                              : "text-white/70 hover:text-white hover:bg-white/10"
                          }`}
                        >
                          <Icon className="h-5 w-5" />
                          {item.label}
                        </div>
                      </Link>
                    );
                  })}
                </div>

                {/* Logout Button - Mobile */}
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full mt-4 border-2 border-red-500/50 text-red-400 hover:bg-red-500/20 hover:border-red-500 transition-all"
                >
                  <LogOut className="h-5 w-5 mr-2" />
                  <span className="font-medium">Logout</span>
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
