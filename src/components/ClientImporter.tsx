import React, { useState, useRef } from 'react';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle, 
  AlertTriangle, 
  Trash2, 
  Edit3, 
  HelpCircle, 
  Play, 
  Settings, 
  FileText, 
  Sparkles, 
  Search, 
  Check, 
  Filter, 
  ChevronRight, 
  ChevronLeft 
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Parada } from '../types';

interface ClientImporterProps {
  onImportStops: (stops: Parada[]) => void;
  currentRegion: string;
}

interface RawImportedRow {
  [key: string]: any;
}

interface ValidatedRow {
  id: string;
  originalIndex: number;
  clientName: string;
  clientWhatsApp: string;
  address: string;
  lat: number;
  lng: number;
  errors: {
    clientName?: string;
    clientWhatsApp?: string;
    address?: string;
    coordinates?: string;
  };
  isValid: boolean;
}

export default function ClientImporter({ onImportStops, currentRegion }: ClientImporterProps) {
  // Wizard steps: 'upload' | 'mapping' | 'editing' | 'preview_summary'
  const [step, setStep] = useState<'upload' | 'mapping' | 'editing'>('upload');
  const [fileName, setFileName] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<RawImportedRow[]>([]);
  
  // Custom manual mappings: target -> source file column
  const [mappings, setMappings] = useState<{
    clientName: string;
    clientWhatsApp: string;
    address: string;
    lat: string;
    lng: string;
  }>({
    clientName: '',
    clientWhatsApp: '',
    address: '',
    lat: '',
    lng: ''
  });

  // Parsed and validated list of clients ready for live editing
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'errors' | 'valid'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  // Approximate center lat/lng for auto-geocoding depending on region
  const getRegionCoordinates = (reg: string) => {
    switch (reg.toUpperCase()) {
      case 'GV1':
      case 'GV2':
      case 'VARGUES':
      case 'GOVERNADOR VALADARES':
        return { lat: -18.85, lng: -41.95 };
      case 'BH':
      case 'BELO HORIZONTE':
      case 'MG':
        return { lat: -19.92, lng: -43.94 };
      default:
        return { lat: -18.85, lng: -41.95 };
    }
  };

  // Helper validation logic
  const validateRowData = (
    name: string, 
    whatsapp: string, 
    addr: string, 
    latitude: number, 
    longitude: number
  ) => {
    const errors: { clientName?: string; clientWhatsApp?: string; address?: string; coordinates?: string } = {};
    
    const cleanName = (name || '').toString().trim();
    if (!cleanName) {
      errors.clientName = 'Nome do cliente é obrigatório.';
    } else if (cleanName.length < 3) {
      errors.clientName = 'Nome muito curto (mínimo de 3 caracteres).';
    }

    const cleanAddr = (addr || '').toString().trim();
    if (!cleanAddr) {
      errors.address = 'Endereço de entrega é obrigatório.';
    } else if (cleanAddr.length < 10) {
      errors.address = 'Forneça um endereço mais completo para guiar o roteador.';
    }

    const cleanWhatsApp = (whatsapp || '').toString().trim().replace(/\D/g, '');
    if (cleanWhatsApp) {
      if (cleanWhatsApp.length < 10 || cleanWhatsApp.length > 15) {
        errors.clientWhatsApp = 'Formato inválido (deve conter DDI e DDD, ex: 5533991234567).';
      }
    } else {
      errors.clientWhatsApp = 'WhatsApp ausente (importante para disparo de alertas de rastreamento).';
    }

    // Latitude / Longitude limits Brazil bounds approx: Lat -34 to +5, Lng -74 to -35
    if (isNaN(latitude) || isNaN(longitude) || latitude === 0 || longitude === 0) {
      errors.coordinates = 'Coordenadas ausentes. Serão simuladas no centro da região de destino.';
    } else if (latitude < -34 || latitude > 5 || longitude < -74 || longitude > -35) {
      errors.coordinates = 'Coordenadas geográficas inválidas para o território nacional brasileiro.';
    }

    return {
      errors,
      isValid: Object.keys(errors).length === 0 || (Object.keys(errors).length === 1 && errors.coordinates !== undefined)
    };
  };

  // Drag and Drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    setFileName(file.name);
    const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    const reader = new FileReader();

    if (extension === '.csv' || extension === '.txt') {
      reader.onload = (evt) => {
        const text = evt.target?.result as string;
        try {
          parseCSV(text);
        } catch (err) {
          alert('Erro ao processar arquivo de texto: ' + err);
        }
      };
      reader.readAsText(file, 'UTF-8');
    } else if (extension === '.xlsx' || extension === '.xls') {
      reader.onload = (evt) => {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        try {
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          if (json.length > 0) {
            const rawHeaders = (json[0] as any[]).map((val, idx) => (val ? val.toString().trim() : `Coluna ${idx + 1}`));
            const rows: RawImportedRow[] = [];
            
            for (let i = 1; i < json.length; i++) {
              const rowData = json[i] as any[];
              if (!rowData || rowData.every(cell => cell === null || cell === undefined || cell === '')) continue;
              const rowObj: RawImportedRow = {};
              rawHeaders.forEach((hdr, idx) => {
                rowObj[hdr] = rowData[idx] !== undefined ? rowData[idx] : '';
              });
              rows.push(rowObj);
            }

            setHeaders(rawHeaders);
            setRawRows(rows);
            autoDetectMappings(rawHeaders);
            setStep('mapping');
          } else {
            alert('A planilha importada está vazia.');
          }
        } catch (err) {
          alert('Erro ao processar arquivo do Excel: ' + err);
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (extension === '.json') {
      reader.onload = (evt) => {
        try {
          const json = JSON.parse(evt.target?.result as string);
          let parsedRows: RawImportedRow[] = [];
          if (Array.isArray(json)) {
            parsedRows = json;
          } else if (json.records || json.data || json.clients) {
            parsedRows = json.records || json.data || json.clients;
          }
          
          if (parsedRows.length > 0) {
            const keys = Object.keys(parsedRows[0]);
            setHeaders(keys);
            setRawRows(parsedRows);
            autoDetectMappings(keys);
            setStep('mapping');
          } else {
            alert('O JSON importado está vazio ou não possui formato de array corporativo esperado.');
          }
        } catch (e) {
          alert('Erro na estrutura do JSON: ' + e);
        }
      };
      reader.readAsText(file);
    } else {
      alert('Extensão de arquivo não suportada. Escolha um arquivo Excel (.xlsx, .xls), CSV (.csv) ou cadastro em JSON.');
    }
  };

  const parseCSV = (text: string) => {
    // Detect delim: semicolon or comma
    const semicolonCount = (text.match(/;/g) || []).length;
    const commaCount = (text.match(/,/g) || []).length;
    const delim = semicolonCount > commaCount ? ';' : ',';

    const lines = text.split(/\r?\n/);
    if (lines.length === 0 || lines[0].trim() === '') {
      alert('Arquivo CSV vazio.');
      return;
    }

    // Split headers taking care of potential quotes
    const rawHeaders = splitCSVLine(lines[0], delim).map((h, i) => h.trim() || `Coluna ${i + 1}`);
    const rows: RawImportedRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const values = splitCSVLine(line, delim);
      const rowObj: RawImportedRow = {};
      rawHeaders.forEach((hdr, idx) => {
        rowObj[hdr] = values[idx] !== undefined ? values[idx].trim() : '';
      });
      rows.push(rowObj);
    }

    setHeaders(rawHeaders);
    setRawRows(rows);
    autoDetectMappings(rawHeaders);
    setStep('mapping');
  };

  const splitCSVLine = (line: string, delim: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === delim && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  };

  // Attempt automatic mapping detection of header text (case insensitive)
  const autoDetectMappings = (currentHeaders: string[]) => {
    const detected = {
      clientName: '',
      clientWhatsApp: '',
      address: '',
      lat: '',
      lng: ''
    };

    currentHeaders.forEach(hdr => {
      const norm = hdr.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      
      // Auto detect Name
      if (norm.includes('nome') || norm.includes('cliente') || norm.includes('client') || norm.includes('destinatario') || norm.includes('razao')) {
        if (!detected.clientName) detected.clientName = hdr;
      }
      // Auto detect WhatsApp
      if (norm.includes('whats') || norm.includes('phone') || norm.includes('tel') || norm.includes('cel') || norm.includes('fone') || norm.includes('contato')) {
        if (!detected.clientWhatsApp) detected.clientWhatsApp = hdr;
      }
      // Auto detect Address
      if (norm.includes('end') || norm.includes('rua') || norm.includes('local') || norm.includes('address') || norm.includes('logradouro')) {
        if (!detected.address) detected.address = hdr;
      }
      // Auto detect Lat
      if (norm.includes('lat') || norm.includes('latitude') || norm.includes('coordy')) {
        if (!detected.lat) detected.lat = hdr;
      }
      // Auto detect Lng
      if (norm.includes('lng') || norm.includes('lon') || norm.includes('longitude') || norm.includes('coordx')) {
        if (!detected.lng) detected.lng = hdr;
      }
    });

    // Fallbacks if not detected
    if (!detected.clientName && currentHeaders.length > 0) detected.clientName = currentHeaders[0];
    if (!detected.address && currentHeaders.length > 1) detected.address = currentHeaders[1];
    if (!detected.clientWhatsApp && currentHeaders.length > 2) detected.clientWhatsApp = currentHeaders[2];

    setMappings(detected);
  };

  // Compute final mapped objects and pre-validate them
  const handleApplyMappings = () => {
    if (!mappings.clientName) {
      alert('Mapeie uma coluna para "Nome do Cliente"!');
      return;
    }
    if (!mappings.address) {
      alert('Mapeie uma coluna para "Endereço de Entrega"!');
      return;
    }

    const regionDefaults = getRegionCoordinates(currentRegion);
    
    const validated: ValidatedRow[] = rawRows.map((r, index) => {
      const rawName = r[mappings.clientName] || '';
      const rawWhatsApp = mappings.clientWhatsApp ? r[mappings.clientWhatsApp] || '' : '';
      const rawAddress = r[mappings.address] || '';
      
      // Attempt double conversion for Lat/Lng
      let rawLat = mappings.lat ? parseFloat(r[mappings.lat]) : NaN;
      let rawLng = mappings.lng ? parseFloat(r[mappings.lng]) : NaN;

      if (isNaN(rawLat)) rawLat = regionDefaults.lat + (Math.random() - 0.5) * 0.05; // safe regional mock jitter
      if (isNaN(rawLng)) rawLng = regionDefaults.lng + (Math.random() - 0.5) * 0.05;

      const { errors, isValid } = validateRowData(rawName, rawWhatsApp, rawAddress, rawLat, rawLng);

      return {
        id: `imp_${Date.now()}_${index}_${Math.floor(Math.random() * 10000)}`,
        originalIndex: index,
        clientName: rawName.toString().trim(),
        clientWhatsApp: rawWhatsApp.toString().trim(),
        address: rawAddress.toString().trim(),
        lat: rawLat,
        lng: rawLng,
        errors,
        isValid
      };
    });

    setValidatedRows(validated);
    setStep('editing');
  };

  // Live client-side edits directly inside validation grid
  const handleCellEdit = (rowId: string, field: 'clientName' | 'clientWhatsApp' | 'address' | 'lat' | 'lng', val: string) => {
    setValidatedRows(prev => prev.map(row => {
      if (row.id !== rowId) return row;

      const updatedRow = { ...row };
      if (field === 'lat' || field === 'lng') {
        const parsedNum = parseFloat(val);
        updatedRow[field] = isNaN(parsedNum) ? 0 : parsedNum;
      } else {
        updatedRow[field] = val;
      }

      // Re-validate immediately on keystroke or change
      const { errors, isValid } = validateRowData(
        updatedRow.clientName,
        updatedRow.clientWhatsApp,
        updatedRow.address,
        updatedRow.lat,
        updatedRow.lng
      );

      updatedRow.errors = errors;
      updatedRow.isValid = isValid;

      return updatedRow;
    }));
  };

  // Remove a row from spreadsheet preview altogether
  const handleDeleteRow = (rowId: string) => {
    setValidatedRows(prev => prev.filter(r => r.id !== rowId));
  };

  // Final Action: Send to parent dispatcher to include in current route creation
  const handleFinalizeImport = () => {
    // Check if there are critical errors
    const criticalErrorRows = validatedRows.filter(r => {
      const hasCritical = r.errors.clientName || r.errors.address;
      return hasCritical;
    });

    if (criticalErrorRows.length > 0) {
      if (!window.confirm(`Você possui ${criticalErrorRows.length} clientes com erros críticos (Nome ou Endereço vazios). Deseja descartar estas linhas e importar apenas os válidos?`)) {
        return;
      }
    }

    const acceptedRows = validatedRows.filter(r => !r.errors.clientName && !r.errors.address);
    if (acceptedRows.length === 0) {
      alert('Nenhum cliente válido para importar.');
      return;
    }

    const stopsToImport: Parada[] = acceptedRows.map((r, index) => {
      // format clean PT-BR whatsapp format 55 + DDD + numeric digits
      let cleanWhatsApp = r.clientWhatsApp.replace(/\D/g, '');
      if (cleanWhatsApp && !cleanWhatsApp.startsWith('55')) {
        if (cleanWhatsApp.length === 11 || cleanWhatsApp.length === 10) {
          cleanWhatsApp = '55' + cleanWhatsApp;
        }
      }
      if (!cleanWhatsApp) {
        cleanWhatsApp = '5533991234567'; // fallback mock
      }

      return {
        id: `stop_imported_${Date.now()}_${index}_${Math.floor(Math.random() * 100000)}`,
        clientName: r.clientName,
        clientWhatsApp: cleanWhatsApp,
        address: r.address,
        lat: r.lat,
        lng: r.lng,
        status: 'pending' as const
      };
    });

    onImportStops(stopsToImport);
    
    // Success feedback and reset
    alert(`Sucesso! ${stopsToImport.length} paradas foram importadas com sucesso para a fila de planejamento.`);
    setStep('upload');
    setRawRows([]);
    setFileName('');
  };

  // Filtering list based on search/validation status
  const filteredRows = validatedRows.filter(row => {
    const matchesSearch = 
      row.clientName.toLowerCase().includes(searchQuery.toLowerCase()) || 
      row.address.toLowerCase().includes(searchQuery.toLowerCase()) || 
      row.clientWhatsApp.includes(searchQuery);

    if (!matchesSearch) return false;

    if (filterType === 'errors') return Object.keys(row.errors).length > 0;
    if (filterType === 'valid') return Object.keys(row.errors).length === 0;
    return true;
  });

  const totalErrorsCount = validatedRows.filter(r => Object.keys(r.errors).length > 0).length;
  const totalValidCount = validatedRows.length - totalErrorsCount;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-lg mt-4 overflow-hidden">
      
      {/* Importer Section Title Bar with micro animation */}
      <div className="bg-gradient-to-r from-indigo-700 to-blue-800 text-white p-4.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <FileSpreadsheet className="w-5.5 h-5.5 text-indigo-200 animate-pulse" />
          <div>
            <h3 className="font-extrabold text-[12px] uppercase tracking-wider font-mono">
              Importar Portfólio de Clientes (Excel / CSV)
            </h3>
            <p className="text-[10px] text-slate-205">Região Ativa do Gestor: <strong className="text-white uppercase font-bold">{currentRegion}</strong></p>
          </div>
        </div>
        
        {fileName && (
          <div className="bg-indigo-900/40 border border-indigo-400/30 px-3 py-1 rounded-full text-[10px] font-mono flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            {fileName}
          </div>
        )}
      </div>

      <div className="p-5">
        
        {/* STEP 1: FILE DRAG AND DROP UPLOADER */}
        {step === 'upload' && (
          <div 
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
              dragActive 
                ? 'border-indigo-600 bg-indigo-50/40 scale-[0.99] shadow-inner' 
                : 'border-slate-250 bg-slate-50 hover:bg-slate-100/50'
            }`}
          >
            <Upload className="w-12 h-12 text-indigo-400 mx-auto mb-3 animate-bounce" style={{ animationDuration: '3s' }} />
            <span className="text-slate-800 font-extrabold text-xs block uppercase tracking-wide">
              Arraste e solte sua planilha logística de clientes
            </span>
            <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto leading-normal">
              Suporta planilhas do Microsoft Excel (.xlsx, .xls) ou registros texto separados por vírgula (.csv, .txt, .json).
            </p>

            <div className="mt-4 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="py-2 px-4.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-xl transition-all cursor-pointer shadow-sm shadow-indigo-950/25 active:scale-95 flex items-center gap-1"
              >
                <FileText className="w-3.5 h-3.5" /> Selecionar do Dispositivo
              </button>
              
              <input 
                ref={fileInputRef}
                type="file" 
                accept=".csv,.xlsx,.xls,.txt,.json" 
                onChange={handleFileChange}
                className="hidden" 
              />
            </div>

            {/* Simulated instructions or tips */}
            <div className="mt-6 pt-5 border-t border-slate-200/60 max-w-md mx-auto grid grid-cols-2 gap-3 text-left text-[10px] text-slate-500 leading-normal">
              <div>
                <strong className="text-slate-700 font-bold block mb-0.5">💡 Formato Ideal (Excel):</strong>
                Primeira linha deve conter os cabeçalhos das colunas (Ex: Clinte, Endereço, Fone, Lat, Lng).
              </div>
              <div>
                <strong className="text-slate-700 font-bold block mb-0.5">🌐 Geocódigo fallback:</strong>
                Se não houver colunas do GPS, geramos distribuição estatística na região {currentRegion}.
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: FIELD COLUMN MAPPING WIZARD */}
        {step === 'mapping' && (
          <div className="space-y-4 animate-fade-in">
            <div className="bg-indigo-50 border border-indigo-100 p-3.5 rounded-xl text-[11px] text-indigo-900 leading-normal flex items-start gap-2.5">
              <Sparkles className="w-5 h-5 text-indigo-650 shrink-0 mt-0.5" />
              <div>
                <strong className="font-extrabold uppercase text-[10px] text-indigo-950 block">Mapeamento Inteligente Realizado</strong>
                O RouteLog identificou <strong className="text-indigo-950 font-bold">{rawRows.length} linhas</strong> de dados. Associe abaixo quais colunas correspondem às propriedades exigidas pela rota de despacho.
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 bg-slate-50 p-4.5 border border-slate-200 rounded-2xl">
              
              {/* Mapping Name */}
              <div>
                <label className="block text-slate-800 font-extrabold uppercase text-[9px] tracking-wide mb-1 flex items-center justify-between">
                  <span>Nome do Cliente <strong className="text-red-550 leading-none">*</strong></span>
                  <span className="text-[10px] text-indigo-600 font-mono font-bold">Client Name</span>
                </label>
                <select
                  value={mappings.clientName}
                  onChange={e => setMappings(prev => ({ ...prev, clientName: e.target.value }))}
                  className="w-full border border-slate-205 focus:ring-2 focus:ring-indigo-500 focus:outline-none rounded-xl p-2.5 bg-white text-slate-805 text-xs font-semibold cursor-pointer shadow-xs"
                >
                  <option value="">Selecione a coluna...</option>
                  {headers.map(h => (
                    <option key={h} value={h}>Header: "{h}"</option>
                  ))}
                </select>
              </div>

              {/* Mapping Address */}
              <div>
                <label className="block text-slate-800 font-extrabold uppercase text-[9px] tracking-wide mb-1 flex items-center justify-between">
                  <span>Endereço Completo <strong className="text-red-550 leading-none">*</strong></span>
                  <span className="text-[10px] text-indigo-600 font-mono font-bold">Delivery Address</span>
                </label>
                <select
                  value={mappings.address}
                  onChange={e => setMappings(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full border border-slate-205 focus:ring-2 focus:ring-indigo-500 focus:outline-none rounded-xl p-2.5 bg-white text-slate-805 text-xs font-semibold cursor-pointer shadow-xs"
                >
                  <option value="">Selecione a coluna...</option>
                  {headers.map(h => (
                    <option key={h} value={h}>Header: "{h}"</option>
                  ))}
                </select>
              </div>

              {/* Mapping WhatsApp */}
              <div>
                <label className="block text-slate-700 font-bold uppercase text-[9px] tracking-wide mb-1 flex items-center justify-between">
                  <span>Contato WhatsApp</span>
                  <span className="text-[10px] text-slate-400 font-mono font-bold">WhatsApp / Tel</span>
                </label>
                <select
                  value={mappings.clientWhatsApp}
                  onChange={e => setMappings(prev => ({ ...prev, clientWhatsApp: e.target.value }))}
                  className="w-full border border-slate-205 focus:ring-2 focus:ring-indigo-500 focus:outline-none rounded-xl p-2.5 bg-white text-slate-805 text-xs font-semibold cursor-pointer shadow-xs"
                >
                  <option value="">(Opcional) Ignorar ou selecione...</option>
                  {headers.map(h => (
                    <option key={h} value={h}>Header: "{h}"</option>
                  ))}
                </select>
              </div>

              {/* Mapping latitude */}
              <div>
                <label className="block text-slate-700 font-bold uppercase text-[9px] tracking-wide mb-1 flex items-center justify-between">
                  <span>Coordenada Y (Lat)</span>
                  <span className="text-[10px] text-slate-400 font-mono font-bold">Latitude</span>
                </label>
                <select
                  value={mappings.lat}
                  onChange={e => setMappings(prev => ({ ...prev, lat: e.target.value }))}
                  className="w-full border border-slate-205 focus:ring-2 focus:ring-indigo-500 focus:outline-none rounded-xl p-2.5 bg-white text-slate-805 text-xs font-semibold cursor-pointer shadow-xs"
                >
                  <option value="">(Opcional) Gerar Jitter Regional...</option>
                  {headers.map(h => (
                    <option key={h} value={h}>Header: "{h}"</option>
                  ))}
                </select>
              </div>

              {/* Mapping longitude */}
              <div>
                <label className="block text-slate-700 font-bold uppercase text-[9px] tracking-wide mb-1 flex items-center justify-between">
                  <span>Coordenada X (Lng)</span>
                  <span className="text-[10px] text-slate-400 font-mono font-bold">Longitude</span>
                </label>
                <select
                  value={mappings.lng}
                  onChange={e => setMappings(prev => ({ ...prev, lng: e.target.value }))}
                  className="w-full border border-slate-205 focus:ring-2 focus:ring-indigo-500 focus:outline-none rounded-xl p-2.5 bg-white text-slate-805 text-xs font-semibold cursor-pointer shadow-xs"
                >
                  <option value="">(Opcional) Gerar Jitter Regional...</option>
                  {headers.map(h => (
                    <option key={h} value={h}>Header: "{h}"</option>
                  ))}
                </select>
              </div>

              {/* Auto Action Info */}
              <div className="flex flex-col justify-end">
                <p className="text-[10px] text-slate-500 italic leading-snug pb-1.5">
                  🛡️ Registros com nomes errôneos ou vazios serão assinalados no painel de auditoria no próximo passo.
                </p>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2.5 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="py-2 px-4 border border-slate-250 text-slate-650 font-bold rounded-xl text-center cursor-pointer text-xs hover:bg-slate-50 transition-all ml-0.5"
              >
                Voltar
              </button>

              <button
                type="button"
                onClick={handleApplyMappings}
                className="py-2 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-center cursor-pointer text-xs shadow-md transition-all active:scale-[0.98] flex items-center gap-1"
              >
                Processar Dados & Validar <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: INTERACTIVE EDITING GRID & COLUMN VALIDATION FILTERS */}
        {step === 'editing' && (
          <div className="space-y-4 animate-fade-in select-text">
            
            {/* Filter Dashboard Stats HUD */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-xs">
                <span className="text-[9px] text-slate-500 font-mono font-bold uppercase tracking-wider block">Registros Totais</span>
                <strong className="text-lg font-black text-slate-900 block mt-0.5">{validatedRows.length}</strong>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 shadow-xs">
                <span className="text-[9px] text-emerald-700 font-mono font-bold uppercase tracking-wider block">Aprovados (Completo)</span>
                <strong className="text-lg font-black text-emerald-800 flex items-center gap-1 mt-0.5">
                  {totalValidCount} <CheckCircle className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                </strong>
              </div>
              <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 shadow-xs">
                <span className="text-[9px] text-rose-700 font-mono font-bold uppercase tracking-wider block">Linhas com Alertas</span>
                <strong className="text-lg font-black text-rose-800 flex items-center gap-1 mt-0.5">
                  {totalErrorsCount} {totalErrorsCount > 0 && <AlertTriangle className="w-4.5 h-4.5 text-rose-600 shrink-0 animate-bounce" />}
                </strong>
              </div>
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 shadow-xs">
                <span className="text-[9px] text-indigo-700 font-mono font-bold uppercase tracking-wider block">Região Destinada</span>
                <strong className="text-xs uppercase font-extrabold text-indigo-900 block mt-1.5">{currentRegion} Fleet Hub</strong>
              </div>
            </div>

            {/* Live Search & Toolbar filters */}
            <div className="flex flex-col sm:flex-row gap-2 justify-between items-stretch sm:items-center py-1">
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setFilterType('all')}
                  className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all border outline-none cursor-pointer flex items-center gap-1 ${
                    filterType === 'all'
                      ? 'bg-slate-900 text-white border-slate-950'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Filter className="w-3 h-3" /> Todos os Registros ({validatedRows.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('errors')}
                  className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all border outline-none cursor-pointer flex items-center gap-1 ${
                    filterType === 'errors'
                      ? 'bg-rose-700 text-white border-rose-800'
                      : 'bg-white text-rose-600 border-slate-200 hover:border-rose-200 hover:bg-rose-50/50'
                  }`}
                >
                  <AlertTriangle className="w-3 h-3 text-rose-500" /> Apenas com Alertas ({totalErrorsCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('valid')}
                  className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all border outline-none cursor-pointer flex items-center gap-1 ${
                    filterType === 'valid'
                      ? 'bg-emerald-600 text-white border-emerald-700'
                      : 'bg-white text-emerald-600 border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/50'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" /> Aprovados ({totalValidCount})
                </button>
              </div>

              {/* Dynamic search inside list */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Pesquisar registros..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full sm:w-56 pl-8 pr-3 py-1.5 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded-xl text-xs bg-white text-slate-800"
                />
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
              </div>
            </div>

            {/* Spreadsheet interactive data grid table */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs bg-white">
              <div className="overflow-x-auto max-h-[380px]">
                <table className="w-full border-collapse text-left text-xs min-w-[700px]">
                  
                  {/* Table Header Row */}
                  <thead className="bg-slate-100/90 text-slate-800 uppercase text-[9px] tracking-wider font-mono font-extrabold sticky top-0 border-b border-slate-200 z-10">
                    <tr>
                      <th className="py-3 px-3 text-center w-12">Seq</th>
                      <th className="py-3 px-3">Status / Alertas</th>
                      <th className="py-3 px-3">Nome do Cliente <span className="text-red-500 font-bold">*</span></th>
                      <th className="py-3 px-3">WhatsApp / Contato</th>
                      <th className="py-3 px-3">Endereço de Entrega <span className="text-red-500 font-bold">*</span></th>
                      <th className="py-3 px-2 w-20">Latitude</th>
                      <th className="py-3 px-2 w-20">Longitude</th>
                      <th className="py-3 px-3 text-center w-12">Ação</th>
                    </tr>
                  </thead>

                  {/* Table Body Rows */}
                  <tbody className="divide-y divide-slate-150 text-[11.5px] font-sans">
                    {filteredRows.map((row, idx) => {
                      const hasErr = Object.keys(row.errors).length > 0;
                      return (
                        <tr 
                          key={row.id} 
                          className={`transition-colors leading-relaxed ${
                            hasErr ? 'bg-red-50/15 hover:bg-slate-50' : 'hover:bg-slate-50'
                          }`}
                        >
                          {/* sequence index */}
                          <td className="py-2 px-3 text-center text-slate-400 font-mono font-extrabold border-r border-slate-100">
                            {idx + 1}
                          </td>

                          {/* validation alarms */}
                          <td className="py-2 px-3 min-w-[150px] border-r border-slate-100">
                            {hasErr ? (
                              <div className="space-y-1">
                                {Object.entries(row.errors).map(([field, txt]) => (
                                  <div key={field} className="text-[10px] text-rose-700 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded flex items-center gap-1 font-sans">
                                    <AlertTriangle className="w-3 h-3 text-rose-500 shrink-0" />
                                    <span className="truncate" title={txt}>{txt}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full inline-flex items-center gap-1 font-bold">
                                <Check className="w-3 h-3 text-emerald-600" /> Consistente
                              </span>
                            )}
                          </td>

                          {/* Client Name Input Edit */}
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={row.clientName}
                              onChange={e => handleCellEdit(row.id, 'clientName', e.target.value)}
                              className={`w-full px-2 py-1 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs text-slate-800 ${
                                row.errors.clientName ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200'
                              }`}
                            />
                          </td>

                          {/* WhatsApp Input Edit */}
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={row.clientWhatsApp}
                              onChange={e => handleCellEdit(row.id, 'clientWhatsApp', e.target.value)}
                              placeholder="55..."
                              className={`w-full px-2 py-1 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-mono text-slate-800 ${
                                row.errors.clientWhatsApp ? 'border-amber-300 bg-amber-50/10' : 'border-slate-200'
                              }`}
                            />
                          </td>

                          {/* Delivery Address Input Edit */}
                          <td className="py-2 px-3">
                            <textarea
                              value={row.address}
                              onChange={e => handleCellEdit(row.id, 'address', e.target.value)}
                              rows={1}
                              className={`w-full px-2 py-1 border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs text-slate-800 resize-none ${
                                row.errors.address ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200'
                              }`}
                            />
                          </td>

                          {/* Lat coordinate Edit */}
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              value={row.lat}
                              onChange={e => handleCellEdit(row.id, 'lat', e.target.value)}
                              className="w-full px-1.5 py-1 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-550"
                            />
                          </td>

                          {/* Lng coordinate Edit */}
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              value={row.lng}
                              onChange={e => handleCellEdit(row.id, 'lng', e.target.value)}
                              className="w-full px-1.5 py-1 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-550"
                            />
                          </td>

                          {/* Delete Item Action */}
                          <td className="py-2 px-3 text-center border-l border-slate-100">
                            <button
                              type="button"
                              onClick={() => handleDeleteRow(row.id)}
                              className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-all cursor-pointer inline-flex active:scale-90"
                              title="Remover linha"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    {filteredRows.length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-450 italic font-mono font-medium">
                          Nenhum registro correspondente aos filtros de pesquisa atuais.
                        </td>
                      </tr>
                    )}
                  </tbody>

                </table>
              </div>
            </div>

            {/* Quick helper note */}
            <p className="text-[10px] text-slate-500 mt-1 leading-normal">
              💡 <strong className="text-slate-700">Dica:</strong> Você pode ajustar diretamente o nome, telefone ou endereço nas células da tabela. O RouteLog reanalisará instantaneamente a consistência das rotas e salvará as correções na importação final.
            </p>

            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep('mapping')}
                className="py-2 px-4 border border-slate-250 text-slate-650 font-bold rounded-xl text-center cursor-pointer text-xs hover:bg-slate-50 transition-all flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Voltar ao Mapeamento
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Deseja cancelar o processo atual? Todos os dados não importados serão perdidos.')) {
                      setStep('upload');
                      setRawRows([]);
                      setFileName('');
                    }
                  }}
                  className="py-2 px-3.5 text-slate-500 hover:text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Cancelar processo
                </button>

                <button
                  type="button"
                  onClick={handleFinalizeImport}
                  className="py-2.5 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-center cursor-pointer text-xs shadow-md transition-all active:scale-[0.98] flex items-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4 text-emerald-100" />
                  Consolidar {totalValidCount} Clientes Importados
                </button>
              </div>
            </div>

          </div>
        )}

      </div>

    </div>
  );
}
