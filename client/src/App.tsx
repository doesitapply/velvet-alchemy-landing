import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { SoundProvider } from "./contexts/SoundContext";
import Home from "./pages/Home";
import GovernorDashboard from "./pages/GovernorDashboard";
import Dashboard from "./pages/Dashboard";
import LeadDetail from "./pages/LeadDetail";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/governor"} component={GovernorDashboard} />
      <Route path={"/dashboard"} component={Dashboard} />
      <Route path={"/leads/:id"} component={LeadDetail} />
      <Route path={"/404"} component={NotFound} />
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
