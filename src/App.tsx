import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AccountGate } from "@/components/AccountGate";
import { AuthProvider } from "@/components/AuthProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Index from "./pages/Index";
import LiveStkzPreview from "./pages/LiveStkzPreview";
import MarketOperations from "./pages/MarketOperations";
import MarketTransparency from "./pages/MarketTransparency";
import NotFound from "./pages/NotFound";
import Profile from "./pages/Profile";
import AuthPage from "./pages/auth/AuthPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<AccountGate><Index /></AccountGate>} />
            <Route path="/profile" element={<AccountGate><Profile /></AccountGate>} />
            <Route path="/operations" element={<AccountGate><MarketOperations /></AccountGate>} />
            <Route path="/live-stkz" element={<AccountGate><LiveStkzPreview /></AccountGate>} />
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