import * as XLSX from 'xlsx';
import { logger } from '@/services/api';

export interface ParsedRow {
  [key: string]: string | number | null;
}

export interface ParseResult {
  data: ParsedRow[];
  headers: string[];
  errors: string[];
}

// Mapeia headers do Excel para campos do banco
const HEADER_MAPPING: Record<string, string> = {
  'empresa': 'empresa',
  'razao_social': 'empresa',
  'razão social': 'empresa',
  'nome': 'empresa',
  'cnpj': 'cnpj_cpf',
  'cpf': 'cnpj_cpf',
  'cnpj_cpf': 'cnpj_cpf',
  'cnpj/cpf': 'cnpj_cpf',
  'documento': 'cnpj_cpf',
  'endereco': 'endereco',
  'endereço': 'endereco',
  'rua': 'endereco',
  'logradouro': 'endereco',
  'cidade': 'cidade',
  'municipio': 'cidade',
  'município': 'cidade',
  'estado': 'estado',
  'uf': 'estado',
  'cep': 'cep',
  'codigo_postal': 'cep',
  'código postal': 'cep',
  'ufv_solarz': 'ufv_solarz',
  'ufv/solarz': 'ufv_solarz',
  'ufv': 'ufv_solarz',
  'solarz': 'ufv_solarz',
  'usina': 'ufv_solarz',
};

function normalizeHeader(header: string): string {
  const normalized = header.toLowerCase().trim().replace(/\s+/g, '_');
  return HEADER_MAPPING[normalized] || normalized;
}

export async function parseExcelFile(file: File): Promise<ParseResult> {
  const errors: string[] = [];
  
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    // Pegar primeira planilha
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return { data: [], headers: [], errors: ['Arquivo vazio ou sem planilhas'] };
    }
    
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { 
      header: 1,
      defval: ''
    });
    
    if (jsonData.length < 2) {
      return { data: [], headers: [], errors: ['Arquivo deve ter cabeçalho e pelo menos uma linha de dados'] };
    }
    
    // Primeira linha é o cabeçalho
    const rawHeaders = (jsonData[0] as unknown[]).map(h => String(h || '').trim());
    const headers = rawHeaders.map(normalizeHeader);
    
    // Converter dados
    const data: ParsedRow[] = [];
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i] as unknown[];
      
      // Ignorar linhas completamente vazias
      if (row.every(cell => cell === '' || cell === null || cell === undefined)) {
        continue;
      }
      
      const parsedRow: ParsedRow = {};
      headers.forEach((header, index) => {
        const value = row[index];
        parsedRow[header] = value !== undefined && value !== null ? String(value).trim() : null;
      });
      
      data.push(parsedRow);
    }
    
    return { data, headers, errors };
  } catch (error) {
    logger.error('Erro ao parsear arquivo:', error);
    return { 
      data: [], 
      headers: [], 
      errors: [`Erro ao ler arquivo: ${error instanceof Error ? error.message : 'Formato inválido'}`] 
    };
  }
}

export function generateClienteTemplate(): Blob {
  const templateData = [
    ['Empresa', 'CNPJ/CPF', 'Endereço', 'Cidade', 'Estado', 'CEP', 'UFV/SolarZ'],
    ['Empresa Exemplo Ltda', '00.000.000/0001-00', 'Av. T9, 1001', 'Goiânia', 'GO', '74215-025', 'UFV-001'],
    ['João da Silva', '000.000.000-00', 'Rua das Flores, 123', 'São Paulo', 'SP', '01310-100', ''],
  ];
  
  const worksheet = XLSX.utils.aoa_to_sheet(templateData);
  
  // Ajustar largura das colunas
  worksheet['!cols'] = [
    { wch: 30 }, // Empresa
    { wch: 20 }, // CNPJ/CPF
    { wch: 40 }, // Endereço
    { wch: 20 }, // Cidade
    { wch: 8 },  // Estado
    { wch: 12 }, // CEP
    { wch: 15 }, // UFV/SolarZ
  ];
  
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Clientes');
  
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function downloadTemplate(filename: string = 'template_clientes.xlsx'): void {
  const blob = generateClienteTemplate();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
