import { useState, useEffect } from "react";
import { 
  Building2, 
  Users, 
  Zap, 
  Package, 
  Route, 
  BarChart3, 
  Settings,
  FileText,
  LogOut,
  User,
  ClipboardList,
  Calendar,
  CheckSquare,
  TrendingUp,
  Monitor,
  ShieldAlert,
  Sun,
  AlertTriangle,
  ChevronDown,
  Bot,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const sunflowItems = [
  { title: "Dashboard Solar", url: "/sunflow", icon: Sun },
  { title: "Usinas", url: "/sunflow/plants", icon: Zap },
  { title: "Alertas", url: "/sunflow/alerts", icon: AlertTriangle },
  { title: "Agentes JARVIS", url: "/sunflow/agents", icon: Bot },
  { title: "Tickets JARVIS", url: "/tickets", icon: Package },
];

const operacoesItems = [
  { title: "Ordens de Serviço", url: "/work-orders", icon: ClipboardList },
  { title: "RME", url: "/rme", icon: BarChart3 },
  { title: "Rotas", url: "/routes", icon: Route },
  { title: "Agenda", url: "/agenda", icon: Calendar, adminOnly: true },
  { title: "Carga de Trabalho", url: "/carga-trabalho", icon: TrendingUp, adminOnly: true },
  { title: "Confirmações", url: "/dashboard-presenca", icon: Monitor, adminOnly: true },
  { title: "Aprovar RMEs", url: "/gerenciar-rme", icon: CheckSquare, adminOnly: true },
];

const cadastroItems = [
  { title: "Clientes", url: "/clientes", icon: Building2 },
  { title: "Prestadores", url: "/prestadores", icon: Users },
  { title: "Equipamentos", url: "/equipamentos", icon: Zap },
  { title: "Insumos", url: "/insumos", icon: Package },
];

const systemItems = [
  { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
  { title: "Auditoria", url: "/audit-logs", icon: ShieldAlert, adminOnly: true },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

export function AppSidebar() {
  const { open, isMobile } = useSidebar();
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const currentPath = location.pathname;
  const collapsed = !open;
  const [pendingRMEsCount, setPendingRMEsCount] = useState(0);
  const [operacoesOpen, setOperacoesOpen] = useState(false);

  const isTecnico = profile?.role === "tecnico_campo";
  const isCliente = profile?.role === "cliente";
  const isAdminOrAreaTecnica = profile?.role === "admin" || profile?.role === "area_tecnica";

  useEffect(() => {
    if (isAdminOrAreaTecnica) {
      loadPendingRMEsCount();
      const channel = supabase
        .channel('rme-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'rme_relatorios', filter: 'status_aprovacao=eq.pendente' }, loadPendingRMEsCount)
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [isAdminOrAreaTecnica]);

  const loadPendingRMEsCount = async () => {
    try {
      const { count } = await supabase
        .from('rme_relatorios')
        .select('*', { count: 'exact', head: true })
        .eq('status_aprovacao', 'pendente');
      setPendingRMEsCount(count || 0);
    } catch {
      setPendingRMEsCount(0);
    }
  };

  const isActive = (path: string) => currentPath === path;
  const getNavClass = (path: string) =>
    isActive(path)
      ? "bg-primary/10 text-primary font-medium border-r-2 border-primary"
      : "hover:bg-muted/50 text-muted-foreground hover:text-foreground";

  const renderMenuItem = (item: { title: string; url: string; icon: any; adminOnly?: boolean; clientOnly?: boolean }) => (
    <SidebarMenuItem key={item.title}>
      <SidebarMenuButton asChild>
        <NavLink to={item.url} className={getNavClass(item.url)}>
          <item.icon className="h-4 w-4" />
          {!collapsed && <span>{item.title}</span>}
          {item.title === "Aprovar RMEs" && pendingRMEsCount > 0 && !collapsed && (
            <Badge variant="destructive" className="ml-auto">{pendingRMEsCount}</Badge>
          )}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar className={collapsed ? "w-14" : "w-64"} collapsible="icon">
      <SidebarContent className="bg-card border-r">
        {/* Logo */}
        <div className="p-4 border-b">
          <div className="flex items-center space-x-3">
            <div className="relative p-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600">
              <Zap className="h-6 w-6 text-white" />
              <div className="absolute inset-0 bg-amber-400/20 rounded-lg blur"></div>
            </div>
            {!collapsed && (
              <div>
                <h2 className="font-bold text-lg bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">SunFlow</h2>
                <p className="text-xs text-muted-foreground">Solar O&M</p>
              </div>
            )}
          </div>
        </div>

        {/* Monitoramento Solar - TOPO */}
        <SidebarGroup>
          <SidebarGroupLabel>Monitoramento Solar</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {sunflowItems.map(renderMenuItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Operações - Colapsável */}
        <Collapsible open={operacoesOpen} onOpenChange={setOperacoesOpen}>
          <SidebarGroup>
            <CollapsibleTrigger className="flex items-center justify-between w-full px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
              <span>Operações</span>
              {!collapsed && <ChevronDown className={`h-3.5 w-3.5 transition-transform ${operacoesOpen ? "rotate-180" : ""}`} />}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {operacoesItems
                    .filter(item => !item.adminOnly || isAdminOrAreaTecnica)
                    .map(renderMenuItem)}
                  {isTecnico && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink to="/minhas-os" className={getNavClass("/minhas-os")}>
                          <ClipboardList className="h-4 w-4" />
                          {!collapsed && <span>Minhas OS</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Cadastros */}
        {isAdminOrAreaTecnica && (
          <SidebarGroup>
            <SidebarGroupLabel>Cadastros</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{cadastroItems.map(renderMenuItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Sistema */}
        <SidebarGroup>
          <SidebarGroupLabel>Sistema</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {systemItems
                .filter(item => {
                  if (item.adminOnly && !isAdminOrAreaTecnica) return false;
                  if (item.title === "Relatórios" && !isAdminOrAreaTecnica) return false;
                  return true;
                })
                .map(renderMenuItem)}
              <SidebarMenuItem>
                <SidebarMenuButton onClick={signOut} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                  <LogOut className="h-4 w-4" />
                  {!collapsed && <span>Sair</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Footer */}
        {profile && !collapsed && (
          <div className="mt-auto p-4 border-t">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{profile.nome}</p>
                <p className="text-xs text-muted-foreground capitalize">{profile.role?.replace('_', ' ')}</p>
              </div>
            </div>
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
