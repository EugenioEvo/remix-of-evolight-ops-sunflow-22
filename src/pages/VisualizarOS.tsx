import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { logger } from '@/services/api';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Download, ArrowLeft, FileText, Star } from "lucide-react";
import { toast } from "sonner";
import { generateOSPDF } from "@/utils/generateOSPDF";

const VisualizarOS = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [os, setOS] = useState<any>(null);
  const [ticket, setTicket] = useState<any>(null);

  useEffect(() => {
    loadOS();
  }, [id]);

  const loadOS = async () => {
    try {
      const { data: osData, error: osError } = await supabase
        .from('ordens_servico')
        .select(`
          *,
          tickets!inner(
            *,
            clientes!inner(
              empresa,
              endereco,
              cidade,
              estado,
              ufv_solarz,
              prioridade
            )
          )
        `)
        .eq('id', id)
        .single();

      if (osError) throw osError;

      setOS(osData);
      setTicket(osData.tickets);
    } catch (error: any) {
      console.error('Erro ao carregar OS:', error);
      toast.error('Erro ao carregar Ordem de Serviço');
      navigate('/tickets');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!os || !ticket) return;

    setGenerating(true);
    try {
      const pdfData = {
        numero_os: os.numero_os,
        data_programada: os.data_programada,
        equipe: os.equipe || ['Não informado'],
        cliente: ticket.clientes?.empresa || 'Não informado',
        endereco: `${ticket.clientes?.endereco || ''}, ${ticket.clientes?.cidade || ''} - ${ticket.clientes?.estado || ''}`,
        servico_solicitado: os.servico_solicitado || 'MANUTENÇÃO',
        hora_marcada: os.hora_inicio || '00:00',
        descricao: ticket.descricao || ticket.titulo || '',
        inspetor_responsavel: os.inspetor_responsavel || 'TODOS',
        tipo_trabalho: os.tipo_trabalho || [],
        ufv_solarz: ticket.clientes?.ufv_solarz || undefined,
      };

      const pdfBlob = await generateOSPDF(pdfData);

      // Download do PDF
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `OS_${os.numero_os}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('PDF gerado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar PDF');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!os || !ticket) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <p>Ordem de Serviço não encontrada</p>
            <Button className="mt-4" onClick={() => navigate('/tickets')}>
              Voltar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/tickets')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Ordem de Serviço - {os.numero_os}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Data Programada</p>
              <p className="font-medium">
                {new Date(os.data_programada).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Hora Marcada</p>
              <p className="font-medium">{os.hora_inicio || 'Não definida'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Cliente</p>
              <p className="font-medium">{ticket.clientes?.empresa || 'Não informado'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Prioridade</p>
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 text-blue-600" />
                <span className="font-medium">P{ticket.clientes?.prioridade ?? 5}</span>
              </div>
            </div>
            {ticket.clientes?.ufv_solarz && (
              <div>
                <p className="text-sm text-muted-foreground">UFV/SolarZ</p>
                <span className="inline-block px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded text-sm font-medium">
                  {ticket.clientes.ufv_solarz}
                </span>
              </div>
            )}
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Endereço</p>
            <p className="font-medium">
              {ticket.clientes?.endereco}, {ticket.clientes?.cidade} - {ticket.clientes?.estado}
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Equipe</p>
            <p className="font-medium">{os.equipe?.join(' / ') || 'Não informada'}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Serviço Solicitado</p>
            <p className="font-medium">{os.servico_solicitado || 'MANUTENÇÃO'}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Tipo de Trabalho</p>
            <div className="flex gap-2 mt-1">
              {os.tipo_trabalho && os.tipo_trabalho.length > 0 ? (
                os.tipo_trabalho.map((tipo: string) => (
                  <span key={tipo} className="px-2 py-1 bg-primary/10 text-primary rounded text-sm">
                    {tipo.toUpperCase()}
                  </span>
                ))
              ) : (
                <span className="text-muted-foreground">Não informado</span>
              )}
            </div>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Inspetor Responsável</p>
            <p className="font-medium">{os.inspetor_responsavel || 'TODOS'}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Descrição do Serviço</p>
            <p className="font-medium whitespace-pre-wrap">{ticket.descricao || ticket.titulo}</p>
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={handleDownloadPDF} disabled={generating} className="flex-1">
              {generating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Gerando PDF...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Baixar PDF
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VisualizarOS;
