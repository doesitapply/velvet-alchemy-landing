import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { 
  LayoutDashboard, 
  Users, 
  Search, 
  FileDown, 
  Mail, 
  Cog, 
  Shield,
  HelpCircle,
  LogOut
} from "lucide-react";

export function TopNav() {
  const { user, logout } = useAuth();

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-white/20 bg-black/95 backdrop-blur-sm">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link href="/command-center">
          <a className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="h-8 w-8 bg-[url('/images/alchemy-symbol.jpg')] bg-cover bg-center rounded-sm border border-gold/50" />
            <span className="font-serif text-xl italic tracking-wide text-gold">
              Velvet Alchemy
            </span>
          </a>
        </Link>

        {/* Main Navigation */}
        <div className="hidden md:flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-white/80 hover:text-gold hover:bg-white/10" asChild>
            <Link href="/command-center">
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Dashboard
            </Link>
          </Button>
          
          <Button variant="ghost" size="sm" className="text-white/80 hover:text-gold hover:bg-white/10" asChild>
            <Link href="/leads">
              <Users className="h-4 w-4 mr-2" />
              Leads
            </Link>
          </Button>
          
          <Button variant="ghost" size="sm" className="text-white/80 hover:text-gold hover:bg-white/10" asChild>
            <Link href="/scraper">
              <Search className="h-4 w-4 mr-2" />
              Scraper
            </Link>
          </Button>
          
          <Button variant="ghost" size="sm" className="text-white/80 hover:text-gold hover:bg-white/10" asChild>
            <Link href="/orchestrator">
              <Cog className="h-4 w-4 mr-2" />
              Orchestrator
            </Link>
          </Button>
          
          <Button variant="ghost" size="sm" className="text-white/80 hover:text-gold hover:bg-white/10" asChild>
            <Link href="/charmer">
              <Mail className="h-4 w-4 mr-2" />
              Charmer
            </Link>
          </Button>
          
          <Button variant="ghost" size="sm" className="text-white/80 hover:text-gold hover:bg-white/10" asChild>
            <Link href="/export">
              <FileDown className="h-4 w-4 mr-2" />
              Export
            </Link>
          </Button>
          
          <Button variant="ghost" size="sm" className="text-white/80 hover:text-gold hover:bg-white/10" asChild>
            <Link href="/governor">
              <Shield className="h-4 w-4 mr-2" />
              Governor
            </Link>
          </Button>
        </div>

        {/* User Menu */}
        <div className="flex items-center gap-4">
          {user && (
            <div className="hidden sm:flex items-center gap-2 text-sm text-white/60">
              <span className="text-white/80">{user.name}</span>
              <span className="text-xs px-2 py-1 rounded bg-gold/20 text-gold border border-gold/30">
                {user.role}
              </span>
            </div>
          )}
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => logout()}
            className="border-white/20 text-white/80 hover:bg-white/10 hover:text-gold"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>
    </nav>
  );
}
