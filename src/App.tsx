import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { CartProvider } from "@/contexts/CartContext";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index/index";
import Shop from "./pages/Shop";
import Server from "./pages/Server";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Auth from "./pages/Auth";
import ProfilePage from "./pages/ProfilePage";
import CheckoutPage from "./pages/CheckoutPage";
import StaffApplicationPage from "./pages/StaffApplication";
import AdminLayout from "./layouts/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import ShopManagement from "./pages/admin/ShopManagement";
import GamemodeManagement from "./pages/admin/GamemodeManagement";
import CategoryManagement from "./pages/admin/CategoryManagement";
import OrderManagement from "./pages/admin/OrderManagement";
import UserManagement from "./pages/admin/UserManagement";
import TicketManagement from "./pages/admin/TicketManagement";
import StaffApplications from "./pages/admin/StaffApplications";
import StaffApplicationDetail from "./pages/admin/StaffApplicationDetail";
import BannerManagement from "./pages/admin/BannerManagement";
import ActivityLogs from "./pages/admin/ActivityLogs";
import Settings from "./pages/admin/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <AuthProvider>
        <LanguageProvider>
          <CartProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter
                future={{
                  v7_relativeSplatPath: true,
                  v7_startTransition: true,
                }}
              >
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/server" element={<Server />} />
                  <Route path="/shop" element={<Shop />} />
                  <Route path="/privacy" element={<Privacy />} />
                  <Route path="/terms" element={<Terms />} />
                  <Route path="/checkout" element={<CheckoutPage />} />
                  <Route path="/staffapplication" element={<StaffApplicationPage />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  
                  {/* Admin Routes */}
                  <Route path="/admin" element={<AdminLayout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="shop" element={<ShopManagement />} />
                    <Route path="gamemodes" element={<GamemodeManagement />} />
                    <Route path="categories" element={<CategoryManagement />} />
                    <Route path="orders" element={<OrderManagement />} />
                    <Route path="users" element={<UserManagement />} />
                    <Route path="staff-applications" element={<StaffApplications />} />
                    <Route path="staff-applications/:id" element={<StaffApplicationDetail />} />
                    <Route path="tickets" element={<TicketManagement />} />
                    <Route path="banners" element={<BannerManagement />} />
                    <Route path="activity" element={<ActivityLogs />} />
                    <Route path="settings" element={<Settings />} />
                  </Route>
                  
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </CartProvider>
        </LanguageProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
