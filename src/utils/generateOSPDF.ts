import jsPDF from 'jspdf';
import 'jspdf-autotable';
import logger from '@/lib/logger';

interface OSData {
  numero_os: string;
  data_programada: string;
  equipe: string[];
  cliente: string;
  endereco: string;
  servico_solicitado: string;
  hora_marcada: string;
  descricao: string;
  inspetor_responsavel: string;
  tipo_trabalho: string[];
  ufv_solarz?: string;
}

export const generateOSPDF = async (osData: OSData): Promise<Blob> => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;

  // Adicionar borda da página
  doc.setLineWidth(0.5);
  doc.rect(margin, margin, pageWidth - 2 * margin, pageHeight - 2 * margin);

  // Logo e Cabeçalho
  try {
    const logoImg = await loadImage('/images/evolight-logo.jpg');
    doc.addImage(logoImg, 'JPEG', margin + 2, margin + 2, 50, 20);
  } catch (error) {
    console.warn('Logo não carregado, continuando sem logo');
  }

  // Título
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('ORDEM DE SERVIÇO EVOLIGHT', pageWidth / 2, margin + 15, { align: 'center' });

  let yPos = margin + 25;

  // DATA (fundo preto)
  doc.setFillColor(0, 0, 0);
  doc.rect(margin, yPos, 45, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('DATA', margin + 2, yPos + 5);

  doc.setFillColor(255, 255, 255);
  doc.rect(margin + 45, yPos, pageWidth - 2 * margin - 45, 8, 'F');
  doc.setTextColor(0, 0, 0);
  const dataFormatada = new Date(osData.data_programada).toLocaleDateString('pt-BR');
  doc.text(dataFormatada, margin + 47, yPos + 5);
  yPos += 8;

  // EQUIPE
  doc.setFillColor(200, 200, 200);
  doc.rect(margin, yPos, 45, 8, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text('EQUIPE', margin + 2, yPos + 5);

  doc.setFillColor(255, 255, 255);
  doc.rect(margin + 45, yPos, pageWidth - 2 * margin - 45, 8, 'F');
  doc.setFont('helvetica', 'normal');
  const equipeTxt = osData.equipe.join(' / ').toUpperCase();
  doc.text(equipeTxt, margin + 47, yPos + 5);
  yPos += 8;

  // CLIENTE (fundo amarelo)
  doc.setFillColor(200, 200, 200);
  doc.rect(margin, yPos, 45, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENTE', margin + 2, yPos + 5);

  doc.setFillColor(255, 255, 0);
  doc.rect(margin + 45, yPos, pageWidth - 2 * margin - 45, 8, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(osData.cliente.toUpperCase(), margin + 47, yPos + 5);
  yPos += 8;

  // UFV/SolarZ (próximo ao cliente)
  if (osData.ufv_solarz) {
    doc.setFillColor(200, 200, 200);
    doc.rect(margin, yPos, 45, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('UFV/SOLARZ', margin + 2, yPos + 5);

    doc.setFillColor(255, 200, 100);
    doc.rect(margin + 45, yPos, pageWidth - 2 * margin - 45, 8, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text(osData.ufv_solarz.toUpperCase(), margin + 47, yPos + 5);
    yPos += 8;
  }

  // ENDEREÇO
  doc.setFillColor(200, 200, 200);
  doc.rect(margin, yPos, 45, 25, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text('ENDEREÇO', margin + 2, yPos + 5);

  doc.setFillColor(255, 255, 255);
  doc.rect(margin + 45, yPos, pageWidth - 2 * margin - 45, 25, 'F');
  doc.setFont('helvetica', 'normal');
  const enderecoLines = doc.splitTextToSize(osData.endereco, pageWidth - 2 * margin - 50);
  doc.text(enderecoLines, margin + 47, yPos + 5);
  yPos += 25;

  // SERVIÇO SOLICITADO (amarelo)
  doc.setFillColor(200, 200, 200);
  doc.rect(margin, yPos, 45, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text('SERVIÇO SOLICITADO', margin + 2, yPos + 5);

  doc.setFillColor(255, 255, 0);
  doc.rect(margin + 45, yPos, pageWidth - 2 * margin - 45, 8, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(osData.servico_solicitado.toUpperCase(), margin + 47, yPos + 5);
  yPos += 8;

  // HORA MARCADA (fundo preto)
  doc.setFillColor(200, 200, 200);
  doc.rect(margin, yPos, 45, 8, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text('HORA MARCADA', margin + 2, yPos + 5);

  doc.setFillColor(0, 0, 0);
  doc.rect(margin + 45, yPos, pageWidth - 2 * margin - 45, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(osData.hora_marcada, margin + 47, yPos + 5);
  yPos += 8;

  // DESCRIÇÃO EXATA DO SERVIÇO
  doc.setFillColor(200, 200, 200);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text('DESCRIÇÃO EXATA DO SERVIÇO A SER REALIZADO', margin + 2, yPos + 5);
  yPos += 8;

  doc.setFillColor(255, 255, 255);
  const descricaoHeight = 60;
  doc.rect(margin, yPos, pageWidth - 2 * margin, descricaoHeight, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const descricaoLines = doc.splitTextToSize(osData.descricao, pageWidth - 2 * margin - 4);
  doc.text(descricaoLines, margin + 2, yPos + 5);
  yPos += descricaoHeight;

  // INSPETOR RESPONSÁVEL (fundo verde)
  doc.setFillColor(200, 200, 200);
  doc.rect(margin, yPos, 45, 8, 'F');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('INSPETOR RESPONSÁVEL:', margin + 2, yPos + 5);

  doc.setFillColor(0, 200, 0);
  doc.rect(margin + 45, yPos, pageWidth - 2 * margin - 45, 8, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text(osData.inspetor_responsavel.toUpperCase(), margin + 47, yPos + 5);
  yPos += 8;

  // OBS sobre RME (fundo amarelo)
  doc.setFillColor(255, 255, 0);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const obsText = 'OBS 1: A MESMA DEVE SER PREENCHIDA E GRAMPEADA JUNTO COM O RME, NÃO SERÁ PERMITIDO RME SEM A O.S GRAMPEADA E/OU VINCULADA.';
  doc.text(obsText, margin + 2, yPos + 5, { maxWidth: pageWidth - 2 * margin - 4 });
  yPos += 8;

  // TIPO DE TRABALHO (com checkboxes)
  doc.setFillColor(0, 0, 0);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 15, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('TIPO DE TRABALHO', margin + 2, yPos + 6);

  const checkboxY = yPos + 10;
  const checkboxSize = 5;
  const checkboxSpacing = 50;
  let checkboxX = margin + 40;

  // Checkbox INTERNET
  doc.setFillColor(255, 255, 255);
  doc.rect(checkboxX, checkboxY, checkboxSize, checkboxSize, 'F');
  if (osData.tipo_trabalho.includes('internet')) {
    doc.setFillColor(0, 0, 0);
    doc.circle(checkboxX + checkboxSize/2, checkboxY + checkboxSize/2, checkboxSize/3, 'F');
  }
  doc.setTextColor(255, 255, 255);
  doc.text('INTERNET', checkboxX + checkboxSize + 2, checkboxY + 4);

  // Checkbox ELÉTRICA
  checkboxX += checkboxSpacing;
  doc.setFillColor(255, 255, 255);
  doc.rect(checkboxX, checkboxY, checkboxSize, checkboxSize, 'F');
  if (osData.tipo_trabalho.includes('eletrica')) {
    doc.setFillColor(0, 0, 0);
    doc.circle(checkboxX + checkboxSize/2, checkboxY + checkboxSize/2, checkboxSize/3, 'F');
  }
  doc.setTextColor(255, 255, 255);
  doc.text('ELÉTRICA', checkboxX + checkboxSize + 2, checkboxY + 4);

  // Checkbox LIMPEZA
  checkboxX += checkboxSpacing;
  doc.setFillColor(255, 255, 255);
  doc.rect(checkboxX, checkboxY, checkboxSize, checkboxSize, 'F');
  if (osData.tipo_trabalho.includes('limpeza')) {
    doc.setFillColor(0, 0, 0);
    doc.circle(checkboxX + checkboxSize/2, checkboxY + checkboxSize/2, checkboxSize/3, 'F');
  }
  doc.setTextColor(255, 255, 255);
  doc.text('LIMPEZA', checkboxX + checkboxSize + 2, checkboxY + 4);
  yPos += 15;

  // Linha para assinatura
  yPos += 20;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  const lineWidth = 80;
  const lineX = (pageWidth - lineWidth) / 2;
  doc.line(lineX, yPos, lineX + lineWidth, yPos);

  yPos += 5;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Responsável pelo Atendimento', pageWidth / 2, yPos, { align: 'center' });

  // Rodapé com data
  doc.setFontSize(8);
  doc.text(new Date().toLocaleDateString('pt-BR'), margin, pageHeight - margin - 2);

  return doc.output('blob');
};

// Função auxiliar para carregar imagem
const loadImage = (src: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg'));
      } else {
        reject(new Error('Failed to get canvas context'));
      }
    };
    img.onerror = reject;
    img.src = src;
  });
};
