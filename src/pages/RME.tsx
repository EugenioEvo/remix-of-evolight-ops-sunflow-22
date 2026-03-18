import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTicketsRealtime } from '@/hooks/useTicketsRealtime';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { Upload, X, FileText, Download, Search, ArrowLeft, QrCode, Plus, Trash2, CheckCircle2, Circle, AlertCircle, Printer, Loader2, Mail } from 'lucide-react';
import { downloadRMEPDF, RMEPDFData } from '@/utils/generateRMEPDF';
import SignatureCanvas from 'react-signature-canvas';
import { Progress } from '@/components/ui/progress';
import { QRCodeScanner } from '@/components/QRCodeScanner';
import { EquipmentQuickAdd } from '@/components/EquipmentQuickAdd';
import { TechnicianBreadcrumb } from '@/components/TechnicianBreadcrumb';
import { LoadingState } from '@/components/LoadingState';
import { Alert, AlertDescription } from '@/components/ui/alert';

const rmeSchema = z.object({
  condicoes_encontradas: z.string().min(1, 'Campo obrigatório'),
  servicos_executados: z.string().min(1, 'Campo obrigatório'),
  testes_realizados: z.string().optional(),
  observacoes_tecnicas: z.string().optional(),
  data_execucao: z.string().min(1, 'Data de execução obrigatória'),
  nome_cliente_assinatura: z.string().min(1, 'Nome do cliente obrigatório'),
  tensao_entrada: z.string().optional(),
  tensao_saida: z.string().optional(),
  corrente: z.string().optional(),
  potencia: z.string().optional(),
  frequencia: z.string().optional(),
});

type RMEForm = z.infer<typeof rmeSchema>;

