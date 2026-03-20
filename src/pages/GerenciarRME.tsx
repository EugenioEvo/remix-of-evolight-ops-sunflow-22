import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, XCircle, Clock, Search, Eye, FileText, Star, Mail, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RMEDetailDialog } from '@/components/RMEDetailDialog';
import { ApprovalModal } from '@/components/ApprovalModal';
import { Pagination } from '@/components/Pagination';
import { useRMEListaPaginada, useRMEStats, useApproveRME, useRejectRME } from '@/hooks/queries';
import { useTicketsRealtime } from '@/hooks/useTicketsRealtime';

const GerenciarRME = () => {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('pendente');
  const [selectedRME, setSelectedRME] = useState<any>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvalType, setApprovalType] = useState<'approve' | 'reject'>('approve');
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);

  const { profile } = useAuth();
  const { toast } = useToast();

  // React Query hooks
  const { data, isLoading, refetch } = useRMEListaPaginada({ page, searchTerm, status: statusFilter });
  const { data: stats } = useRMEStats();
  const approveMutation = useApproveRME();
  const rejectMutation = useRejectRME();

  // Realtime updates
  useTicketsRealtime({ onTicketChange: () => refetch() });

  const handleViewDetails = (rme: any) => {
    setSelectedRME(rme);
    setDetailDialogOpen(true);
  };

  const handleApproveClick = (rme: any) => {
    setSelectedRME(rme);
    setApprovalType('approve');
    setApprovalModalOpen(true);
  };

  const handleRejectClick = (rme: any) => {
    setSelectedRME(rme);
    setApprovalType('reject');
    setApprovalModalOpen(true);
  };

  const handleApprovalConfirm = async (observacoes?: string) => {
    if (!selectedRME) return;

    if (approvalType === 'approve') {
      await approveMutation.mutateAsync({ rmeId: selectedRME.id, observacoes });
    } else {
      await rejectMutation.mutateAsync({ rmeId: selectedRME.id, motivo: observacoes || '' });
    }

    setApprovalModalOpen(false);
    setSelectedRME(null);
  };

  const handleSendEmail = async (rme: any) => {
    try {
      setSendingEmailId(rme.id);
      const { data, error } = await supabase.functions.invoke('send-rme-email', {
        body: { rme_id: rme.id },
      });
      if (error) throw error;
      toast({
        title: 'Email enviado!',
        description: `Resumo do RME enviado para o técnico ${rme.tecnicos?.profiles?.nome}.`,
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao enviar email',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSendingEmailId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; variant: any; icon: any }> = {
      pendente: { label: 'Pendente', variant: 'outline', icon: Clock },
      aprovado: { label: 'Aprovado', variant: 'default', icon: CheckCircle },
      rejeitado: { label: 'Rejeitado', variant: 'destructive', icon: XCircle },
    };
    const config = variants[status] || variants.pendente;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  if (profile?.role !== 'admin' && profile?.role !== 'area_tecnica') {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              Esta página é exclusiva para administradores e área técnica.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gerenciar RMEs</h1>
          <p className="text-muted-foreground">Aprovar ou rejeitar relatórios técnicos</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pendente || 0}</div>
            <p className="text-xs text-muted-foreground">Aguardando aprovação</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aprovados</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.aprovado || 0}</div>
            <p className="text-xs text-muted-foreground">RMEs aprovados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejeitados</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.rejeitado || 0}</div>
            <p className="text-xs text-muted-foreground">RMEs rejeitados</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por ticket, cliente ou técnico..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1); // Reset para página 1 ao buscar
                }}
                className="pl-10"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value);
                setPage(1); // Reset para página 1 ao mudar filtro
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="aprovado">Aprovado</SelectItem>
                <SelectItem value="rejeitado">Rejeitado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de RMEs */}
      {isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Carregando...</p>
          </CardContent>
        </Card>
      ) : !data || data.rmes.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Nenhum RME encontrado com os filtros selecionados.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {data.rmes.map((rme: any) => (
              <Card key={rme.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <CardTitle className="text-lg">
                          {rme.tickets?.numero_ticket} - {rme.tickets?.titulo}
                        </CardTitle>
                        {getStatusBadge(rme.status_aprovacao)}
                      </div>
                      <CardDescription>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <strong>Cliente:</strong> {rme.tickets?.clientes?.empresa}
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs flex items-center gap-1">
                              <Star className="h-3 w-3" />
                              P{(rme.tickets?.clientes as any)?.prioridade ?? 5}
                            </Badge>
                          </div>
                          <div>
                            <strong>Técnico:</strong> {rme.tecnicos?.profiles?.nome}
                          </div>
                          <div>
                            <strong>Data de Execução:</strong>{' '}
                            {format(new Date(rme.data_execucao), 'dd/MM/yyyy')}
                          </div>
                          <div>
                            <strong>Preenchido em:</strong>{' '}
                            {format(new Date(rme.created_at), 'dd/MM/yyyy HH:mm')}
                          </div>
                          {rme.data_aprovacao && (
                            <div>
                              <strong>
                                {rme.status_aprovacao === 'aprovado' ? 'Aprovado' : 'Rejeitado'} em:
                              </strong>{' '}
                              {format(new Date(rme.data_aprovacao), 'dd/MM/yyyy HH:mm')}
                              {rme.aprovador?.nome && (
                                <span> por <strong>{rme.aprovador.nome}</strong></span>
                              )}
                            </div>
                          )}
                          {rme.observacoes_aprovacao && (
                            <div>
                              <strong>Observações:</strong> {rme.observacoes_aprovacao}
                            </div>
                          )}
                        </div>
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewDetails(rme)}
                      className="gap-2"
                    >
                      <Eye className="h-4 w-4" />
                      Ver Detalhes
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSendEmail(rme)}
                      disabled={sendingEmailId === rme.id}
                      className="gap-2"
                    >
                      {sendingEmailId === rme.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Mail className="h-4 w-4" />
                      )}
                      Email
                    </Button>
                    {rme.pdf_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(rme.pdf_url, '_blank')}
                        className="gap-2"
                      >
                        <FileText className="h-4 w-4" />
                        PDF
                      </Button>
                    )}
                    {rme.status_aprovacao === 'pendente' && (
                      <>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleApproveClick(rme)}
                          className="gap-2"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Aprovar
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRejectClick(rme)}
                          className="gap-2"
                        >
                          <XCircle className="h-4 w-4" />
                          Rejeitar
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Paginação */}
          <Card>
            <CardContent className="pt-6">
              <Pagination
                currentPage={data.currentPage}
                totalPages={data.totalPages}
                totalItems={data.totalCount}
                itemsPerPage={15}
                onPageChange={setPage}
              />
            </CardContent>
          </Card>
        </>
      )}

      {/* Dialogs */}
      <RMEDetailDialog
        open={detailDialogOpen}
        onClose={() => {
          setDetailDialogOpen(false);
          setSelectedRME(null);
        }}
        rme={selectedRME}
      />

      <ApprovalModal
        open={approvalModalOpen}
        onClose={() => {
          setApprovalModalOpen(false);
          setSelectedRME(null);
        }}
        onConfirm={handleApprovalConfirm}
        type={approvalType}
        loading={approveMutation.isPending || rejectMutation.isPending}
      />
    </div>
  );
};

export default GerenciarRME;
