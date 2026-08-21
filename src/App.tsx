import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AccountGate } from "@/components/AccountGate";
import { AuthProvider } from "@/components/AuthProvider";
import { OperationsShell } from "@/components/OperationsShell";
import { PackSaleBanner } from "@/components/PackSaleBanner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Index from "./pages/Index";
import LiveStkzPreview from "./pages/LiveStkzPreview";
import MarketHeat from "./pages/MarketHeat";
import MarketOperations from "./pages/MarketOperations";
import MarketTransparency from "./pages/MarketTransparency";
import NotFound from "./pages/NotFound";
import Packs from "./pages/Packs";
import PackManagement from "./pages/PackManagement";
import Profile from "./pages/Profile";
import ProviderConfiguration from "./pages/ProviderConfiguration";
import YoutubeDiagnostics from "./pages/YoutubeDiagnostics";
import AuthPage from "./pages/auth/AuthPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <PackSaleBanner />
          <Routes>
            <Route path="/" element={<AccountGate><Index /></AccountGate>} />
            <Route path="/heat" element={<AccountGate><MarketHeat /></AccountGate>} />
            <Route path="/packs" element={<AccountGate><Packs /></AccountGate>} />
            <Route path="/profile" element={<AccountGate><Profile /></AccountGate>} />
            <Route path="/operations" element={<AccountGate><OperationsShell><MarketOperations /></OperationsShell></AccountGate>} />
            <Route path="/operations/packs" element={<AccountGate><OperationsShell><PackManagement /></OperationsShell></AccountGate>} />
            <Route path="/operations/providers" element={<AccountGate><OperationsShell><ProviderConfiguration /></OperationsShell></AccountGate>} />
            <Route path="/operations/live-stkz" element={<AccountGate><OperationsShell><LiveStkzPreview /></OperationsShell></AccountGate>} />
            <Route path="/live-stkz" element={<AccountGate><OperationsShell><LiveStkzPreview /></OperationsShell></AccountGate>} />
            <Route path="/youtube-diagnostics" element={<AccountGate><YoutubeDiagnostics /></AccountGate>} />
            <Route path="/market-data" element={<AccountGate><MarketTransparency /></AccountGate>} />
            <Route path="/auth/:path" element={<AuthPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;