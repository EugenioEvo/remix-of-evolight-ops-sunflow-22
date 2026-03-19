import { useState, useCallback } from 'react';
import logger from '@/lib/logger';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, Download, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle, Trash2 } from 'lucide-react';
import { parseExcelFile, downloadTemplate } from '@/utils/excelImporter';
import { validateClientesBatch, prepareClienteForInsert, ValidatedCliente } from '@/utils/clienteValidation';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

type ImportStep = 'upload' | 'preview' | 'importing' | 'complete';

interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

export function BulkImportDialog({ open, onOpenChange, onImportComplete }: BulkImportDialogProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [validatedData, setValidatedData] = useState<ValidatedCliente[]>([]);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parseErrors, setParseErrors] = useState<string[]>([]);

  const resetState = useCallback(() => {
    setStep('upload');
    setValidatedData([]);
    setProgress(0);
    setResult(null);
    setParseErrors([]);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onOpenChange(false);
  }, [resetState, onOpenChange]);

  const handleFileSelect = async (file: File) => {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    
    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error('Formato inválido. Use .xlsx, .xls ou .csv');
      return;
    }

    try {
      // Parse arquivo
      const { data, errors } = await parseExcelFile(file);
      
      if (errors.length > 0) {
        setParseErrors(errors);
        return;
      }
      
      if (data.length === 0) {
        toast.error('Arquivo vazio ou sem dados válidos');
        return;
      }

      // Buscar documentos existentes para verificar duplicatas
      const { data: existingClientes } = await supabase
        .from('clientes')
        .select('cnpj_cpf');
      
      const existingDocs = (existingClientes || [])
        .map(c => c.cnpj_cpf)
        .filter(Boolean) as string[];

      // Validar dados
      const validated = validateClientesBatch(data, existingDocs);
      setValidatedData(validated);
      setStep('preview');
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      toast.error('Erro ao processar arquivo');
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, []);

  const removeRow = useCallback((index: number) => {
    setValidatedData(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleImport = async () => {
    const validRows = validatedData.filter(row => row._validation.valid);
    
    if (validRows.length === 0) {
      toast.error('Nenhum registro válido para importar');
      return;
    }

    setStep('importing');
    setProgress(0);

    const BATCH_SIZE = 50;
    const errors: Array<{ row: number; error: string }> = [];
    let successCount = 0;

    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
      const batch = validRows.slice(i, i + BATCH_SIZE);
      const insertData = batch.map(row => prepareClienteForInsert(row));

      const { error } = await supabase
        .from('clientes')
        .insert(insertData);

      if (error) {
        batch.forEach((row) => {
          errors.push({ row: row._rowIndex + 1, error: error.message });
        });
      } else {
        successCount += batch.length;
      }

      setProgress(Math.round(((i + batch.length) / validRows.length) * 100));
    }

    setResult({
      total: validRows.length,
      success: successCount,
      failed: errors.length,
      errors
    });
    setStep('complete');
    
    if (successCount > 0) {
      onImportComplete();
    }
  };

  const validCount = validatedData.filter(r => r._validation.valid).length;
  const invalidCount = validatedData.filter(r => !r._validation.valid).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Clientes em Lote
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Faça upload de um arquivo Excel ou CSV com os dados dos clientes'}
            {step === 'preview' && 'Revise os dados antes de importar'}
            {step === 'importing' && 'Importando dados...'}
            {step === 'complete' && 'Importação concluída'}
          </DialogDescription>
        </DialogHeader>

        {/* Step: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">Arraste o arquivo aqui</p>
              <p className="text-sm text-muted-foreground mb-4">ou</p>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileInput}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload">
                <Button variant="outline" asChild>
                  <span>Selecionar arquivo</span>
                </Button>
              </label>
              <p className="text-xs text-muted-foreground mt-4">
                Formatos aceitos: .xlsx, .xls, .csv
              </p>
            </div>

            {parseErrors.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {parseErrors.map((err, i) => (
                    <p key={i}>{err}</p>
                  ))}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-between items-center pt-4 border-t">
              <Button variant="outline" onClick={() => downloadTemplate()}>
                <Download className="h-4 w-4 mr-2" />
                Baixar Template
              </Button>
              <Button variant="ghost" onClick={handleClose}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && (
          <div className="flex-1 flex flex-col min-h-0 space-y-4">
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-500" />
                {validCount} válidos
              </Badge>
              {invalidCount > 0 && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <XCircle className="h-3 w-3" />
                  {invalidCount} com erros
                </Badge>
              )}
            </div>

            <ScrollArea className="flex-1 border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">#</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>CNPJ/CPF</TableHead>
                    <TableHead>Cidade</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validatedData.map((row, index) => (
                    <TableRow 
                      key={index}
                      className={!row._validation.valid ? 'bg-destructive/10' : ''}
                    >
                      <TableCell className="font-mono text-xs">
                        {row._rowIndex + 1}
                      </TableCell>
                      <TableCell>{row.empresa || '-'}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {row.cnpj_cpf || '-'}
                      </TableCell>
                      <TableCell>{row.cidade || '-'}</TableCell>
                      <TableCell>{row.estado || '-'}</TableCell>
                      <TableCell>
                        {row._validation.valid ? (
                          <Badge variant="outline" className="text-green-600">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            OK
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">
                            {row._validation.errors[0]}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => removeRow(index)}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="flex justify-between items-center pt-4 border-t">
              <Button variant="outline" onClick={resetState}>
                Voltar
              </Button>
              <Button 
                onClick={handleImport} 
                disabled={validCount === 0}
              >
                Importar {validCount} registros
              </Button>
            </div>
          </div>
        )}

        {/* Step: Importing */}
        {step === 'importing' && (
          <div className="py-8 space-y-4">
            <div className="text-center">
              <p className="text-lg font-medium mb-2">Importando dados...</p>
              <p className="text-sm text-muted-foreground">{progress}% concluído</p>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Step: Complete */}
        {step === 'complete' && result && (
          <div className="space-y-4">
            <div className="text-center py-4">
              {result.success > 0 ? (
                <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
              ) : (
                <XCircle className="h-16 w-16 mx-auto text-destructive mb-4" />
              )}
              <p className="text-xl font-medium">
                {result.success > 0 ? 'Importação concluída!' : 'Falha na importação'}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-2xl font-bold">{result.total}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
              <div className="p-4 bg-green-500/10 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{result.success}</p>
                <p className="text-sm text-muted-foreground">Sucesso</p>
              </div>
              <div className="p-4 bg-destructive/10 rounded-lg">
                <p className="text-2xl font-bold text-destructive">{result.failed}</p>
                <p className="text-sm text-muted-foreground">Erros</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium mb-2">Erros encontrados:</p>
                  <ul className="list-disc pl-4 space-y-1 text-sm">
                    {result.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>Linha {err.row}: {err.error}</li>
                    ))}
                    {result.errors.length > 5 && (
                      <li>... e mais {result.errors.length - 5} erros</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end pt-4 border-t">
              <Button onClick={handleClose}>Fechar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
