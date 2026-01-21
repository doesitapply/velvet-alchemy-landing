import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { SoundProvider } from "./contexts/SoundContext";
import Home from "@/pages/Home";
import Landing from "@/pages/Landing";
import GovernorDashboard from "./pages/GovernorDashboard";
import Charmer from "./pages/Charmer";
import Orchestrator from "./pages/Orchestrator";
import CommandCenter from "./pages/CommandCenter";
import Dashboard from "./pages/Dashboard";
import LeadDetail from "./pages/LeadDetail";
import Leads from "./pages/Leads";
import Help from "./pages/Help";
import BusinessScraper from "./pages/BusinessScraper";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
       <Route path="/" component={Landing} />
      <Route path="/old-home" component={Home} />
       <Route path="/governor" component={GovernorDashboard} />
           <Route path={"/charmer"} component={Charmer} />
      <Route path={"/orchestrator"} component={Orchestrator} />
      <Route path="/command-center" component={CommandCenter} />
      <Route path="/leads" component={Leads} />
      <Route path="/leads/:id" component={LeadDetail} />
      <Route path="/help" component={Help} />
      <Route path="/scraper" component={BusinessScraper} />
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
