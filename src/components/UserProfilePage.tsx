/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { RouteUser, UserRole } from '../types';
import { REGIONS_LIST } from '../data/mockData';
import { 
  User, Mail, Phone, MapPin, Award, Truck, Calendar, Save, CheckCircle2,
  Sliders, Bell, Palette, Sparkles, Smile, Info, HeartHandshake, ShieldCheck,
  Camera, Upload, Trash2, Image as ImageIcon
} from 'lucide-react';
import { motion } from 'motion/react';

interface UserProfilePageProps {
  user: RouteUser;
  onUpdateProfile: (updated: RouteUser) => Promise<void>;
}

export default function UserProfilePage({ user, onUpdateProfile }: UserProfilePageProps) {
  // Common states
  const [name, setName] = useState(user.name || '');
  const [email, setEmail] = useState(user.email || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [address, setAddress] = useState(user.address || '');
  const [region, setRegion] = useState((user as any).region || 'GV1');
  
  // Motorista specific states
  const [cnh, setCnh] = useState((user as any).cnh || '');
  const [cnhCategory, setCnhCategory] = useState((user as any).cnhCategory || 'D');
  const [cnhExpiration, setCnhExpiration] = useState((user as any).cnhExpiration || '2030-12-31');
  const [vehicleModel, setVehicleModel] = useState((user as any).vehicleModel || '');
  const [plate, setPlate] = useState((user as any).plate || '');

  // Personalized customization states (extend attributes as user customized options)
  const [bio, setBio] = useState((user as any).bio || 'Logística e Operações prioritárias!');
  const [photoUrl, setPhotoUrl] = useState(user.photoUrl || '');
  const [isDragging, setIsDragging] = useState(false);
  const [playNotificationSounds, setPlayNotificationSounds] = useState((user as any).playNotificationSounds !== false);
  const [allowTelemetryLogs, setAllowTelemetryLogs] = useState((user as any).allowTelemetryLogs !== false);

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN: return 'Administrador Geral';
      case UserRole.GERENTE: return 'Gerente Logística';
      case UserRole.MOTORISTA: return 'Motorista';
      case UserRole.VENDEDOR: return 'Vendedor Regional';
      default: return 'Colaborador';
    }
  };

  const getRoleBadgeStyles = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN: return 'bg-rose-50 text-rose-700 border-rose-200';
      case UserRole.GERENTE: return 'bg-blue-50 text-blue-700 border-blue-200';
      case UserRole.MOTORISTA: return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case UserRole.VENDEDOR: return 'bg-amber-50 text-amber-700 border-amber-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-250';
    }
  };

  const currentThemeHex = () => {
    return 'bg-indigo-600 hover:bg-indigo-700 ring-indigo-500/20';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Por favor, selecione um arquivo de imagem válido.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Por favor, selecione um arquivo de imagem válido.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoUrl('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSaveSuccess(false);

    if (!name.trim()) {
      setErrorMessage('O nome não pode ficar em branco.');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Por favor, informe um e-mail válido.');
      return;
    }

    setIsSaving(true);

    const updatedData: RouteUser = {
      ...user,
      name,
      email,
      phone,
      address,
      bio,
      photoUrl,
      playNotificationSounds,
      allowTelemetryLogs,
      ...(user.role === UserRole.GERENTE ? { region } : {}),
      ...(user.role === UserRole.VENDEDOR ? { region } : {}),
      ...(user.role === UserRole.MOTORISTA ? {
        region,
        cnh,
        cnhCategory,
        cnhExpiration,
        vehicleModel,
        plate
      } : {})
    } as any;

    try {
      await onUpdateProfile(updatedData);
      setSaveSuccess(true);
      
      // Auto dismiss success toast after 3.5s
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Houve um erro desconhecido ao salvar o perfil.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div id="editable-custom-profile-panel" className="w-full">
      
      {/* Page Header banner */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-3xl p-6 md:p-8 shadow-xl mb-6 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden select-none">
        
        {/* Background visual detail */}
        <div className="absolute right-0 top-0 bottom-0 opacity-10 pointer-events-none w-1/3 flex items-center justify-center font-mono select-none">
          <Camera className="w-40 h-40 transform rotate-12" />
        </div>

        <div className="flex flex-col md:flex-row items-center gap-5 relative z-10">
          
          {/* Main customized Avatar badge */}
          <div className="relative group">
            {photoUrl ? (
              <img 
                src={photoUrl} 
                alt="Foto de Perfil" 
                referrerPolicy="no-referrer"
                className="w-20 h-20 md:w-24 md:h-24 rounded-2xl object-cover border-2 border-white/30 shadow-inner transition-transform group-hover:scale-105 duration-300"
              />
            ) : (
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-white/10 backdrop-blur-md border-2 border-white/30 flex items-center justify-center text-indigo-250 shadow-inner transition-transform group-hover:scale-105 duration-300 select-none">
                <User className="w-10 h-10 md:w-12 md:h-12 text-slate-300" />
              </div>
            )}
            
            <div className="absolute -bottom-1 -right-1 bg-indigo-600 text-white border-2 border-slate-950 w-7 h-7 rounded-xl flex items-center justify-center text-xs shadow" title="Foto do Perfil">
              <Camera className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="text-center md:text-left">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
              <h1 className="text-xl md:text-2xl font-black tracking-tight">{name || 'Usuário'}</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black uppercase tracking-wider border backdrop-blur-md shrink-0 ${getRoleBadgeStyles(user.role)}`}>
                {getRoleLabel(user.role)}
              </span>
            </div>
            
            <p className="text-indigo-200 mt-1.5 max-w-md font-medium text-xs leading-relaxed italic">
              &ldquo;{bio}&rdquo;
            </p>

            <div className="flex flex-wrap justify-center md:justify-start items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-300 mt-3 font-mono">
              <span className="flex items-center gap-1">
                <Mail className="w-3 h-3 text-indigo-400" />
                {email}
              </span>
              {(user as any).region && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-emerald-400" />
                  Região: <strong className="text-white">{(user as any).region}</strong>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Live Active Device Status Info badge */}
        <div className="bg-white/5 backdrop-blur-sm p-4 rounded-2xl border border-white/10 shrink-0 text-center md:text-right text-[11px] font-mono relative z-10 select-none min-w-[200px]">
          <div className="flex items-center gap-1.5 justify-center md:justify-end text-emerald-400 font-bold uppercase text-[9px] tracking-wider mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Sessão Sincronizada
          </div>
          <span className="text-slate-400">ID da Conta: </span>
          <span className="text-slate-200 font-bold">{user.id}</span>
          <br />
          <span className="text-slate-400">Criado em: </span>
          <span className="text-slate-200">{new Date(user.createdAt).toLocaleDateString('pt-BR')}</span>
        </div>
      </div>

      {/* Main Grid form Layout */}
      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans">
        
        {/* Row 1, Left and center panels: Form inputs */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Card 1: Informações Cadastrais */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2 pb-3.5 border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                <User className="w-4.5 h-4.5" />
              </div>
              <h2 className="font-extrabold text-slate-800 text-sm uppercase tracking-wide">Informações Gerais Cadastrais</h2>
            </div>

            {errorMessage && (
              <div className="p-3.5 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-xl flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="leading-relaxed font-semibold">{errorMessage}</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              
              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Nome do Usuário</label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-slate-400">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nome Completo"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-9 pr-3 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 font-medium text-slate-800"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Endereço de E-mail</label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-slate-400">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="exemplo@rotelog.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-9 pr-3 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 font-medium text-slate-800"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">WhatsApp / Telefone de Contato</label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-slate-400">
                    <Phone className="w-4 h-4" />
                  </span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(00) 00000-0000"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-9 pr-3 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 font-medium text-slate-800"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Endereço Físico</label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-slate-400">
                    <MapPin className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Cidade, UF ou Endereço Comercial"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-9 pr-3 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 font-medium text-slate-800"
                  />
                </div>
              </div>

              {/* Region update for logged in users (except general admin who can access all) */}
              {user.role !== UserRole.ADMIN && (
                <div className="col-span-full space-y-1.5">
                  <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Região Geográfica de Atuação</label>
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 font-medium text-slate-800"
                  >
                    {REGIONS_LIST.map((reg) => (
                      <option key={reg} value={reg}>Região Metropolitana: {reg}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-indigo-500 font-mono">Modificar a região altera automaticamente o escopo de visualização dos feeds operacionais.</p>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Driver specifics section (only active if role is user role motorista) */}
          {user.role === UserRole.MOTORISTA && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-sm space-y-5"
            >
              <div className="flex items-center gap-2 pb-3.5 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <Truck className="w-4.5 h-4.5" />
                </div>
                <h2 className="font-extrabold text-slate-800 text-sm uppercase tracking-wide">Ficha Técnica e Telemetria de Trânsito</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                
                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">CNH (Habilitação)</label>
                  <input
                    type="text"
                    value={cnh}
                    onChange={(e) => setCnh(e.target.value)}
                    placeholder="Número da Carteira"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 font-medium text-slate-800"
                  />
                </div>

                <div className="space-y-1.5 font-sans">
                  <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block block">Categoria da CNH</label>
                  <select
                    value={cnhCategory}
                    onChange={(e) => setCnhCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 font-medium text-slate-800"
                  >
                    <option value="A">Categoria A (Motocicleta)</option>
                    <option value="B">Categoria B (Carro de Passeio)</option>
                    <option value="C">Categoria C (Caminhão Leve)</option>
                    <option value="D">Categoria D (Carga Pesada / Ônibus)</option>
                    <option value="E">Categoria E (Combinação de Veículos)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Validade CNH</label>
                  <div className="relative">
                    <span className="absolute right-3 top-3 text-slate-400 pointer-events-none">
                      <Calendar className="w-4 h-4" />
                    </span>
                    <input
                      type="date"
                      value={cnhExpiration}
                      onChange={(e) => setCnhExpiration(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 font-medium text-slate-800 text-left"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 col-span-1 sm:col-span-2">
                  <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Modelo do Caminhão cadastrado</label>
                  <input
                    type="text"
                    value={vehicleModel}
                    onChange={(e) => setVehicleModel(e.target.value)}
                    placeholder="Ex: Mercedes-Benz Axor / Scania R14"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 font-medium text-slate-800"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Placa Registrada</label>
                  <input
                    type="text"
                    value={plate}
                    onChange={(e) => setPlate(e.target.value)}
                    placeholder="ABC-1234 / MERCOSUL"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 font-medium uppercase font-mono text-slate-800"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* Form Actions (Save Button) */}
          <div className="flex items-center justify-between bg-slate-100 p-4 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
              <ShieldCheck className="w-4 h-4 text-indigo-500" />
              Sua privacidade e credenciais estão protegidas pelo servidor
            </div>
            
            <button
              type="submit"
              disabled={isSaving}
              className={`py-3 px-6 rounded-xl font-bold text-white shrink-0 cursor-pointer shadow-md active:scale-95 transition-all text-xs uppercase tracking-wider flex items-center gap-2 ${currentThemeHex()} ${isSaving ? 'opacity-70 cursor-wait' : ''}`}
            >
              {isSaving ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin" />
                  Salvando dados...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Salvar Alterações
                </>
              )}
            </button>
          </div>

        </div>

        {/* Right sidebar column: custom profile photo and settings */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Profile Photo card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-5 text-xs text-slate-650">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                <Camera className="w-4.5 h-4.5" />
              </div>
              <h2 className="font-extrabold text-slate-800 text-sm uppercase tracking-wide">Foto do Perfil</h2>
            </div>

            {/* Photo upload dropzone */}
            <div className="space-y-3">
              <label className="text-[11px] text-slate-400 font-bold uppercase block tracking-wider">Imagem de Identificação</label>
              
              {photoUrl ? (
                <div className="relative rounded-2xl border border-slate-200 p-2 bg-slate-50 flex flex-col items-center">
                  <img 
                    src={photoUrl} 
                    alt="Previsão de Foto" 
                    referrerPolicy="no-referrer"
                    className="w-32 h-32 rounded-xl object-cover border border-slate-200 shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="mt-3 py-1.5 px-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold rounded-lg text-[10px] uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remover Imagem
                  </button>
                </div>
              ) : (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 ${
                    isDragging 
                      ? 'border-indigo-500 bg-indigo-50/50 scale-[1.02]' 
                      : 'border-slate-250 hover:border-slate-350 hover:bg-slate-50/30'
                  }`}
                  onClick={() => document.getElementById('profile-photo-input')?.click()}
                >
                  <Upload className={`w-8 h-8 mb-2 transition-colors ${isDragging ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <p className="font-extrabold text-slate-700 text-[11px] mb-1">Arraste sua foto aqui</p>
                  <p className="text-[9px] text-slate-400 leading-snug">ou clique para procurar no seu dispositivo</p>
                  <p className="text-[8px] text-slate-400 font-mono mt-2 uppercase tracking-wide bg-slate-100 px-2 py-0.5 rounded">PNG, JPG ou GIF</p>
                  
                  <input
                    id="profile-photo-input"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              )}
            </div>

            {/* Biography Text Message */}
            <div className="space-y-1.5 pt-4 border-t border-slate-100">
              <label className="text-[11px] text-slate-400 font-bold uppercase block tracking-wider">Sua Mensagem de Status / Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={95}
                placeholder="Ex: Em trânsito, sem sinal constante!"
                rows={3}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 font-medium text-slate-800 text-[11px] font-sans resize-none leading-relaxed"
              />
              <span className="text-[9px] text-slate-400 font-mono text-right block">{95 - bio.length} caracteres permitidos</span>
            </div>
          </div>

          {/* Preferences and toggles */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 text-xs text-slate-650">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                <Sliders className="w-4.5 h-4.5" />
              </div>
              <h2 className="font-extrabold text-slate-800 text-sm uppercase tracking-wide">Ajustes &amp; Comportamento</h2>
            </div>

            <div className="space-y-4 pt-1">
              <label className="flex items-start gap-3.5 cursor-pointer group select-none">
                <input
                  type="checkbox"
                  checked={playNotificationSounds}
                  onChange={(e) => setPlayNotificationSounds(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded-md border-slate-350 text-indigo-600 focus:ring-indigo-500 cursor-pointer text-indigo-600 accent-indigo-600"
                />
                <div>
                  <strong className="text-slate-800 font-extrabold group-hover:text-indigo-600 transition-colors block">Sinalizadores Sonoros</strong>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">Emitir sons de confirmação e campainha ao receber novos alertas de despache regional.</p>
                </div>
              </label>

              <label className="flex items-start gap-3.5 cursor-pointer group select-none pt-3 border-t border-slate-100">
                <input
                  type="checkbox"
                  checked={allowTelemetryLogs}
                  onChange={(e) => setAllowTelemetryLogs(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded-md border-slate-350 text-indigo-600 focus:ring-indigo-500 cursor-pointer text-indigo-600 accent-indigo-600"
                />
                <div>
                  <strong className="text-slate-800 font-extrabold group-hover:text-indigo-600 transition-colors block">Telemetria de Atividade</strong>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">Permitir log de atividade em segundo plano para relatórios automatizados de tempo médio por parada.</p>
                </div>
              </label>
            </div>
          </div>
        </div>

      </form>

      {/* Floating Success Alert Banner */}
      {saveSuccess && (
        <motion.div 
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          className="fixed bottom-6 right-6 bg-slate-900 text-white border border-slate-800/80 p-4 rounded-2xl flex items-center gap-3 shadow-2xl z-[9999] max-w-sm select-none"
        >
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0 border border-emerald-500/20">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <strong className="text-xs font-black uppercase text-emerald-400 block tracking-wider">Perfil Atualizado!</strong>
            <p className="text-[10px] text-slate-300 mt-0.5 font-sans">As informações pessoais e personalização foram synced com nossa nuvem.</p>
          </div>
        </motion.div>
      )}

    </div>
  );
}
