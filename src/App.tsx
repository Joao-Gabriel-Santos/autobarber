// src/App.tsx - CORRIGIDO COM TODAS AS ROTAS

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

// Páginas existentes
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import Services from "./pages/dashboard/Services";
import Schedule from "./pages/dashboard/Schedule";
import Appointments from "./pages/dashboard/Appointments";
import BookAppointment from "./pages/BookAppointment";
import ClientAppointments from "./pages/ClientAppointments";
import NotFound from "./pages/NotFound";
import ConfirmEmail from "./pages/ConfirmEmail";
import UpdatePassword from "./pages/UpdatePassword";
import ForgotPassword from "./pages/ForgotPassword";
import Finance from "./pages/dashboard/Finance";
import PaymentSuccess from "./pages/PaymentSuccess";
import TeamManagement from "./pages/dashboard/TeamManagement";
import AcceptInvite from "./pages/dashboard/AcceptInvite";

// Páginas de Clientes
import ClientsManagement from "./pages/dashboard/Clients";
import ClientDashboard from "./pages/ClientDashboard";
import ClientAuth from "./pages/ClientAuth"; // ← Importação corrigida (sem @/)

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Rotas públicas */}
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/payment-success" element={<PaymentSuccess />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/confirm-email" element={<ConfirmEmail />} />
          <Route path="/update-password" element={<UpdatePassword />} />
          
          {/* 🔐 Rotas de Cliente - ORDEM IMPORTANTE */}
          <Route path="/client-auth/:barberSlug" element={<ClientAuth />} />
          {/* ⚠️ ADICIONAR ESTA ROTA ⚠️ */}
          <Route path="/book/:barberSlug" element={<BookAppointment />} />
          <Route path="/meus-agendamentos" element={<ClientAppointments />} />
          <Route path="/client-dashboard" element={<ClientDashboard />} />
          
          {/* Dashboard do Owner/Barbeiro */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/services" element={<Services />} />
          <Route path="/dashboard/schedule" element={<Schedule />} />
          <Route path="/dashboard/appointments" element={<Appointments />} />
          <Route path="/dashboard/finance" element={<Finance />} />
          <Route path="/dashboard/team" element={<TeamManagement />} />
          <Route path="/dashboard/clients" element={<ClientsManagement />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/accept-invite/:token" element={<AcceptInvite />} />
          
          {/* Catch-all 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;