const RME = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const osIdFromUrl = searchParams.get('os');

  const [rmes, setRmes] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOS, setSelectedOS] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [fotosBefore, setFotosBefore] = useState<File[]>([]);
  const [fotosAfter, setFotosAfter] = useState<File[]>([]);
  const [tecnicoSignature, setTecnicoSignature] = useState<string>('');
  const [clienteSignature, setClienteSignature] = useState<string>('');
  const [showScanner, setShowScanner] = useState(false);
  const [scannedEquipment, setScannedEquipment] = useState<any>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [materiais, setMateriais] = useState<Array<{ insumo_id: string; nome: string; quantidade: number }>>([]);
  const [exportingRMEId, setExportingRMEId] = useState<string | null>(null);
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  const { user, profile, loading: authLoading } = useAuth();
  const { toast } = useToast();

  // Auto-reload quando houver mudanças em tickets/OS
  useTicketsRealtime({
    onTicketChange: () => {
      if (osIdFromUrl) {
        loadOSFromUrl(osIdFromUrl);
      }
    }
  });

  let sigCanvasTecnico: SignatureCanvas | null = null;
  let sigCanvasCliente: SignatureCanvas | null = null;

  const form = useForm<RMEForm>({
    resolver: zodResolver(rmeSchema),
    defaultValues: {
      condicoes_encontradas: '',
      servicos_executados: '',
      testes_realizados: '',
      observacoes_tecnicas: '',
      data_execucao: new Date().toISOString().split('T')[0],
      nome_cliente_assinatura: '',
      tensao_entrada: '',
      tensao_saida: '',
      corrente: '',
      potencia: '',
      frequencia: '',
    },
  });

  useEffect(() => {
    if (profile && (profile.role === 'tecnico_campo' || profile.role === 'admin' || profile.role === 'area_tecnica')) {
      loadData();
    }
  }, [profile]);

  useEffect(() => {
    if (osIdFromUrl && !selectedOS) {
      loadOSFromUrl(osIdFromUrl);
    }
  }, [osIdFromUrl]);

  const loadOSFromUrl = async (osId: string) => {
    try {
      const { data: osData, error } = await supabase
        .from('ordens_servico')
        .select(`
          *,
          tickets!inner(
            *,
            clientes(empresa)
          )
        `)
        .eq('id', osId)
        .maybeSingle();

      if (error) {
        logger.error('Erro ao carregar OS:', error);
        toast({
          title: 'Erro ao carregar OS',
          description: 'Não foi possível carregar a OS. Tente novamente.',
          variant: 'destructive',
        });
        setSelectedOS(null);
        return;
      }

      if (!osData) {
        toast({
          title: 'OS não encontrada',
          description: 'A ordem de serviço não foi encontrada no momento.',
          variant: 'destructive',
        });
        setSelectedOS(null);
        return;
      }

      setSelectedOS(osData);
    } catch (error: any) {
      logger.error('Erro inesperado ao carregar OS:', error);
      toast({
        title: 'Erro inesperado',
        description: 'Ocorreu um erro inesperado. Tente novamente.',
        variant: 'destructive',
      });
      setSelectedOS(null);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);

      // Carregar RMEs existentes
      const { data: rmeData } = await supabase
        .from('rme_relatorios')
        .select(`
          *,
          status_aprovacao,
          aprovado_por,
          data_aprovacao,
          observacoes_aprovacao,
          tickets!inner(
            titulo,
            numero_ticket,
            endereco_servico,
            clientes!inner(empresa, endereco, ufv_solarz)
          ),
          tecnicos!inner(
            profiles!inner(nome)
          )
        `)
        .order('created_at', { ascending: false });

      setRmes(rmeData || []);
    } catch (error) {
      logger.error('Erro ao carregar dados:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar dados',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const uploadPhotos = async (files: File[], folder: string): Promise<string[]> => {
    const urls: string[] = [];
    
    for (const file of files) {
      const fileName = `${user?.id}/${folder}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage
        .from('rme-fotos')
        .upload(fileName, file);

      if (error) throw error;

      const { data } = supabase.storage
        .from('rme-fotos')
        .getPublicUrl(fileName);
      
      urls.push(data.publicUrl);
    }
    
    return urls;
  };

  const onSubmit = async (data: RMEForm) => {
    try {
      setLoading(true);

      if (!selectedOS) {
        throw new Error('Selecione uma ordem de serviço');
      }

      // Validar status antes de permitir envio
      if (selectedOS.tickets?.status !== 'em_execucao') {
        toast({
          title: 'Status inválido',
          description: 'O ticket precisa estar com status "Em Execução" para criar o RME.',
          variant: 'destructive',
        });
        return;
      }

      if (!tecnicoSignature || !clienteSignature) {
        throw new Error('As assinaturas do técnico e do cliente são obrigatórias');
      }

      // Upload das fotos
      const fotosAntesUrls = fotosBefore.length > 0 ? await uploadPhotos(fotosBefore, 'antes') : [];
      const fotosDepoisUrls = fotosAfter.length > 0 ? await uploadPhotos(fotosAfter, 'depois') : [];

      // Buscar ID do técnico
      const { data: tecnicoData } = await supabase
        .from('tecnicos')
        .select('id')
        .eq('profile_id', profile?.id)
        .single();

      // Preparar medições elétricas
      const medicoesEletricas = {
        tensao_entrada: data.tensao_entrada,
        tensao_saida: data.tensao_saida,
        corrente: data.corrente,
        potencia: data.potencia,
        frequencia: data.frequencia,
      };

      // Preparar materiais utilizados
      const materiaisUtilizados = materiais.map(m => ({
        insumo_id: m.insumo_id,
        nome: m.nome,
        quantidade: m.quantidade,
      }));

      const rmeData = {
        condicoes_encontradas: data.condicoes_encontradas,
        servicos_executados: data.servicos_executados,
        testes_realizados: data.testes_realizados,
        observacoes_tecnicas: data.observacoes_tecnicas,
        nome_cliente_assinatura: data.nome_cliente_assinatura,
        ticket_id: selectedOS.ticket_id,
        ordem_servico_id: selectedOS.id,
        tecnico_id: tecnicoData?.id,
        equipamento_id: scannedEquipment?.id || null,
        fotos_antes: fotosAntesUrls,
        fotos_depois: fotosDepoisUrls,
        assinatura_tecnico: tecnicoSignature,
        assinatura_cliente: clienteSignature,
        data_execucao: new Date(data.data_execucao).toISOString(),
        medicoes_eletricas: medicoesEletricas,
        materiais_utilizados: materiaisUtilizados,
      };

      const { error } = await supabase
        .from('rme_relatorios')
        .insert([rmeData as any]);

      if (error) throw error;

      // Atualizar status do ticket
      await supabase
        .from('tickets')
        .update({ 
          status: 'concluido',
          data_conclusao: new Date().toISOString()
        })
        .eq('id', selectedOS.ticket_id);

      toast({
        title: 'Sucesso',
        description: 'RME criado com sucesso! Ticket marcado como concluído.',
      });

      // Resetar formulário
      setSelectedOS(null);
      setFotosBefore([]);
      setFotosAfter([]);
      setTecnicoSignature('');
      setClienteSignature('');
      setScannedEquipment(null);
      setMateriais([]);
      form.reset();
      
      // Voltar para Minhas OS
      navigate('/minhas-os');
    } catch (error: any) {
      logger.error('Erro ao salvar RME:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao salvar RME',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>, type: 'before' | 'after') => {
    const files = Array.from(event.target.files || []);
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    const MAX_FILES = 10;
    const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    
    const currentCount = type === 'before' ? fotosBefore.length : fotosAfter.length;
    
    // Validar quantidade
    if (currentCount + files.length > MAX_FILES) {
      toast({
        title: "Limite excedido",
        description: `Máximo de ${MAX_FILES} fotos por tipo.`,
        variant: "destructive",
      });
      return;
    }
    
    // Validar arquivos
    const invalidFiles = files.filter(f => 
      !ALLOWED_TYPES.includes(f.type) || f.size > MAX_FILE_SIZE
    );
    
    if (invalidFiles.length > 0) {
      toast({
        title: "Arquivos inválidos",
        description: "Use apenas JPG/PNG/WEBP até 5MB.",
        variant: "destructive",
      });
      return;
    }
    
    if (type === 'before') {
      setFotosBefore(prev => [...prev, ...files]);
    } else {
      setFotosAfter(prev => [...prev, ...files]);
    }
  };

  const removePhoto = (index: number, type: 'before' | 'after') => {
    if (type === 'before') {
      setFotosBefore(prev => prev.filter((_, i) => i !== index));
    } else {
      setFotosAfter(prev => prev.filter((_, i) => i !== index));
    }
  };

  const clearSignature = (type: 'tecnico' | 'cliente') => {
    if (type === 'tecnico' && sigCanvasTecnico) {
      sigCanvasTecnico.clear();
      setTecnicoSignature('');
    } else if (type === 'cliente' && sigCanvasCliente) {
      sigCanvasCliente.clear();
      setClienteSignature('');
    }
  };

  const saveSignature = (type: 'tecnico' | 'cliente') => {
    const canvas = type === 'tecnico' ? sigCanvasTecnico : sigCanvasCliente;
    
    if (!canvas || canvas.isEmpty()) {
      toast({
        title: "Assinatura vazia",
        description: "Por favor, assine antes de salvar.",
        variant: "destructive",
      });
      return;
    }
    
    if (type === 'tecnico') {
      setTecnicoSignature(canvas.toDataURL());
      toast({
        title: "Assinatura salva!",
        description: "Assinatura do técnico registrada.",
      });
    } else {
      setClienteSignature(canvas.toDataURL());
      toast({
        title: "Assinatura salva!",
        description: "Assinatura do cliente registrada.",
      });
    }
  };

  const handleQRCodeScan = async (decodedText: string) => {
    try {
      setLoading(true);
      setShowScanner(false);
      
      // Tentar parsear como JSON
      let qrData: any = {};
      try {
        qrData = JSON.parse(decodedText);
      } catch {
        // Se não for JSON, assumir que é um código de identificação (numero_serie ou id)
        qrData = { codigo: decodedText };
      }

      // Validar se temos cliente da OS
      if (!selectedOS?.tickets?.cliente_id) {
        toast({
          title: 'Erro',
          description: 'Não foi possível identificar o cliente. Selecione uma OS primeiro.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Buscar equipamento no banco usando múltiplos critérios
      let query = supabase.from('equipamentos').select('*');
      
      // Critérios de busca em ordem de prioridade
      const searchCriteria = [];
      if (qrData.id) searchCriteria.push(`id.eq.${qrData.id}`);
      if (qrData.numero_serie) searchCriteria.push(`numero_serie.eq.${qrData.numero_serie}`);
      if (qrData.codigo) {
        searchCriteria.push(`numero_serie.eq.${qrData.codigo}`);
        searchCriteria.push(`id.eq.${qrData.codigo}`);
      }

      if (searchCriteria.length > 0) {
        query = query.or(searchCriteria.join(','));
      }

      const { data: equipment, error } = await query.maybeSingle();

      if (error) {
        logger.error('Erro ao buscar equipamento:', error);
        throw error;
      }

      if (equipment) {
        // Equipamento encontrado - vincular ao RME
        setScannedEquipment(equipment);
        toast({
          title: 'Equipamento encontrado!',
          description: `${equipment.nome} - ${equipment.modelo || 'Sem modelo'}`,
        });
      } else {
        // Equipamento não encontrado - preparar para cadastro
        toast({
          title: 'Equipamento não cadastrado',
          description: 'Preencha os dados para cadastrar este equipamento.',
        });
        
        // Preparar dados iniciais baseados no QR code
        const initialData: any = {};
        
        if (qrData.nome) initialData.nome = qrData.nome;
        if (qrData.tipo) initialData.tipo = qrData.tipo;
        if (qrData.modelo) initialData.modelo = qrData.modelo;
        if (qrData.numero_serie || qrData.codigo) {
          initialData.numero_serie = qrData.numero_serie || qrData.codigo;
        }
        if (qrData.fabricante) initialData.fabricante = qrData.fabricante;
        if (qrData.observacoes) initialData.observacoes = qrData.observacoes;

        // Se não tiver nome, criar um baseado no tipo ou usar genérico
        if (!initialData.nome) {
          if (qrData.tipo) {
            const tipoMap: Record<string, string> = {
              painel_solar: 'Painel Solar',
              inversor: 'Inversor',
              bateria: 'Bateria',
              controlador_carga: 'Controlador de Carga',
              estrutura: 'Estrutura',
              cabeamento: 'Cabeamento',
              monitoramento: 'Sistema de Monitoramento',
              outros: 'Equipamento',
            };
            initialData.nome = tipoMap[qrData.tipo] || 'Novo Equipamento';
          } else {
            initialData.nome = `Equipamento ${qrData.codigo || 'Novo'}`;
          }
        }

        // Armazenar dados temporários e abrir modal
        setScannedEquipment(initialData);
        setShowQuickAdd(true);
      }
    } catch (error: any) {
      logger.error('Erro ao processar QR Code:', error);
      toast({
        title: 'Erro ao processar QR Code',
        description: error.message || 'Não foi possível processar o código escaneado.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const addMaterial = () => {
    setMateriais([...materiais, { insumo_id: '', nome: '', quantidade: 1 }]);
  };

  const removeMaterial = (index: number) => {
    setMateriais(materiais.filter((_, i) => i !== index));
  };

  const updateMaterial = (index: number, field: string, value: any) => {
    const updated = [...materiais];
    updated[index] = { ...updated[index], [field]: value };
    setMateriais(updated);
  };

  const filteredRMEs = rmes.filter(rme => 
    rme.tickets?.titulo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rme.tickets?.numero_ticket?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rme.tickets?.clientes?.empresa?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExportRMEPDF = async (rme: any) => {
    try {
      setExportingRMEId(rme.id);

      // Fetch checklist items for this RME
      const { data: checklistItems } = await supabase
        .from('rme_checklist_items')
        .select('*')
        .eq('rme_id', rme.id)
        .order('category, item_key');

      // Fetch OS number
      const { data: osData } = await supabase
        .from('ordens_servico')
        .select('numero_os')
        .eq('id', rme.ordem_servico_id)
        .single();

      // Group checklists by category
      const checklistMap: Record<string, { label: string; checked: boolean }[]> = {};
      (checklistItems || []).forEach((item: any) => {
        if (!checklistMap[item.category]) checklistMap[item.category] = [];
        checklistMap[item.category].push({ label: item.label, checked: !!item.checked });
      });

      const checklists = Object.entries(checklistMap).map(([category, items]) => ({
        category,
        items,
      }));

      const pdfData: RMEPDFData = {
        numero_os: osData?.numero_os || '-',
        cliente: rme.tickets?.clientes?.empresa || '-',
        endereco: rme.tickets?.endereco_servico || rme.tickets?.clientes?.endereco || '-',
        site_name: rme.site_name || '-',
        data_execucao: new Date(rme.data_execucao).toLocaleDateString('pt-BR'),
        weekday: rme.weekday || '-',
        shift: rme.shift || '-',
        start_time: rme.start_time || '-',
        end_time: rme.end_time || '-',
        service_type: Array.isArray(rme.service_type) ? rme.service_type : [],
        collaboration: Array.isArray(rme.collaboration) ? rme.collaboration : [],
        checklists,
        images_posted: !!rme.images_posted,
        modules_cleaned_qty: rme.modules_cleaned_qty || 0,
        string_box_qty: rme.string_box_qty || 0,
        fotos_antes_count: rme.fotos_antes?.length || 0,
        fotos_depois_count: rme.fotos_depois?.length || 0,
        materiais_utilizados: Array.isArray(rme.materiais_utilizados) 
          ? rme.materiais_utilizados.map((m: any) => ({
              descricao: m.nome || m.descricao || '-',
              quantidade: m.quantidade || 0,
              tinha_estoque: !!m.tinha_estoque,
            }))
          : [],
        servicos_executados: rme.servicos_executados || '-',
        condicoes_encontradas: rme.condicoes_encontradas || '-',
        signatures: rme.signatures || {},
        tecnico_nome: rme.tecnicos?.profiles?.nome || '-',
        status_aprovacao: rme.status_aprovacao || 'pendente',
        ufv_solarz: rme.tickets?.clientes?.ufv_solarz || undefined,
      };

      await downloadRMEPDF(pdfData, `RME_${osData?.numero_os || rme.id}_${new Date(rme.data_execucao).toISOString().split('T')[0]}.pdf`);

      toast({
        title: 'PDF Exportado',
        description: 'O relatório foi exportado com sucesso!',
      });
    } catch (error: any) {
      logger.error('Erro ao exportar PDF:', error);
      toast({
        title: 'Erro ao exportar',
        description: error.message || 'Não foi possível gerar o PDF.',
        variant: 'destructive',
      });
    } finally {
      setExportingRMEId(null);
    }
  };

  const handleSendRMEEmail = async (rme: any) => {
    try {
      setSendingEmailId(rme.id);
      const { data, error } = await supabase.functions.invoke('send-rme-email', {
        body: { rme_id: rme.id },
      });
      if (error) throw error;
      toast({
        title: 'Email enviado!',
        description: `Resumo do RME enviado para o técnico.`,
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

  // Validar se pode enviar (apenas campos obrigatórios)
  const canSubmit = () => {
    const values = form.watch();
    return !!(
      values.condicoes_encontradas &&
      values.servicos_executados &&
      values.data_execucao &&
      values.nome_cliente_assinatura &&
      tecnicoSignature &&
      clienteSignature
    );
  };

  // Calcular progresso do formulário (inclui opcionais)
  const calculateProgress = () => {
    const values = form.watch();
    const requiredFilled = [
      values.condicoes_encontradas,
      values.servicos_executados,
      values.data_execucao,
      values.nome_cliente_assinatura,
      tecnicoSignature,
      clienteSignature,
    ].filter(Boolean).length;
    
    const optionalFilled = [
      fotosBefore.length > 0 || fotosAfter.length > 0,
      scannedEquipment !== null,
      values.tensao_entrada || values.tensao_saida || values.corrente,
      materiais.length > 0,
    ].filter(Boolean).length;

    // 6 campos obrigatórios = 60%, 4 opcionais = 40%
    return (requiredFilled / 6) * 60 + (optionalFilled / 4) * 40;
  };

  const canAccessRME = profile?.role === 'tecnico_campo' || 
                       profile?.role === 'admin' || 
                       profile?.role === 'area_tecnica';
  
  const osLoading = !!osIdFromUrl && !selectedOS;

  if (authLoading || osLoading) {
    return (
      <div className="p-6">
        <LoadingState />
      </div>
    );
  }
  
  if (!canAccessRME && !selectedOS) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              Acesso negado. Esta página é para técnicos de campo, administradores e área técnica.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Se há OS selecionada, mostrar formulário
  if (selectedOS) {
    const progress = calculateProgress();

    return (
      <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
        <TechnicianBreadcrumb current="rme" osNumber={selectedOS.numero_os} />
        
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedOS(null);
              navigate('/rme');
            }}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Voltar</span>
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold truncate">Preencher RME</h1>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">
              OS: {selectedOS.numero_os} - {selectedOS.tickets?.titulo}
            </p>
          </div>
        </div>

        {selectedOS?.tickets?.status !== 'em_execucao' && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between gap-4">
              <div>
                <strong>Atenção:</strong> O status do ticket não está como "Em Execução". 
                O RME só pode ser preenchido após iniciar a execução do serviço.
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadOSFromUrl(selectedOS.id)}
              >
                Atualizar
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {progress < 100 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Preencha todos os campos obrigatórios e adicione as assinaturas para completar o RME.
            </AlertDescription>
          </Alert>
        )}

        {/* Grid com Progresso e Checklist */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulário (2 colunas no desktop) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Barra de Progresso */}
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progresso do formulário</span>
                    <span className="font-medium">{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              </CardContent>
            </Card>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Informações Básicas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="data_execucao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de Execução *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="nome_cliente_assinatura"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome do Cliente *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Nome completo do cliente" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Seção de Equipamento com QR Code */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Equipamento</span>
                </CardTitle>
                <CardDescription>
                  Equipamento vinculado a este RME (opcional)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {scannedEquipment ? (
                  <div className="p-4 bg-muted rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{scannedEquipment.nome}</p>
                        <p className="text-sm text-muted-foreground">
                          {scannedEquipment.tipo} - {scannedEquipment.modelo || 'N/A'}
                        </p>
                        {scannedEquipment.numero_serie && (
                          <p className="text-xs text-muted-foreground">
                            S/N: {scannedEquipment.numero_serie}
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setScannedEquipment(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum equipamento vinculado (funcionalidade de QR code temporariamente desabilitada)
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Medições Elétricas */}
            <Card>
              <CardHeader>
                <CardTitle>Medições Elétricas</CardTitle>
                <CardDescription>Registre as medições realizadas durante o serviço</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="tensao_entrada"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tensão Entrada (V)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" placeholder="Ex: 220" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="tensao_saida"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tensão Saída (V)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" placeholder="Ex: 220" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="corrente"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Corrente (A)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" placeholder="Ex: 10.5" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="potencia"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Potência (W)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" placeholder="Ex: 2000" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="frequencia"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Frequência (Hz)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" step="0.01" placeholder="Ex: 60" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Materiais Utilizados */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Materiais Utilizados</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addMaterial}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Material
                  </Button>
                </CardTitle>
                <CardDescription>
                  Liste os insumos e materiais utilizados no serviço
                </CardDescription>
              </CardHeader>
              <CardContent>
                {materiais.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum material adicionado
                  </p>
                ) : (
                  <div className="space-y-3">
                    {materiais.map((material, index) => (
                      <div key={index} className="flex gap-2 items-end">
                        <div className="flex-1">
                          <label className="text-sm font-medium">Material/Insumo</label>
                          <Input
                            placeholder="Nome do material"
                            value={material.nome}
                            onChange={(e) => updateMaterial(index, 'nome', e.target.value)}
                          />
                        </div>
                        <div className="w-32">
                          <label className="text-sm font-medium">Quantidade</label>
                          <Input
                            type="number"
                            min="1"
                            value={material.quantidade}
                            onChange={(e) => updateMaterial(index, 'quantidade', parseInt(e.target.value) || 1)}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          onClick={() => removeMaterial(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Condições e Serviços</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="condicoes_encontradas"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Condições Encontradas *</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Descreva as condições encontradas no local..." rows={4} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="servicos_executados"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Serviços Executados *</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Descreva os serviços realizados..." rows={4} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="testes_realizados"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Testes Realizados</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Descreva os testes realizados..." rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="observacoes_tecnicas"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações Técnicas</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Observações adicionais..." rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Fotos */}
            <Card>
              <CardHeader>
                <CardTitle>Fotos</CardTitle>
                <CardDescription>Adicione fotos do antes e depois do serviço</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-sm font-medium">Fotos Antes</label>
                    <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center hover:border-primary transition-colors">
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => handlePhotoUpload(e, 'before')}
                        className="hidden"
                        id="photos-before"
                      />
                      <label htmlFor="photos-before" className="cursor-pointer">
                        <Upload className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Clique ou arraste fotos aqui</p>
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {fotosBefore.map((file, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={`Antes ${index + 1}`}
                            className="w-full h-24 object-cover rounded-lg"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => removePhoto(index, 'before')}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-medium">Fotos Depois</label>
                    <div className="border-2 border-dashed border-muted rounded-lg p-6 text-center hover:border-primary transition-colors">
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => handlePhotoUpload(e, 'after')}
                        className="hidden"
                        id="photos-after"
                      />
                      <label htmlFor="photos-after" className="cursor-pointer">
                        <Upload className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Clique ou arraste fotos aqui</p>
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {fotosAfter.map((file, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={URL.createObjectURL(file)}
                            alt={`Depois ${index + 1}`}
                            className="w-full h-24 object-cover rounded-lg"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => removePhoto(index, 'after')}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Assinaturas */}
            <Card>
              <CardHeader>
                <CardTitle>Assinaturas *</CardTitle>
                <CardDescription>Assinaturas digitais do técnico e do cliente</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-sm font-medium">Assinatura do Técnico</label>
                    <div className="border-2 rounded-lg overflow-hidden bg-white">
                      <SignatureCanvas
                        ref={(ref) => { sigCanvasTecnico = ref; }}
                        canvasProps={{
                          width: 400,
                          height: 200,
                          className: 'signature-canvas w-full'
                        }}
                        onEnd={() => saveSignature('tecnico')}
                      />
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => clearSignature('tecnico')} className="w-full">
                      Limpar Assinatura
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-medium">Assinatura do Cliente</label>
                    <div className="border-2 rounded-lg overflow-hidden bg-white">
                      <SignatureCanvas
                        ref={(ref) => { sigCanvasCliente = ref; }}
                        canvasProps={{
                          width: 400,
                          height: 200,
                          className: 'signature-canvas w-full'
                        }}
                        onEnd={() => saveSignature('cliente')}
                      />
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => clearSignature('cliente')} className="w-full">
                      Limpar Assinatura
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-2">
              <Button 
                type="submit" 
                disabled={loading || !canSubmit() || selectedOS?.tickets?.status !== 'em_execucao'} 
                className="w-full sm:w-auto"
              >
                {loading ? 'Salvando...' : 'Concluir e Enviar RME'}
              </Button>
              {selectedOS?.tickets?.status !== 'em_execucao' && (
                <p className="text-xs text-destructive">
                  ⚠️ O ticket precisa estar "Em Execução" para enviar o RME
                </p>
              )}
              {canSubmit() && progress < 100 && selectedOS?.tickets?.status === 'em_execucao' && (
                <p className="text-xs text-muted-foreground">
                  Campos obrigatórios preenchidos. Preencha os opcionais para melhorar a documentação.
                </p>
              )}
            </div>
          </form>
        </Form>
        </div>

        {/* Checklist Lateral (1 coluna no desktop) */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Checklist do RME
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-xs">
                <div className="flex items-start gap-2">
                  {form.watch('data_execucao') ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  )}
                  <span className={form.watch('data_execucao') ? 'text-foreground' : 'text-muted-foreground'}>
                    Data de execução
                  </span>
                </div>

                <div className="flex items-start gap-2">
                  {form.watch('nome_cliente_assinatura') ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  )}
                  <span className={form.watch('nome_cliente_assinatura') ? 'text-foreground' : 'text-muted-foreground'}>
                    Nome do cliente
                  </span>
                </div>

                <div className="flex items-start gap-2">
                  {form.watch('condicoes_encontradas') ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  )}
                  <span className={form.watch('condicoes_encontradas') ? 'text-foreground' : 'text-muted-foreground'}>
                    Condições encontradas
                  </span>
                </div>

                <div className="flex items-start gap-2">
                  {form.watch('servicos_executados') ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  )}
                  <span className={form.watch('servicos_executados') ? 'text-foreground' : 'text-muted-foreground'}>
                    Serviços executados
                  </span>
                </div>

                <div className="flex items-start gap-2">
                  {tecnicoSignature ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  )}
                  <span className={tecnicoSignature ? 'text-foreground' : 'text-muted-foreground'}>
                    Assinatura do técnico
                  </span>
                </div>

                <div className="flex items-start gap-2">
                  {clienteSignature ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  )}
                  <span className={clienteSignature ? 'text-foreground' : 'text-muted-foreground'}>
                    Assinatura do cliente
                  </span>
                </div>

                <div className="pt-3 border-t">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Campos Opcionais</p>
                  
                  <div className="flex items-start gap-2">
                    {fotosBefore.length > 0 ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                    )}
                    <span className={fotosBefore.length > 0 ? 'text-foreground' : 'text-muted-foreground'}>
                      Fotos antes ({fotosBefore.length})
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  {fotosAfter.length > 0 ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  )}
                  <span className={fotosAfter.length > 0 ? 'text-foreground' : 'text-muted-foreground'}>
                    Fotos depois ({fotosAfter.length})
                  </span>
                </div>

                <div className="flex items-start gap-2">
                  {scannedEquipment ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  )}
                  <span className={scannedEquipment ? 'text-foreground' : 'text-muted-foreground'}>
                    Equipamento
                  </span>
                </div>

                <div className="flex items-start gap-2">
                  {(materiais.length > 0) ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  )}
                  <span className={materiais.length > 0 ? 'text-foreground' : 'text-muted-foreground'}>
                    Materiais utilizados
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

        {/* QR Code Scanner temporariamente desabilitado */}
      </div>
    );
  }

  // Lista de RMEs
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">RME - Relatórios de Manutenção</h1>
          <p className="text-muted-foreground">Histórico de relatórios enviados</p>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar RMEs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <div className="grid gap-4">
        {filteredRMEs.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium">Nenhum RME encontrado</h3>
                <p className="text-muted-foreground">
                  {searchTerm ? 'Tente ajustar os filtros de busca' : 'Seus RMEs aparecerão aqui'}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredRMEs.map((rme) => (
            <Card key={rme.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">
                      {rme.tickets?.titulo}
                    </CardTitle>
                    <CardDescription>
                      Ticket: {rme.tickets?.numero_ticket}
                    </CardDescription>
                  </div>
                  <Badge variant="outline">
                    {new Date(rme.data_execucao).toLocaleDateString('pt-BR')}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p><strong>Técnico:</strong> {rme.tecnicos?.profiles?.nome}</p>
                  <p><strong>Condições Encontradas:</strong> {rme.condicoes_encontradas}</p>
                  <p><strong>Serviços Executados:</strong> {rme.servicos_executados}</p>
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExportRMEPDF(rme)}
                      disabled={exportingRMEId === rme.id}
                      className="gap-2"
                    >
                      {exportingRMEId === rme.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Printer className="h-4 w-4" />
                      )}
                      Exportar para Impressão
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSendRMEEmail(rme)}
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
                      <Button variant="outline" size="sm" asChild>
                        <a href={rme.pdf_url} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4 mr-2" />
                          Download PDF
                        </a>
                      </Button>
                    )}
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-xs text-muted-foreground">
                      Criado em {new Date(rme.created_at).toLocaleString('pt-BR')}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default RME;
