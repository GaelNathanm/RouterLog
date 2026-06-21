import React, { useState } from 'react';
import { 
  Users, Search, Plus, FileSpreadsheet, Download, Trash2, Phone, 
  X, Check, AlertTriangle, HelpCircle, Edit3, ShieldAlert 
} from 'lucide-react';
import { Cliente } from '../types';

interface ClienteManagerProps {
  region: string;
  clients: Cliente[];
  onSaveClient: (client: Cliente) => void;
  onDeleteClient: (clientId: string) => void;
  onAddSelectedToRoute: (selectedClients: Cliente[]) => void;
  setIsImporterOpen: (open: boolean) => void;
  gOriginLat: number;
  gOriginLng: number;
}

export default function ClienteManager({
  region,
  clients = [],
  onSaveClient,
  onDeleteClient,
  onAddSelectedToRoute,
  setIsImporterOpen,
  gOriginLat,
  gOriginLng
}: ClienteManagerProps) {
  const [clientsSearch, setClientsSearch] = useState('');
  const [checkedClientIds, setCheckedClientIds] = useState<string[]>([]);

  // Modals status
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  // States for CRUD forms
  const [editingClient, setEditingClient] = useState<Cliente | null>(null);
  const [formName, setFormName] = useState('');
  const [formWhatsApp, setFormWhatsApp] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formLat, setFormLat] = useState<number>(gOriginLat);
  const [formLng, setFormLng] = useState<number>(gOriginLng);
  const [formStatus, setFormStatus] = useState<string>('active');
  const [addressPredictions, setAddressPredictions] = useState<{ description: string; placeId: string }[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  // Deletion confirm queue
  const [clientToDelete, setClientToDelete] = useState<Cliente | null>(null);

  // Regional Filter
  const regionalClients = clients.filter(c => c.region === region);

  // Filter with Search Input
  const filteredClients = regionalClients.filter(c => {
    if (!clientsSearch) return true;
    const term = clientsSearch.toLowerCase().trim();
    return (
      c.name.toLowerCase().includes(term) || 
      c.address.toLowerCase().includes(term) ||
      (c.whatsApp && c.whatsApp.toLowerCase().includes(term))
    );
  });

  // Predictions for form address
  const fetchAddressPredictions = (inputStr: string) => {
    if (!inputStr || inputStr.trim().length < 3) {
      setAddressPredictions([]);
      return;
    }
    if (
      typeof window !== 'undefined' && 
      (window as any).google && 
      (window as any).google.maps && 
      (window as any).google.maps.places
    ) {
      try {
        const service = new (window as any).google.maps.places.AutocompleteService();
        service.getPlacePredictions(
          { input: inputStr, componentRestrictions: { country: 'br' } },
          (predictions: any, status: any) => {
            if (status === 'OK' && predictions) {
              setAddressPredictions(
                predictions.map((p: any) => ({
                  description: p.description,
                  placeId: p.place_id,
                }))
              );
            } else {
              setAddressPredictions([]);
            }
          }
        );
      } catch (e) {
        console.warn('AutoComplete predictions fetch failed:', e);
      }
    }
  };

  const handleSelectPrediction = (address: string, placeId: string) => {
    setFormAddress(address);
    setAddressPredictions([]);
    setIsValidating(true);
    if (
      typeof window !== 'undefined' && 
      (window as any).google && 
      (window as any).google.maps
    ) {
      try {
        const geocoder = new (window as any).google.maps.Geocoder();
        geocoder.geocode({ placeId }, (results: any, status: any) => {
          setIsValidating(false);
          if (status === 'OK' && results && results[0]) {
            const loc = results[0].geometry.location;
            setFormLat(loc.lat());
            setFormLng(loc.lng());
          }
        });
      } catch (err) {
        setIsValidating(false);
        console.warn('Geocoder failed to resolve place ID:', err);
      }
    } else {
      setIsValidating(false);
    }
  };

  const handleOpenAddClient = () => {
    setEditingClient(null);
    setFormName('');
    setFormWhatsApp('');
    setFormAddress('');
    setFormLat(gOriginLat);
    setFormLng(gOriginLng);
    setFormStatus('active');
    setAddressPredictions([]);
    setIsFormOpen(true);
  };

  const handleOpenEditClient = (cli: Cliente) => {
    setEditingClient(cli);
    setFormName(cli.name);
    setFormWhatsApp(cli.whatsApp);
    setFormAddress(cli.address);
    setFormLat(cli.lat);
    setFormLng(cli.lng);
    setFormStatus(cli.status || 'active');
    setAddressPredictions([]);
    setIsFormOpen(true);
  };

  const handleSaveClientForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formAddress.trim()) {
      alert('Favor preencher o Nome e Endereço do Cliente.');
      return;
    }

    const cleanPhone = formWhatsApp.replace(/\D/g, '');

    const clientData: Cliente = {
      id: editingClient ? editingClient.id : `cli_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: formName,
      whatsApp: cleanPhone || '5533991234567',
      address: formAddress,
      lat: formLat,
      lng: formLng,
      region,
      createdAt: editingClient ? editingClient.createdAt : new Date().toISOString(),
      status: formStatus
    };

    onSaveClient(clientData);
    setIsFormOpen(false);
    setEditingClient(null);
    setFormName('');
    setFormWhatsApp('');
    setFormAddress('');
  };

  const triggerDeleteConfirm = (cli: Cliente) => {
    setClientToDelete(cli);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDeleteClient = () => {
    if (clientToDelete) {
      onDeleteClient(clientToDelete.id);
      setCheckedClientIds(prev => prev.filter(id => id !== clientToDelete.id));
      setIsDeleteConfirmOpen(false);
      setClientToDelete(null);
    }
  };

  const handleCreateRouteFromSelected = () => {
    if (checkedClientIds.length === 0) {
      alert('Selecione pelo menos um cliente no banco de dados para criar rota.');
      return;
    }
    const selected = clients.filter(c => checkedClientIds.includes(c.id));
    onAddSelectedToRoute(selected);
    setCheckedClientIds([]);
  };

  const handleExportClientsCSV = () => {
    if (regionalClients.length === 0) {
      alert('Nenhum cliente cadastrado nesta região para exportar.');
      return;
    }

    const headers = ['ID', 'Nome', 'WhatsApp', 'Endereco', 'Lat', 'Lng', 'Status', 'Regiao', 'CriadoEm'];
    const rows = regionalClients.map(c => [
      c.id,
      `"${c.name.replace(/"/g, '""')}"`,
      c.whatsApp,
      `"${c.address.replace(/"/g, '""')}"`,
      c.lat,
      c.lng,
      c.status || 'active',
      c.region,
      c.createdAt
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `banco_clientes_${region}_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Status Badge styling helper
  const getStatusBadge = (status: string = 'active') => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-505 bg-emerald-600"></span>
            Ativo
          </span>
        );
      case 'inactive':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500 border border-slate-205 uppercase tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
            Inativo
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Pendente
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-550 bg-indigo-600"></span>
            Geral
          </span>
        );
    }
  };

  return (
    <div id="cliente-manager-container" className="space-y-4 animate-[fadeIn_0.2s_ease-out] font-sans">
      
      {/* Action Bar Tools */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            id="search-input-cm"
            type="text"
            placeholder="Buscar nome, telefone ou endereço..."
            value={clientsSearch}
            onChange={e => setClientsSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-xl bg-white text-slate-750 text-xs font-semibold shadow-sm"
          />
        </div>

        <div className="flex flex-wrap gap-2 justify-end w-full sm:w-auto">
          {checkedClientIds.length > 0 && (
            <button
              id="cm-create-route-selected"
              type="button"
              onClick={handleCreateRouteFromSelected}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold px-3.5 py-2.5 rounded-xl shadow-sm cursor-pointer transition-all active:scale-95 flex items-center gap-1.5 animate-pulse"
            >
              🚚 Criar Rota ({checkedClientIds.length} Clientes)
            </button>
          )}

          <button
            id="cm-add-manual"
            type="button"
            onClick={handleOpenAddClient}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-sm cursor-pointer transition-all active:scale-95 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Novo Manual
          </button>

          <button
            id="cm-import-sheet"
            type="button"
            onClick={() => setIsImporterOpen(true)}
            className="bg-white hover:bg-slate-50 text-slate-750 border border-slate-350 text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-sm cursor-pointer transition-all active:scale-95 flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Importar Planilha
          </button>

          <button
            id="cm-export-csv"
            type="button"
            onClick={handleExportClientsCSV}
            className="bg-white hover:bg-slate-50 text-slate-750 border border-slate-350 text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-sm cursor-pointer transition-all active:scale-95 flex items-center gap-1.5"
          >
            <Download className="w-4 h-4 text-slate-500" /> Exportar CSV
          </button>
        </div>
      </div>

      {/* Datatable Grid */}
      {regionalClients.length > 0 ? (
        <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-sm bg-white">
          <table className="w-full text-left border-collapse" id="cm-datatable">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-205 text-[10px] text-slate-500 font-extrabold uppercase font-mono tracking-wider select-none">
                <th className="p-3.5 w-10 text-center">
                  <input
                    id="cm-check-all"
                    type="checkbox"
                    checked={
                      filteredClients.length > 0 &&
                      filteredClients.every(c => checkedClientIds.includes(c.id))
                    }
                    onChange={e => {
                      if (e.target.checked) {
                        setCheckedClientIds(prev => {
                          const otherIds = prev.filter(id => !filteredClients.some(fc => fc.id === id));
                          return [...otherIds, ...filteredClients.map(c => c.id)];
                        });
                      } else {
                        setCheckedClientIds(prev => prev.filter(id => !filteredClients.some(fc => fc.id === id)));
                      }
                    }}
                    className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer h-4 w-4"
                  />
                </th>
                <th className="p-3.5">Cliente</th>
                <th className="p-3.5">Endereço de Carga/Entrega</th>
                <th className="p-3.5 text-center">WhatsApp / Contato</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-center font-mono">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 text-[11.5px] text-slate-700">
              {filteredClients.map(cli => (
                <tr key={cli.id} className="hover:bg-slate-50/60 transition-colors font-medium">
                  <td className="p-3.5 text-center">
                    <input
                      name={`cm-check-${cli.id}`}
                      type="checkbox"
                      checked={checkedClientIds.includes(cli.id)}
                      onChange={e => {
                        if (e.target.checked) {
                          setCheckedClientIds(prev => [...prev, cli.id]);
                        } else {
                          setCheckedClientIds(prev => prev.filter(id => id !== cli.id));
                        }
                      }}
                      className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer h-4 w-4"
                    />
                  </td>
                  <td className="p-3.5">
                    <div>
                      <div className="font-extrabold text-slate-850 text-xs">{cli.name}</div>
                      <div className="text-[9px] text-slate-400 font-mono mt-0.5">ID: {cli.id}</div>
                    </div>
                  </td>
                  <td className="p-3.5">
                    <div>
                      <div className="text-slate-700 font-sans max-w-xs sm:max-w-md truncate font-semibold" title={cli.address}>
                        {cli.address}
                      </div>
                      <div className="text-[9px] text-indigo-600 font-mono mt-0.5 font-bold">
                        COORDENADAS: {cli.lat.toFixed(6)}, {cli.lng.toFixed(6)}
                      </div>
                    </div>
                  </td>
                  <td className="p-3.5 text-center">
                    {cli.whatsApp ? (
                      <a
                        href={`https://wa.me/${cli.whatsApp}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-slate-750 hover:text-emerald-700 hover:underline bg-slate-50 hover:bg-emerald-50 border border-slate-205 hover:border-emerald-250 px-2.5 py-1 rounded-xl transition-all"
                      >
                        <Phone className="w-3.5 h-3.5 text-emerald-650 shrink-0" /> {cli.whatsApp}
                      </a>
                    ) : (
                      <span className="text-slate-350 italic">Não Informado</span>
                    )}
                  </td>
                  <td className="p-3.5 text-center">
                    {getStatusBadge(cli.status)}
                  </td>
                  <td className="p-3.5">
                    <div className="flex gap-1.5 justify-center">
                      <button
                        name={`cm-edit-${cli.id}`}
                        type="button"
                        onClick={() => handleOpenEditClient(cli)}
                        className="text-indigo-650 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 p-1.5 px-3 rounded-lg font-bold text-[10px] transition-colors uppercase font-mono border border-indigo-100 flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" /> Editar
                      </button>
                      <button
                        name={`cm-delete-${cli.id}`}
                        type="button"
                        onClick={() => triggerDeleteConfirm(cli)}
                        className="text-rose-655 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 p-1.5 px-3 rounded-lg font-bold text-[10px] transition-colors uppercase font-mono border border-rose-100 flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" /> Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredClients.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400 font-medium">
                    🔍 Nenhum cliente atende ao critério de busca.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-10 bg-slate-50 border border-dashed border-slate-300 rounded-2xl p-6">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-xs font-bold text-slate-705">Ainda não há clientes cadastrados na região {region}.</p>
          <p className="text-[10px] text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
            Cadastre novos clientes na planilha do terminal ou use a carga de arquivos Excel para criar rotas permanentes.
          </p>
          <div className="mt-4 flex gap-2 justify-center">
            <button
              type="button"
              onClick={() => setIsImporterOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] px-4 py-2 rounded-xl shadow cursor-pointer transition-all active:scale-[0.98]"
            >
              📤 Importar Base de Clientes (Excel/Spreadsheet)
            </button>
            <button
              type="button"
              onClick={handleOpenAddClient}
              className="bg-white hover:bg-slate-100 text-slate-705 border border-slate-350 font-bold text-[11px] px-4 py-2 rounded-xl shadow-sm cursor-pointer transition-all active:scale-[0.98]"
            >
              ➕ Cadastrar Cliente Manual
            </button>
          </div>
        </div>
      )}

      {/* ADD/EDIT CLIENT MODAL */}
      {isFormOpen && (
        <div id="cm-client-form-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[9999] overflow-y-auto leading-normal">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                <h3 className="font-extrabold text-sm uppercase tracking-wider font-mono">
                  {editingClient ? '📝 Editar Cadastro de Cliente' : '➕ Novo Registro Manual'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="bg-slate-800 hover:bg-slate-700 p-1.5 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSaveClientForm} className="p-6 space-y-4">
              <div>
                <label className="block text-slate-500 font-bold uppercase text-[9px] tracking-wider mb-1">Nome Fantasia / Razão Social</label>
                <input
                  id="cm-form-name"
                  type="text"
                  required
                  placeholder="EX: Mercantil Central Ltda"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  className="w-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-550 rounded-xl p-2.5 text-xs font-semibold shadow-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-500 font-bold uppercase text-[9px] tracking-wider mb-1">WhatsApp de Contato</label>
                  <input
                    id="cm-form-whatsapp"
                    type="tel"
                    placeholder="EX: 5533991234567"
                    value={formWhatsApp}
                    onChange={e => setFormWhatsApp(e.target.value)}
                    className="w-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-550 rounded-xl p-2.5 text-xs font-semibold shadow-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-bold uppercase text-[9px] tracking-wider mb-1">Status Operacional</label>
                  <select
                    id="cm-form-status"
                    value={formStatus}
                    onChange={e => setFormStatus(e.target.value)}
                    className="w-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-550 rounded-xl p-2.5 text-xs font-bold shadow-xs bg-white cursor-pointer"
                  >
                    <option value="active">🟢 Ativo (Apto p/ Carga)</option>
                    <option value="inactive">🔴 Inativo (Bloqueado)</option>
                    <option value="pending">🟡 Pendente (Financeiro)</option>
                  </select>
                </div>
              </div>

              <div className="relative">
                <label className="block text-slate-500 font-bold uppercase text-[9px] tracking-wider mb-1">Endereço de Entrega</label>
                <input
                  id="cm-form-address"
                  type="text"
                  required
                  placeholder="Digite rua, número, bairro e cidade..."
                  value={formAddress}
                  onChange={e => {
                    setFormAddress(e.target.value);
                    fetchAddressPredictions(e.target.value);
                  }}
                  className="w-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-550 rounded-xl p-2.5 text-xs font-semibold shadow-xs"
                />
                {isValidating && (
                  <span className="text-[10px] text-amber-600 animate-pulse block mt-1 font-semibold">
                    Geocodificando endereço via Maps API...
                  </span>
                )}
                {addressPredictions.length > 0 && (
                  <div className="absolute z-50 w-full bg-white border border-slate-250 rounded-xl shadow-xl mt-1 max-h-36 overflow-y-auto leading-tight">
                    {addressPredictions.map((pred, pIdx) => (
                      <button
                        key={pIdx}
                        type="button"
                        onClick={() => handleSelectPrediction(pred.description, pred.placeId)}
                        className="w-full text-left p-2.5 hover:bg-slate-55 hover:bg-slate-50 border-b border-slate-100 text-[11px] font-semibold truncate text-slate-700"
                      >
                        📍 {pred.description}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-500">
                <div>
                  <span className="block font-semibold uppercase text-[8px] text-slate-400">LATITUDE</span>
                  <input
                    id="cm-form-lat"
                    type="number"
                    step="any"
                    value={formLat}
                    onChange={e => setFormLat(parseFloat(e.target.value) || 0)}
                    className="w-full bg-transparent border-0 p-0 m-0 focus:ring-0 text-slate-700 font-bold"
                  />
                </div>
                <div>
                  <span className="block font-semibold uppercase text-[8px] text-slate-400">LONGITUDE</span>
                  <input
                    id="cm-form-lng"
                    type="number"
                    step="any"
                    value={formLng}
                    onChange={e => setFormLng(parseFloat(e.target.value) || 0)}
                    className="w-full bg-transparent border-0 p-0 m-0 focus:ring-0 text-slate-700 font-bold"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 justify-end pt-3 border-t border-slate-100">
                <button
                  id="cm-form-cancel"
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 border border-slate-250 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  id="cm-form-save"
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  Salvar Cadastro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOM DELETE CONFIRMATION MODAL */}
      {isDeleteConfirmOpen && (
        <div id="cm-delete-confirm-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 z-[99999] overflow-y-auto leading-normal">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-150">
            {/* Modal Alert Header */}
            <div className="bg-rose-50 text-rose-700 px-5 py-4 border-b border-rose-150 flex items-center gap-3">
              <div className="bg-rose-100 p-2 rounded-xl text-rose-650 shrink-0">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
              </div>
              <h4 className="font-extrabold text-sm uppercase tracking-wider font-mono">
                Confirmar Remoção
              </h4>
            </div>

            {/* Modal Message */}
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed font-sans">
                Deseja realmente remover o cliente{' '}
                <strong className="text-slate-805 font-bold font-sans">
                  "{clientToDelete?.name}"
                </strong>{' '}
                permanentemente? Esta ação de exclusão atualizará o Banco de Dados Operacional e removerá o cadastro regional.
              </p>

              {/* Action Buttons */}
              <div className="flex gap-2 justify-end pt-2">
                <button
                  id="cm-delete-cancel"
                  type="button"
                  onClick={() => {
                    setIsDeleteConfirmOpen(false);
                    setClientToDelete(null);
                  }}
                  className="px-4 py-2 border border-slate-250 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  id="cm-delete-confirm"
                  type="button"
                  onClick={confirmDeleteClient}
                  className="px-4 py-2 bg-rose-605 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  Excluir Permanentemente
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
