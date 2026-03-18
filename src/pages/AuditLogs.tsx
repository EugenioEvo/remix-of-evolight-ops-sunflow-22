import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadingState } from '@/components/LoadingState';
import { VirtualizedList } from '@/components/VirtualizedList';
import { Search, ShieldAlert, Calendar, User, Database } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  old_data: any;
  new_data: any;
  user_id: string;
  performed_at: string;
  ip_address?: string;
  user_agent?: string;
}

const AuditLogs = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [tableFilter, setTableFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const { profile } = useAuth();

  const isAdmin = profile?.role === 'admin';

  useEffect(() => {
    if (isAdmin) {
      loadLogs();
    }
  }, [isAdmin, tableFilter, actionFilter]);

  const loadLogs = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('performed_at', { ascending: false })
        .limit(100);

      if (tableFilter !== 'all') {
        query = query.eq('table_name', tableFilter);
      }

      if (actionFilter !== 'all') {
        query = query.eq('action', actionFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      setLogs((data || []) as AuditLog[]);
    } catch (error: any) {
      console.error('Erro ao carregar logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionBadge = (action: string) => {
    const variants: Record<string, 'default' | 'destructive' | 'secondary'> = {
      INSERT: 'default',
      UPDATE: 'secondary',
      DELETE: 'destructive',
    };

    return (
      <Badge variant={variants[action] || 'default'}>
        {action}
      </Badge>
    );
  };

  const getTableDisplayName = (tableName: string) => {
    const names: Record<string, string> = {
      tickets: 'Tickets',
      ordens_servico: 'Ordens de Serviço',
      rme_relatorios: 'RMEs',
      user_roles: 'Permissões',
      clientes: 'Clientes',
    };
    return names[tableName] || tableName;
  };

  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      log.table_name.toLowerCase().includes(searchLower) ||
      log.record_id.toLowerCase().includes(searchLower) ||
      log.action.toLowerCase().includes(searchLower)
    );
  });

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-destructive">
              <ShieldAlert className="h-8 w-8" />
              <div>
                <h3 className="font-semibold text-lg">Acesso Negado</h3>
                <p className="text-sm text-muted-foreground">
                  Apenas administradores podem acessar os logs de auditoria.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <LoadingState />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <ShieldAlert className="h-8 w-8" />
          Logs de Auditoria
        </h1>
        <p className="text-muted-foreground">
          Registro completo de todas as alterações em tabelas críticas do sistema
        </p>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={tableFilter} onValueChange={setTableFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por tabela" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as tabelas</SelectItem>
                <SelectItem value="tickets">Tickets</SelectItem>
                <SelectItem value="ordens_servico">Ordens de Serviço</SelectItem>
                <SelectItem value="rme_relatorios">RMEs</SelectItem>
                <SelectItem value="user_roles">Permissões</SelectItem>
                <SelectItem value="clientes">Clientes</SelectItem>
              </SelectContent>
            </Select>

            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as ações</SelectItem>
                <SelectItem value="INSERT">Criação</SelectItem>
                <SelectItem value="UPDATE">Atualização</SelectItem>
                <SelectItem value="DELETE">Exclusão</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total de Logs</CardDescription>
            <CardTitle className="text-3xl">{filteredLogs.length}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Criações</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {filteredLogs.filter(l => l.action === 'INSERT').length}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Atualizações</CardDescription>
            <CardTitle className="text-3xl text-blue-600">
              {filteredLogs.filter(l => l.action === 'UPDATE').length}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Exclusões</CardDescription>
            <CardTitle className="text-3xl text-red-600">
              {filteredLogs.filter(l => l.action === 'DELETE').length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Lista de Logs - Virtualizada para performance */}
      <div className="space-y-3">
        {filteredLogs.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium">Nenhum log encontrado</h3>
              <p className="text-sm text-muted-foreground">
                Tente ajustar os filtros para ver mais resultados
              </p>
            </CardContent>
          </Card>
        ) : (
          <VirtualizedList
            data={filteredLogs}
            itemHeight={160}
            maxHeight={600}
            gap={12}
            renderItem={(log) => (
              <Card key={log.id} className="hover:shadow-md transition-shadow h-full">
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getActionBadge(log.action)}
                        <Badge variant="outline">
                          <Database className="h-3 w-3 mr-1" />
                          {getTableDisplayName(log.table_name)}
                        </Badge>
                        <Badge variant="outline" className="font-mono text-xs">
                          ID: {log.record_id.slice(0, 8)}...
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {format(new Date(log.performed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        {log.user_id && (
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span className="font-mono text-xs">
                              User: {log.user_id.slice(0, 8)}...
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Dados alterados (apenas para UPDATE) */}
                      {log.action === 'UPDATE' && log.old_data && log.new_data && (
                        <details className="mt-2">
                          <summary className="text-sm font-medium cursor-pointer hover:text-primary">
                            Ver alterações
                          </summary>
                          <div className="mt-2 p-3 bg-muted rounded-md space-y-2">
                            {Object.keys(log.new_data).map((key) => {
                              const oldValue = log.old_data?.[key];
                              const newValue = log.new_data?.[key];
                              
                              if (oldValue === newValue) return null;
                              
                              return (
                                <div key={key} className="text-xs">
                                  <span className="font-medium">{key}:</span>
                                  <div className="flex gap-2 items-center">
                                    <span className="text-red-600 line-through">
                                      {JSON.stringify(oldValue)}
                                    </span>
                                    <span>→</span>
                                    <span className="text-green-600">
                                      {JSON.stringify(newValue)}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          />
        )}
      </div>
    </div>
  );
};

export default AuditLogs;
