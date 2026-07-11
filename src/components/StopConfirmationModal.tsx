import React, { RefObject } from 'react';
import { Parada } from '../types';
import { CheckCircle, X, Camera, Trash2 } from 'lucide-react';

interface StopConfirmationModalProps {
  confirmingStop: Parada;
  confirmPhotos: string[];
  modalSignatureCanvasRef: RefObject<HTMLCanvasElement | null>;
  modalHasSigned: boolean;
  handleModalClearSignature: () => void;
  handleModalStartDrawing: (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => void;
  handleModalDraw: (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => void;
  handleModalStopDrawing: () => void;
  handleModalPhotoFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveConfirmPhoto: (index: number) => void;
  handleConfirmModalDelivery: () => void;
  onClose: () => void;
}

export function StopConfirmationModal({
  confirmingStop,
  confirmPhotos,
  modalSignatureCanvasRef,
  modalHasSigned,
  handleModalClearSignature,
  handleModalStartDrawing,
  handleModalDraw,
  handleModalStopDrawing,
  handleModalPhotoFileChange,
  handleRemoveConfirmPhoto,
  handleConfirmModalDelivery,
  onClose,
}: StopConfirmationModalProps) {
  return (
    <div id="modal-comprovante-entrega" className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white border border-slate-200 shadow-2xl rounded-3xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] md:max-h-[95vh] relative animate-scale-up font-sans">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/30">
              <CheckCircle className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wide">Confirmar Entrega</h3>
              <p className="text-[10px] text-slate-400 font-mono tracking-wider">CLIENTE INTEGRADO • REAL-TIME</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="text-slate-400 hover:text-white transition-all p-2 rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {/* Target Client Metadata Card */}
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-1">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono block">Destinatário Logístico</span>
            <strong className="text-slate-800 text-sm block font-extrabold">{confirmingStop.clientName}</strong>
            <p className="text-slate-500 text-[11px] leading-relaxed">📍 {confirmingStop.address}</p>
          </div>

          {/* Step 1: Canvas Signature */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                🖊️ Colete a Assinatura Digital:
              </label>
              <button 
                type="button" 
                onClick={handleModalClearSignature}
                className="text-[10px] text-red-600 hover:text-red-700 border border-red-200 hover:bg-red-50 font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer"
              >
                Recomeçar / Limpar
              </button>
            </div>

            <div className="relative border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-inner h-[180px] flex flex-col">
              <canvas
                ref={modalSignatureCanvasRef}
                onMouseDown={handleModalStartDrawing}
                onMouseMove={handleModalDraw}
                onMouseUp={handleModalStopDrawing}
                onMouseLeave={handleModalStopDrawing}
                onTouchStart={handleModalStartDrawing}
                onTouchMove={handleModalDraw}
                onTouchEnd={handleModalStopDrawing}
                className="w-full h-full cursor-crosshair touch-none bg-slate-50/20"
              />
              {!modalHasSigned && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400/80 text-[11px] font-medium uppercase font-sans">
                  Assine aqui com o dedo ou canetinha digital
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Collection of up to 5 validation photos */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                📷 Fotos Comprovantes ({confirmPhotos.length} de 5):
              </label>
              
              {confirmPhotos.length < 5 ? (
                <label className="relative flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[10px] uppercase tracking-wide px-3 py-2 rounded-xl border border-indigo-700 shadow-sm transition-all cursor-pointer hover:scale-[1.02] active:scale-95 select-none animate-pulse">
                  <Camera className="w-3.5 h-3.5 text-indigo-200" />
                  Capturar Foto
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleModalPhotoFileChange} 
                    className="hidden" 
                    capture="environment" // trigger camera immediately on mobile
                    multiple
                  />
                </label>
              ) : (
                <span className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-100 font-extrabold px-2 py-1 rounded-lg uppercase">
                  Limite de Fotos Preenchido ✅
                </span>
              )}
            </div>

            {/* Symmetrical grid for previews */}
            {confirmPhotos.length > 0 ? (
              <div className="grid grid-cols-5 gap-2 bg-slate-50 border border-slate-100 p-3 rounded-2xl">
                {confirmPhotos.map((photo, pIdx) => (
                  <div key={pIdx} className="relative aspect-square rounded-xl bg-white border border-slate-200 overflow-hidden shadow-xs group">
                    <img 
                      src={photo} 
                      alt={`Proof ${pIdx + 1}`} 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveConfirmPhoto(pIdx)}
                      className="absolute inset-0 bg-red-600/70 hover:bg-red-700/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all rounded-xl cursor-pointer"
                      title="Remover foto do relatório"
                    >
                      <Trash2 className="w-4 h-4 text-white" />
                    </button>
                    <span className="absolute bottom-1 right-1 text-[8px] font-extrabold font-mono text-slate-900 bg-white/90 border border-slate-200 px-1 rounded">
                      #{pIdx + 1}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-7 border border-dashed border-slate-200 bg-slate-50/50 rounded-2xl text-slate-400 space-y-1.5">
                <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-500">Nenhuma foto adicionada ainda</p>
                  <p className="text-[9px] text-slate-400">É obrigatório anexar no mínimo 1 foto do comprovante fiscal, carga ou estabelecimento.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sticky Actions Footer */}
        <div className="bg-slate-50 border-t border-slate-100 p-4 sticky bottom-0 z-10 flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="w-1/3 py-3 border border-slate-200 bg-white hover:bg-slate-100 hover:border-slate-300 text-slate-700 font-bold rounded-2xl text-xs uppercase cursor-pointer select-none transition-all active:scale-95"
          >
            Voltar ao Mapa
          </button>

          <button
            type="button"
            onClick={handleConfirmModalDelivery}
            className="w-2/3 py-3 bg-indigo-600 hover:bg-indigo-700 border border-indigo-700 text-white font-extrabold rounded-2xl text-xs uppercase tracking-wider shadow-md hover:shadow-indigo-100 shadow-indigo-50/50 flex items-center justify-center gap-1.5 transition-all select-none active:scale-95 cursor-pointer"
          >
            <CheckCircle className="w-4 h-4 text-white" />
            Registrar Comprovantes
          </button>
        </div>
      </div>
    </div>
  );
}
