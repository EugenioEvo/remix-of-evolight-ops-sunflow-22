import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { TopHeader } from "@/components/TopHeader";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import RoutesPage from "./pages/Routes";
import Agenda from "./pages/Agenda";
import CargaTrabalho from "./pages/CargaTrabalho";
import Clientes from "./pages/Clientes";
import Tickets from "./pages/Tickets";
import Equipamentos from "./pages/Equipamentos";
import Insumos from "./pages/Insumos";
import Prestadores from "./pages/Prestadores";
import Tecnicos from "./pages/Tecnicos";
import MinhasOS from "./pages/MinhasOS";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import RME from "./pages/RME";
import Relatorios from "./pages/Relatorios";
import GerenciarRME from "./pages/GerenciarRME";
import DashboardPresenca from "./pages/DashboardPresenca";
import AuditLogs from "./pages/AuditLogs";
import ClientDashboard from "./pages/ClientDashboard";
import PresenceConfirmation from "./pages/PresenceConfirmation";
import VisualizarOS from "./pages/VisualizarOS";
import WorkOrders from "./pages/WorkOrders";
import WorkOrderCreate from "./pages/WorkOrderCreate";
import WorkOrderDetail from "./pages/WorkOrderDetail";
import RMEWizard from "./pages/RMEWizard";
import SunflowDashboard from "./pages/SunflowDashboard";
import Plants from "./pages/Plants";
import PlantNew from "./pages/PlantNew";
import PlantDetail from "./pages/PlantDetail";
import SunflowWorkOrders from "./pages/SunflowWorkOrders";
import SunflowAlerts from "./pages/SunflowAlerts";
import JarvisAgents from "./pages/JarvisAgents";
import Configuracoes from "./pages/Configuracoes";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/confirmar-presenca" element={<PresenceConfirmation />} />
              <Route path="/*" element={
                <ProtectedRoute>
                  <SidebarProvider>
                    <div className="min-h-screen flex w-full bg-background">
                      <AppSidebar />
                      <div className="flex-1 flex flex-col">
                        <TopHeader />
                        <main className="flex-1 overflow-auto bg-muted/30">
                          <Routes>
                            <Route path="/" element={<Index />} />
                            <Route path="/meu-painel" element={
                              <ProtectedRoute roles={['cliente']}>
                                <ClientDashboard />
                              </ProtectedRoute>
                            } />
                            <Route path="/tickets" element={<Tickets />} />
                            <Route path="/routes" element={<RoutesPage />} />
                            <Route path="/agenda" element={
                              <ProtectedRoute roles={['admin', 'area_tecnica']}>
                                <Agenda />
                              </ProtectedRoute>
                            } />
                            <Route path="/carga-trabalho" element={
                              <ProtectedRoute roles={['admin', 'area_tecnica']}>
                                <CargaTrabalho />
                              </ProtectedRoute>
                            } />
                            <Route path="/dashboard-presenca" element={
                              <ProtectedRoute roles={['admin', 'area_tecnica']}>
                                <DashboardPresenca />
                              </ProtectedRoute>
                            } />
                            <Route path="/clientes" element={
                              <ProtectedRoute roles={['admin', 'area_tecnica']}>
                                <Clientes />
                              </ProtectedRoute>
                            } />
                            <Route path="/prestadores" element={
                              <ProtectedRoute roles={['admin', 'area_tecnica']}>
                                <Prestadores />
                              </ProtectedRoute>
                            } />
                            <Route path="/tecnicos" element={
                              <ProtectedRoute roles={['admin', 'area_tecnica']}>
                                <Tecnicos />
                              </ProtectedRoute>
                            } />
                            <Route path="/minhas-os" element={<MinhasOS />} />
                            <Route path="/equipamentos" element={
                              <ProtectedRoute roles={['admin', 'area_tecnica']}>
                                <Equipamentos />
                              </ProtectedRoute>
                            } />
                            <Route path="/insumos" element={
                              <ProtectedRoute roles={['admin', 'area_tecnica']}>
                                <Insumos />
                              </ProtectedRoute>
                            } />
                            <Route path="/rme" element={<RME />} />
                            <Route path="/gerenciar-rme" element={
                              <ProtectedRoute roles={['admin', 'area_tecnica']}>
                                <GerenciarRME />
                              </ProtectedRoute>
                            } />
                            <Route path="/relatorios" element={
                              <ProtectedRoute roles={['admin', 'area_tecnica']}>
                                <Relatorios />
                              </ProtectedRoute>
                            } />
                            <Route path="/audit-logs" element={
                              <ProtectedRoute roles={['admin']}>
                                <AuditLogs />
                              </ProtectedRoute>
                            } />
                            <Route path="/visualizar-os/:id" element={<VisualizarOS />} />
                            <Route path="/work-orders" element={<WorkOrders />} />
                            <Route path="/work-orders/new" element={
                              <ProtectedRoute roles={['admin', 'area_tecnica']}>
                                <WorkOrderCreate />
                              </ProtectedRoute>
                            } />
                            <Route path="/work-orders/:id" element={<WorkOrderDetail />} />
                            <Route path="/rme-wizard/:id" element={<RMEWizard />} />
                            {/* Sunflow O&M Pro */}
                            <Route path="/sunflow" element={<SunflowDashboard />} />
                            <Route path="/sunflow/plants" element={<Plants />} />
                            <Route path="/sunflow/plants/new" element={
                              <ProtectedRoute roles={['admin', 'area_tecnica']}>
                                <PlantNew />
                              </ProtectedRoute>
                            } />
                            <Route path="/sunflow/plants/:id" element={<PlantDetail />} />
                            <Route path="/sunflow/work-orders" element={<SunflowWorkOrders />} />
                            <Route path="/sunflow/alerts" element={
                              <ProtectedRoute roles={['admin', 'area_tecnica', 'tecnico_campo']}>
                                <SunflowAlerts />
                              </ProtectedRoute>
                            } />
                            {/* Configurações */}
                            <Route path="/configuracoes" element={<Configuracoes />} />
                            <Route path="*" element={<NotFound />} />
                          </Routes>
                        </main>
                      </div>
                    </div>
                  </SidebarProvider>
                </ProtectedRoute>
              } />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;