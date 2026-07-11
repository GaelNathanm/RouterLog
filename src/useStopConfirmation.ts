import React, { useState, useEffect, useRef } from 'react';
import { Parada } from './types';

export function useStopConfirmation(activeTab: string) {
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const modalSignatureCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [capturedCanhoto, setCapturedCanhoto] = useState<string | null>(null);
  const [capturedLocal, setCapturedLocal] = useState<string | null>(null);

  const [confirmingStop, setConfirmingStop] = useState<Parada | null>(null);
  const [confirmPhotos, setConfirmPhotos] = useState<string[]>([]);
  const [modalCapturedCanhoto, setModalCapturedCanhoto] = useState<string | null>(null);
  const [modalCapturedLocal, setModalCapturedLocal] = useState<string | null>(null);
  
  const [modalIsDrawing, setModalIsDrawing] = useState(false);
  const [modalHasSigned, setModalHasSigned] = useState(false);

  // Clear digital signature for modal
  const handleModalClearSignature = () => {
    const canvas = modalSignatureCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Draw elegant slate-200 help guideline
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(15, canvas.height - 35);
        ctx.lineTo(canvas.width - 15, canvas.height - 35);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    setModalHasSigned(false);
  };

  const getModalCanvasCoords = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  };

  const handleModalStartDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = modalSignatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getModalCanvasCoords(e, canvas);
    ctx.strokeStyle = '#0f172a'; // slate-900 high contrast ink ink
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setModalIsDrawing(true);
    setModalHasSigned(true);
  };

  const handleModalDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!modalIsDrawing) return;
    e.preventDefault();
    const canvas = modalSignatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getModalCanvasCoords(e, canvas);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const handleModalStopDrawing = () => {
    setModalIsDrawing(false);
  };

  // Reset/draw guidelines on modal signature canvas when confirmingStop changes and responsive actual dimensions tracking
  useEffect(() => {
    const handleResize = () => {
      const modalCanvas = modalSignatureCanvasRef.current;
      if (modalCanvas && modalCanvas.parentElement) {
        modalCanvas.width = modalCanvas.parentElement.clientWidth;
        modalCanvas.height = modalCanvas.parentElement.clientHeight || 180;
        
        // redraw guideline:
        const ctx = modalCanvas.getContext('2d');
        if (ctx) {
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = 1;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(15, modalCanvas.height - 35);
          ctx.lineTo(modalCanvas.width - 15, modalCanvas.height - 35);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      const inlineCanvas = signatureCanvasRef.current;
      if (inlineCanvas && inlineCanvas.parentElement) {
        inlineCanvas.width = inlineCanvas.parentElement.clientWidth;
        inlineCanvas.height = inlineCanvas.parentElement.clientHeight || 180;
      }
    };

    window.addEventListener('resize', handleResize);
    const timer = setTimeout(handleResize, 300);

    if (confirmingStop) {
      setTimeout(() => {
        handleResize();
        handleModalClearSignature();
      }, 350);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, [confirmingStop, activeTab]);

  // Handle up to 5 photos additions
  const handleModalPhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const remainingSlots = 5 - confirmPhotos.length;
      if (remainingSlots <= 0) {
        alert('Limite máximo de 5 fotos atingido!');
        return;
      }
      
      const filesToProcess = Array.from(files).slice(0, remainingSlots) as File[];
      
      filesToProcess.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setConfirmPhotos(prev => {
            if (prev.length >= 5) return prev;
            return [...prev, reader.result as string];
          });
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleRemoveConfirmPhoto = (indexToRemove: number) => {
    setConfirmPhotos(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Clear digital signature
  const handleClearSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Draw elegant slate-200 help guideline
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(15, canvas.height - 35);
        ctx.lineTo(canvas.width - 15, canvas.height - 35);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    setHasSigned(false);
  };

  // Convert coordinate spaces of click / touch events to relative canvas layout dimensions
  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  };

  const handleStartDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCanvasCoords(e, canvas);
    ctx.strokeStyle = '#0f172a'; // slate-900 high contrast ink ink
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
    setHasSigned(true);
  };

  const handleDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const coords = getCanvasCoords(e, canvas);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const handleStopDrawing = () => {
    setIsDrawing(false);
  };

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCanhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedCanhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLocalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedLocal(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleModalCanhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setModalCapturedCanhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleModalLocalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setModalCapturedLocal(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return {
    signatureCanvasRef,
    modalSignatureCanvasRef,
    isDrawing,
    hasSigned,
    setHasSigned,
    capturedPhoto,
    setCapturedPhoto,
    capturedCanhoto,
    setCapturedCanhoto,
    capturedLocal,
    setCapturedLocal,
    confirmingStop,
    setConfirmingStop,
    confirmPhotos,
    setConfirmPhotos,
    modalCapturedCanhoto,
    setModalCapturedCanhoto,
    modalCapturedLocal,
    setModalCapturedLocal,
    modalIsDrawing,
    modalHasSigned,
    setModalHasSigned,
    handleClearSignature,
    handleModalClearSignature,
    handleStartDrawing,
    handleDraw,
    handleStopDrawing,
    handleModalStartDrawing,
    handleModalDraw,
    handleModalStopDrawing,
    handlePhotoFileChange,
    handleCanhotoFileChange,
    handleLocalFileChange,
    handleModalCanhotoFileChange,
    handleModalLocalFileChange,
    handleModalPhotoFileChange,
    handleRemoveConfirmPhoto
  };
}
