import logger from '@/lib/logger';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle, Clock, AlertCircle, QrCode, Mail, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import QRCode from "qrcode";
import { useEffect } from "react";

interface PresenceConfirmationStatusProps {
  ordemServico: {
    id: string;
    numero_os: string;
    presence_confirmed_at?: string | null;
    presence_confirmed_by?: string | null;
    qr_code?: string | null;
    data_programada?: string | null;
    hora_inicio?: string | null;
    tecnicos?: {
      profiles?: {
        nome: string;
        email?: string;
      };
    };
  };
  onGenerateQR?: () => Promise<void>;
}

export const PresenceConfirmationStatus = ({ 
  ordemServico,
  onGenerateQR 
}: PresenceConfirmationStatusProps) => {
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [qrCodeDataURL, setQrCodeDataURL] = useState<string>('');
  const [generating, setGenerating] = useState(false);

  const isConfirmed = !!ordemServico.presence_confirmed_at;
  const hasQRCode = !!ordemServico.qr_code;
  const isPast = ordemServico.data_programada 
    ? new Date(ordemServico.data_programada) < new Date()
    : false;

  // Gerar QR Code quando abrir o dialog
  useEffect(() => {
    if (showQRDialog && ordemServico.qr_code) {
      generateQRCodeImage();
    }
  }, [showQRDialog, ordemServico.qr_code]);

  const generateQRCodeImage = async () => {
    if (!ordemServico.qr_code) return;

    try {
      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      const confirmUrl = `${baseUrl}/functions/v1/confirm-presence?os_id=${ordemServico.id}&token=${ordemServico.qr_code}`;
      
      const qrDataURL = await QRCode.toDataURL(confirmUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      setQrCodeDataURL(qrDataURL);
    } catch (error) {
      logger.error('Erro ao gerar QR Code:', error);
    }
  };

  const handleGenerateQR = async () => {
    if (!onGenerateQR) return;
    setGenerating(true);
    try {
      await onGenerateQR();
    } finally {
      setGenerating(false);
    }
  };

  const getStatusBadge = () => {
    if (isConfirmed) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge className="bg-green-500 hover:bg-green-600 cursor-help">
                <CheckCircle className="h-3 w-3 mr-1" />
                Presença Confirmada
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs space-y-1">
                <p className="font-semibold">Confirmado em:</p>
                <p>{format(new Date(ordemServico.presence_confirmed_at!), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                {ordemServico.tecnicos?.profiles?.nome && (
                  <>
                    <p className="font-semibold mt-2">Por:</p>
                    <p>{ordemServico.tecnicos.profiles.nome}</p>
                  </>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    if (isPast) {
      return (
        <Badge variant="outline" className="text-amber-600 border-amber-600">
          <Clock className="h-3 w-3 mr-1" />
          Não Confirmado
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="text-blue-600 border-blue-600">
        <Clock className="h-3 w-3 mr-1" />
        Aguardando
      </Badge>
    );
  };

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {getStatusBadge()}
        
        {!isConfirmed && hasQRCode && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowQRDialog(true)}
          >
            <QrCode className="h-4 w-4 mr-2" />
            Ver QR Code
          </Button>
        )}

        {!isConfirmed && !hasQRCode && onGenerateQR && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateQR}
            disabled={generating}
          >
            <QrCode className="h-4 w-4 mr-2" />
            {generating ? 'Gerando...' : 'Gerar QR Code'}
          </Button>
        )}
      </div>

      {/* Dialog do QR Code */}
      <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              QR Code - Confirmação de Presença
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">OS:</span>
                    <span className="font-medium">{ordemServico.numero_os}</span>
                  </div>
                  {ordemServico.data_programada && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Data:</span>
                      <span className="font-medium">
                        {format(new Date(ordemServico.data_programada), "dd/MM/yyyy", { locale: ptBR })}
                        {ordemServico.hora_inicio && ` às ${ordemServico.hora_inicio}`}
                      </span>
                    </div>
                  )}
                  {ordemServico.tecnicos?.profiles?.nome && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Técnico:</span>
                      <span className="font-medium">{ordemServico.tecnicos.profiles.nome}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {qrCodeDataURL && (
              <div className="flex flex-col items-center gap-4">
                <div className="bg-white p-4 rounded-lg border-2 border-primary/20">
                  <img 
                    src={qrCodeDataURL} 
                    alt="QR Code de Confirmação" 
                    className="w-64 h-64"
                  />
                </div>
                
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Escaneie este QR Code para confirmar a presença
                  </p>
                  <Badge variant="outline" className="text-xs">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Válido por 24 horas
                  </Badge>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const link = document.createElement('a');
                    link.download = `qrcode-${ordemServico.numero_os}.png`;
                    link.href = qrCodeDataURL;
                    link.click();
                  }}
                  className="w-full"
                >
                  Baixar QR Code
                </Button>
              </div>
            )}

            {ordemServico.tecnicos?.profiles?.email && (
              <div className="bg-muted/50 p-3 rounded-lg">
                <div className="flex items-start gap-2">
                  <Mail className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div className="flex-1 text-xs">
                    <p className="font-medium mb-1">Envio Automático</p>
                    <p className="text-muted-foreground">
                      O QR Code foi enviado por email para <strong>{ordemServico.tecnicos.profiles.email}</strong>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
