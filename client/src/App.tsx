import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { LanguageProvider } from "./contexts/LanguageContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import AdminDashboard from "./pages/AdminDashboard";
import AdminLogin from "./pages/AdminLogin";
import AdminStatus from "./pages/AdminStatus";
import AdminCoverage from "./pages/AdminCoverage";
import CustomerDashboard from "./pages/CustomerDashboard";
import Enroll from "./pages/Enroll";
import GwalaDashboard from "./pages/GwalaDashboard";
import GwalaEarnings from "./pages/GwalaEarnings";
import GwalaStops from "./pages/GwalaStops";
import Home from "./pages/Home";
import HelpCenter from "./pages/HelpCenter";
import Legal from "./pages/Legal";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Subscribe from "./pages/Subscribe";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/login"} component={Login} />
      <Route path={"/signup"} component={Signup} />
      <Route path={"/admin-login"} component={AdminLogin} />
      <Route path={"/subscribe"} component={Subscribe} />
      <Route path={"/enroll"} component={Enroll} />
      <Route path={"/account"} component={CustomerDashboard} />
      <Route path={"/gwala"} component={GwalaDashboard} />
      <Route path={"/gwala/earnings"} component={GwalaEarnings} />
      <Route path={"/gwala/stops"} component={GwalaStops} />
      <Route path={"/admin"} component={AdminDashboard} />
      <Route path={"/admin/status"} component={AdminStatus} />
      <Route path={"/admin/coverage"} component={AdminCoverage} />
      <Route path={"/help"} component={HelpCenter} />
      <Route path={"/terms"} component={Legal} />
      <Route path={"/privacy"} component={Legal} />
      <Route path={"/refund-policy"} component={Legal} />
      <Route path={"/status"} component={Legal} />
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
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <LanguageProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
