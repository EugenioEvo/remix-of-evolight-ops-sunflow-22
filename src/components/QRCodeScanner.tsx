import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { logger } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Camera, X, Loader2, RefreshCw, KeyboardIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface QRCodeScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
}

export const QRCodeScanner = ({ onScanSuccess, onClose }: QRCodeScannerProps) => {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string>('');
  const [manualInput, setManualInput] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const { toast } = useToast();

  // Gera um código sugerido no formato EQ-YYYY-XXX
  const getSuggestedCode = () => {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `EQ-${year}-${random}`;
  };

  useEffect(() => {
    startScanner();

    return () => {
      stopScanner();
    };
  }, []);

  const startScanner = async () => {
    try {
      setScanning(true);
      setError('');
      setManualInput(false);

      const html5QrCode = new Html5Qrcode('qr-reader');
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 15,
          qrbox: { width: 280, height: 280 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          toast({
            title: 'QR Code detectado!',
            description: 'Processando informações...',
          });
          onScanSuccess(decodedText);
          stopScanner();
        },
        () => {
          // Error callback - silent failures during scan
        }
      );
    } catch (err: any) {
      logger.error('Erro ao iniciar scanner:', err);
      
      let errorMessage = 'Não foi possível acessar a câmera.';
      if (err.name === 'NotAllowedError') {
        errorMessage = 'Permissão de câmera negada. Clique em "Permitir" quando o navegador solicitar.';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'Nenhuma câmera encontrada no dispositivo.';
      } else if (err.name === 'NotReadableError') {
        errorMessage = 'Câmera está sendo usada por outro aplicativo.';
      }
      
      setError(errorMessage);
      setScanning(false);
      toast({
        title: 'Erro na câmera',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleManualSubmit = () => {
    if (manualCode.trim()) {
      toast({
        title: 'Código inserido!',
        description: 'Processando informações...',
      });
      onScanSuccess(manualCode.trim());
      stopScanner();
    }
  };

  const stopScanner = async () => {
    try {
      if (scannerRef.current && scannerRef.current.isScanning) {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      }
    } catch (err) {
      logger.error('Erro ao parar scanner:', err);
    } finally {
      setScanning(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Escanear QR Code
            </CardTitle>
            <CardDescription>
              Aponte a câmera para o QR Code do equipamento
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!manualInput ? (
          <>
            <div
              id="qr-reader"
              className="w-full rounded-lg overflow-hidden border-2 border-primary"
              style={{ minHeight: '280px' }}
            />
            
            {scanning && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Aguardando QR Code...
              </div>
            )}

            {error && (
              <div className="space-y-3">
                <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                  {error}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={startScanner}
                    variant="outline"
                    className="flex-1"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Tentar Novamente
                  </Button>
                  <Button
                    onClick={() => {
                      stopScanner();
                      setManualCode(getSuggestedCode());
                      setManualInput(true);
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    <KeyboardIcon className="h-4 w-4 mr-2" />
                    Digitar Código
                  </Button>
                </div>
              </div>
            )}

            {!error && (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground text-center">
                  Permita o acesso à câmera quando solicitado pelo navegador
                </div>
                <Button
                  onClick={() => {
                    stopScanner();
                    setManualCode(getSuggestedCode());
                    setManualInput(true);
                  }}
                  variant="ghost"
                  size="sm"
                  className="w-full"
                >
                  <KeyboardIcon className="h-4 w-4 mr-2" />
                  Ou digite o código manualmente
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Código do equipamento
              </label>
              <div className="text-xs text-muted-foreground mb-2">
                Use o formato: EQ-ANO-XXX (Ex: EQ-2025-001)
              </div>
              <Input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                placeholder="EQ-2025-001"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleManualSubmit();
                  }
                }}
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setManualInput(false);
                  setManualCode('');
                  startScanner();
                }}
                variant="outline"
                className="flex-1"
              >
                <Camera className="h-4 w-4 mr-2" />
                Voltar para Câmera
              </Button>
              <Button
                onClick={handleManualSubmit}
                disabled={!manualCode.trim()}
                className="flex-1"
              >
                Confirmar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
