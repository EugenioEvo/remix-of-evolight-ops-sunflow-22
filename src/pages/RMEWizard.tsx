import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { fetchData } from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useCreateRME, useUpdateRME, usePopulateChecklist, useUpdateChecklistItem } from "@/hooks/queries";
import { ArrowLeft, Save, Check, Loader2, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { downloadRMEPDF, type RMEPDFData } from "@/utils/generateRMEPDF";

// Step components
import { StepIdentification } from "@/components/rme-wizard/StepIdentification";
import { StepServiceShift } from "@/components/rme-wizard/StepServiceShift";
import { StepChecklists } from "@/components/rme-wizard/StepChecklists";
import { StepEvidence } from "@/components/rme-wizard/StepEvidence";
import { StepToolsEPIs } from "@/components/rme-wizard/StepToolsEPIs";
import { StepSignatures } from "@/components/rme-wizard/StepSignatures";

export interface RMEFormData {
  id?: string;
  ordem_servico_id: string;
  ticket_id: string;
  tecnico_id: string;
  data_execucao: string;
  weekday: string;
  site_name: string;
  collaboration: string[];
  micro_number: string;
  inverter_number: string;
  service_type: string[];
  shift: string;
  start_time: string;
  end_time: string;
  images_posted: boolean;
  modules_cleaned_qty: number;
  string_box_qty: number;
  condicoes_encontradas: string;
  servicos_executados: string;
  materiais_utilizados: Array<{ descricao: string; quantidade: number; tinha_estoque: boolean }>;
  signatures: {
    responsavel?: { nome: string; at: string };
    gerente_manutencao?: { nome: string; at: string };
    gerente_projeto?: { nome: string; at: string };
  };
  status: string;
  // Read-only from OS
  client_name: string;
  address: string;
  ufv_solarz?: string;
}

interface WorkOrderInfo {
  id: string;
  numero_os: string;
  site_name: string | null;
  ticket_id: string;
  tickets: {
    id: string;
    endereco_servico: string;
    clientes: { empresa: string; ufv_solarz: string | null };
  };
}

const STEPS = [
  { id: 1, title: "Identificação", shortTitle: "ID" },
  { id: 2, title: "Serviço e Turno", shortTitle: "Turno" },
  { id: 3, title: "Checklists", shortTitle: "Check" },
  { id: 4, title: "Evidências", shortTitle: "Fotos" },
  { id: 5, title: "Ferramentas e EPIs", shortTitle: "EPIs" },
  { id: 6, title: "Notas e Assinaturas", shortTitle: "Final" },
];

const getWeekday = (date: Date): string => {
  const days = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  return days[date.getDay()];
};

const RMEWizard = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const osId = searchParams.get("os");
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { toast } = useToast();
  const createRME = useCreateRME();
  const updateRME = useUpdateRME();
  const populateChecklist = usePopulateChecklist();
  const updateChecklistItemMutation = useUpdateChecklistItem();

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [workOrder, setWorkOrder] = useState<WorkOrderInfo | null>(null);
  const [tecnicoId, setTecnicoId] = useState<string | null>(null);
  const [checklistItems, setChecklistItems] = useState<any[]>([]);
  const [tecnicoNome, setTecnicoNome] = useState<string>("");
  const [formData, setFormData] = useState<RMEFormData>({
    ordem_servico_id: "",
    ticket_id: "",
    tecnico_id: "",
    data_execucao: new Date().toISOString().split("T")[0],
    weekday: getWeekday(new Date()),
    site_name: "",
    collaboration: [],
    micro_number: "",
    inverter_number: "",
    service_type: [],
    shift: "manha",
    start_time: "08:00",
    end_time: "17:00",
    images_posted: false,
    modules_cleaned_qty: 0,
    string_box_qty: 0,
    condicoes_encontradas: "",
    servicos_executados: "",
    materiais_utilizados: [],
    signatures: {},
    status: "rascunho",
    client_name: "",
    address: "",
    ufv_solarz: "",
  });

  const isNewRME = id === "new";

  useEffect(() => {
    loadTecnicoId();
  }, [profile]);

  useEffect(() => {
    if (isNewRME && osId) {
      loadWorkOrder(osId);
    } else if (!isNewRME && id) {
      loadExistingRME(id);
    }
  }, [id, osId, isNewRME]);

  const loadTecnicoId = async () => {
    if (!profile?.user_id) return;
    try {
      const data = await fetchData(
        supabase
          .from("tecnicos")
          .select("id, profiles(nome)")
          .eq("profile_id", profile.id)
          .maybeSingle()
      );
      if (data) {
        setTecnicoId(data.id);
        setTecnicoNome((data.profiles as any)?.nome || "");
      }
    } catch {
      // tecnico not found is acceptable
    }
  };

  const loadWorkOrder = async (workOrderId: string) => {
    try {
      setLoading(true);
      const data = await fetchData(
        supabase
          .from("ordens_servico")
          .select(`
            id, numero_os, site_name, ticket_id,
            tickets(id, endereco_servico, clientes(empresa, ufv_solarz))
          `)
          .eq("id", workOrderId)
          .single()
      );

      setWorkOrder(data as unknown as WorkOrderInfo);
      setFormData((prev) => ({
        ...prev,
        ordem_servico_id: data.id,
        ticket_id: data.ticket_id,
        site_name: data.site_name || "",
        client_name: (data.tickets as any)?.clientes?.empresa || "",
        address: (data.tickets as any)?.endereco_servico || "",
        ufv_solarz: (data.tickets as any)?.clientes?.ufv_solarz || "",
      }));
    } catch (error: any) {
      toast({ title: "Erro ao carregar OS", description: error.message, variant: "destructive" });
      navigate("/work-orders");
    } finally {
      setLoading(false);
    }
  };

  const loadExistingRME = async (rmeId: string) => {
    try {
      setLoading(true);
      const data = await fetchData(
        supabase
          .from("rme_relatorios")
          .select(`
            *,
            tecnicos(id, profiles(nome)),
            ordens_servico(
              id, numero_os, site_name, ticket_id,
              tickets(id, endereco_servico, clientes(empresa, ufv_solarz))
            )
          `)
          .eq("id", rmeId)
          .single()
      );

      const os = data.ordens_servico as any;
      const tecnico = data.tecnicos as any;
      setWorkOrder(os);
      setTecnicoNome(tecnico?.profiles?.nome || "");

      setFormData({
        id: data.id,
        ordem_servico_id: data.ordem_servico_id,
        ticket_id: data.ticket_id,
        tecnico_id: data.tecnico_id,
        data_execucao: data.data_execucao?.split("T")[0] || "",
        weekday: data.weekday || "",
        site_name: data.site_name || os?.site_name || "",
        collaboration: Array.isArray(data.collaboration) ? (data.collaboration as string[]) : [],
        micro_number: data.micro_number || "",
        inverter_number: data.inverter_number || "",
        service_type: Array.isArray(data.service_type) ? (data.service_type as string[]) : [],
        shift: data.shift || "manha",
        start_time: data.start_time || "08:00",
        end_time: data.end_time || "17:00",
        images_posted: data.images_posted || false,
        modules_cleaned_qty: data.modules_cleaned_qty || 0,
        string_box_qty: data.string_box_qty || 0,
        condicoes_encontradas: data.condicoes_encontradas || "",
        servicos_executados: data.servicos_executados || "",
        materiais_utilizados: Array.isArray(data.materiais_utilizados) ? (data.materiais_utilizados as Array<{ descricao: string; quantidade: number; tinha_estoque: boolean }>) : [],
        signatures: (data.signatures as any) || {},
        status: data.status || "rascunho",
        client_name: os?.tickets?.clientes?.empresa || "",
        address: os?.tickets?.endereco_servico || "",
        ufv_solarz: os?.tickets?.clientes?.ufv_solarz || "",
      });

      // Load checklist items
      const items = await fetchData(
        supabase
          .from("rme_checklist_items")
          .select("*")
          .eq("rme_id", rmeId)
          .order("category")
          .order("item_key")
      );

      setChecklistItems(items || []);
    } catch (error: any) {
      toast({ title: "Erro ao carregar RME", description: error.message, variant: "destructive" });
      navigate("/work-orders");
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = useCallback((updates: Partial<RMEFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  }, []);

  const saveRME = async (finalize = false) => {
    if (!tecnicoId && !formData.tecnico_id) {
      toast({ title: "Erro", description: "Técnico não identificado", variant: "destructive" });
      return null;
    }

    setSaving(true);
    try {
      const payload = {
        ordem_servico_id: formData.ordem_servico_id,
        ticket_id: formData.ticket_id,
        tecnico_id: formData.tecnico_id || tecnicoId,
        data_execucao: formData.data_execucao,
        weekday: formData.weekday,
        site_name: formData.site_name,
        collaboration: formData.collaboration,
        micro_number: formData.micro_number,
        inverter_number: formData.inverter_number,
        service_type: formData.service_type,
        shift: formData.shift,
        start_time: formData.start_time,
        end_time: formData.end_time,
        images_posted: formData.images_posted,
        modules_cleaned_qty: formData.modules_cleaned_qty,
        string_box_qty: formData.string_box_qty,
        condicoes_encontradas: formData.condicoes_encontradas || "A preencher",
        servicos_executados: formData.servicos_executados || "A preencher",
        materiais_utilizados: formData.materiais_utilizados,
        signatures: formData.signatures,
        status: finalize ? "concluido" : "rascunho",
      };

      let rmeId = formData.id;

      if (rmeId) {
        // Update existing
        await mutateData(
          supabase.from("rme_relatorios").update(payload).eq("id", rmeId).select().single()
        );
      } else {
        // Create new
        const data = await mutateData(
          supabase.from("rme_relatorios").insert([payload]).select().single()
        );
        rmeId = data.id;
        setFormData((prev) => ({ ...prev, id: rmeId }));

        // Populate checklist from catalog
        await supabase.rpc("populate_rme_checklist", { p_rme_id: rmeId });

        // Load checklist items
        const items = await fetchData(
          supabase
            .from("rme_checklist_items")
            .select("*")
            .eq("rme_id", rmeId)
            .order("category")
            .order("item_key")
        );
        setChecklistItems(items || []);
      }

      toast({ title: finalize ? "RME concluído!" : "Rascunho salvo" });
      return rmeId;
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    // Auto-save on step change
    const saved = await saveRME(false);
    if (saved && currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleFinalize = async () => {
    // Validate required fields
    if (!formData.servicos_executados || formData.servicos_executados.length < 10) {
      toast({
        title: "Campo obrigatório",
        description: "Preencha a descrição do serviço realizado",
        variant: "destructive",
      });
      return;
    }

    const rmeId = await saveRME(true);
    if (rmeId) {
      navigate(`/work-orders/${formData.ordem_servico_id}`);
    }
  };

  const updateChecklistItem = async (itemId: string, checked: boolean) => {
    try {
      await mutateData(
        supabase.from("rme_checklist_items").update({ checked }).eq("id", itemId).select().single()
      );
      setChecklistItems((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, checked } : item))
      );
    } catch {
      // silent fail for checklist toggle
    }
  };

  const handleExportPDF = async () => {
    if (!formData.id) {
      toast({ title: "Salve o RME antes de exportar", variant: "destructive" });
      return;
    }

    setExporting(true);
    try {
      // Group checklist items by category
      const checklistsByCategory = checklistItems.reduce((acc: any, item: any) => {
        if (!acc[item.category]) {
          acc[item.category] = [];
        }
        acc[item.category].push({ label: item.label, checked: item.checked });
        return acc;
      }, {});

      const checklists = Object.entries(checklistsByCategory).map(([category, items]) => ({
        category,
        items: items as { label: string; checked: boolean }[],
      }));

      // Count evidence files from storage (approximation based on form data)
      const pdfData: RMEPDFData = {
        numero_os: workOrder?.numero_os || "",
        cliente: formData.client_name,
        endereco: formData.address,
        site_name: formData.site_name,
        data_execucao: formData.data_execucao,
        weekday: formData.weekday,
        shift: formData.shift,
        start_time: formData.start_time,
        end_time: formData.end_time,
        service_type: formData.service_type,
        collaboration: formData.collaboration,
        checklists,
        images_posted: formData.images_posted,
        modules_cleaned_qty: formData.modules_cleaned_qty,
        string_box_qty: formData.string_box_qty,
        fotos_antes_count: 0, // Would need to count from storage
        fotos_depois_count: 0, // Would need to count from storage
        materiais_utilizados: formData.materiais_utilizados,
        servicos_executados: formData.servicos_executados,
        condicoes_encontradas: formData.condicoes_encontradas,
        signatures: formData.signatures,
        tecnico_nome: tecnicoNome || profile?.nome || "Técnico",
        status_aprovacao: formData.status,
        ufv_solarz: formData.ufv_solarz || undefined,
      };

      await downloadRMEPDF(pdfData, `RME_${workOrder?.numero_os || "draft"}.pdf`);
      toast({ title: "PDF exportado com sucesso!" });
    } catch (error: any) {
      toast({ title: "Erro ao exportar PDF", description: error.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const progress = (currentStep / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-muted/30 pb-32">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="p-4 max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/work-orders/${formData.ordem_servico_id}`)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold">RME - {workOrder?.numero_os}</h1>
              <p className="text-sm text-muted-foreground">{formData.client_name}</p>
            </div>
            <div className="flex items-center gap-2">
              {formData.id && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleExportPDF} 
                  disabled={exporting}
                  title="Exportar PDF"
                >
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                  <span className="ml-2 hidden sm:inline">PDF</span>
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => saveRME(false)} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span className="ml-2 hidden sm:inline">Salvar</span>
              </Button>
            </div>
          </div>

          {/* Progress */}
          <Progress value={progress} className="h-2" />

          {/* Step indicators */}
          <div className="flex justify-between mt-3">
            {STEPS.map((step) => (
              <button
                key={step.id}
                onClick={() => formData.id && setCurrentStep(step.id)}
                disabled={!formData.id && step.id > 1}
                className={cn(
                  "flex flex-col items-center gap-1 text-xs transition-colors",
                  currentStep === step.id
                    ? "text-primary font-medium"
                    : currentStep > step.id
                    ? "text-muted-foreground"
                    : "text-muted-foreground/50"
                )}
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                    currentStep === step.id
                      ? "bg-primary text-primary-foreground"
                      : currentStep > step.id
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {currentStep > step.id ? <Check className="h-4 w-4" /> : step.id}
                </div>
                <span className="hidden sm:block">{step.shortTitle}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="p-4 max-w-4xl mx-auto">
        <Card>
          <CardContent className="p-4 sm:p-6">
            {currentStep === 1 && (
              <StepIdentification formData={formData} updateFormData={updateFormData} />
            )}
            {currentStep === 2 && (
              <StepServiceShift formData={formData} updateFormData={updateFormData} />
            )}
            {currentStep === 3 && (
              <StepChecklists
                checklistItems={checklistItems}
                updateChecklistItem={updateChecklistItem}
                categories={["conexoes", "eletrica", "internet"]}
              />
            )}
            {currentStep === 4 && (
              <StepEvidence
                formData={formData}
                updateFormData={updateFormData}
                rmeId={formData.id}
                osId={formData.ordem_servico_id}
              />
            )}
            {currentStep === 5 && (
              <StepToolsEPIs
                checklistItems={checklistItems}
                updateChecklistItem={updateChecklistItem}
                categories={["ferramentas", "epis", "medidas_preventivas"]}
              />
            )}
            {currentStep === 6 && (
              <StepSignatures formData={formData} updateFormData={updateFormData} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fixed Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 z-20">
        <div className="max-w-4xl mx-auto flex gap-3">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 1}
            className="flex-1 h-12"
          >
            Anterior
          </Button>
          {currentStep < STEPS.length ? (
            <Button onClick={handleNext} disabled={saving} className="flex-1 h-12">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Próximo
            </Button>
          ) : (
            <Button onClick={handleFinalize} disabled={saving} className="flex-1 h-12 bg-green-600 hover:bg-green-700">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
              Concluir RME
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RMEWizard;
