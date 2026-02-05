import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { SoundProvider } from "./contexts/SoundContext";
import Home from "@/pages/Home";
import LandingHome from "@/pages/LandingHome";
import CustomerPortal from "@/pages/CustomerPortal";
import About from "@/pages/About";
import GovernorDashboard from "./pages/GovernorDashboard";
import Charmer from "./pages/Charmer";
import Orchestrator from "./pages/Orchestrator";
import CommandCenter from "./pages/CommandCenter";
import Dashboard from "./pages/Dashboard";
import LeadDetail from "./pages/LeadDetail";
import Leads from "./pages/Leads";
import Help from "./pages/Help";
import BusinessScraper from "./pages/BusinessScraper";
import Export from "./pages/Export";
import RevenueDashboard from "./pages/RevenueDashboard";
import CostDashboard from "./pages/CostDashboard";
import OutreachApproval from "./pages/OutreachApproval";
import VoiceSetup from "./pages/VoiceSetup";
import AIProviders from "./pages/AIProviders";
import SalesPacket from "@/pages/SalesPacket";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";
import Security from "@/pages/Security";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path="/" component={LandingHome} />
      <Route path="/customer-portal" component={CustomerPortal} />
      <Route path="/old-home" component={Home} />
      <Route path="/about" component={About} />
      <Route path="/governor" component={GovernorDashboard} />
      <Route path={"/charmer"} component={Charmer} />
      <Route path={"/orchestrator"} component={Orchestrator} />
      <Route path="/command-center" component={CommandCenter} />
      <Route path="/dashboard">
        <Redirect to="/command-center" />
      </Route>
      <Route path="/leads" component={Leads} />
      <Route path="/leads/:id" component={LeadDetail} />
      <Route path="/leads/:id/packet" component={SalesPacket} />
      <Route path="/help" component={Help} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/security" component={Security} />
      <Route path="/scraper" component={BusinessScraper} />
      <Route path="/export" component={Export} />
      <Route path="/revenue" component={RevenueDashboard} />
      <Route path="/costs" component={CostDashboard} />
      <Route path="/outreach-approval" component={OutreachApproval} />
      <Route path="/voice-setup" component={VoiceSetup} />
      <Route path="/ai-providers" component={AIProviders} />
      <Route path="/404" component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <SoundProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </SoundProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
