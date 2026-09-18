import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, RefreshCw, Volume2, Sparkles, Check, AlertCircle } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { Product } from '../types';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (scannedText: string) => void;
  products: Product[];
  currentOrderExpectedSku?: string;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  products,
  currentOrderExpectedSku,
}) => {
  const [hasCamera, setHasCamera] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [activeCameraId, setActiveCameraId] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const qrRegionId = 'vistoosa-qr-reader';

  // Play synthetic scan beep
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1850, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    async function initCamera() {
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          if (!isMounted) return;
          setHasCamera(true);
          // Prefer back camera if available
          const backCam = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment'));
          const selectedId = backCam ? backCam.id : devices[0].id;
          setActiveCameraId(selectedId);

          const scanner = new Html5Qrcode(qrRegionId);
          scannerRef.current = scanner;

          await scanner.start(
            selectedId,
            {
              fps: 15,
              qrbox: { width: 280, height: 180 },
              aspectRatio: 1.33,
            },
            (decodedText) => {
              playBeep();
              onScanSuccess(decodedText);
              onClose();
            },
            () => {
              // frame scanned without detection, normal
            }
          );
          if (isMounted) setIsScanning(true);
        } else {
          if (isMounted) {
            setHasCamera(false);
            setCameraError('No physical camera detected on this system.');
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setHasCamera(false);
          setCameraError(err?.message || 'Camera permission denied or unavailable.');
        }
      }
    }

    // Small delay to ensure DOM element exists
    const timer = setTimeout(() => {
      initCamera();
    }, 200);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .catch(() => {})
          .finally(() => {
            scannerRef.current = null;
          });
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      playBeep();
      onScanSuccess(manualInput.trim());
      onClose();
    }
  };

  // Quick preset barcodes for testing Real-Product Override & Normal dispatch
  const quickTestBarcodes = [
    { label: 'Polo L (Expected)', sku: 'POLO-NVY-L', barcode: '8901001003' },
    { label: 'Polo XL (Override Test)', sku: 'POLO-NVY-XL', barcode: '8901001004' },
    { label: 'Polo M', sku: 'POLO-NVY-M', barcode: '8901001002' },
    { label: 'Panjabi M', sku: 'PANJ-WHT-M', barcode: '8901002002' },
    { label: 'Panjabi XL', sku: 'PANJ-WHT-XL', barcode: '8901002004' },
    { label: 'Chinos 34 (L)', sku: 'CHIN-KHK-34', barcode: '8901004003' },
    { label: 'Oxford Shirt M', sku: 'SHRT-BLU-M', barcode: '8901003002' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-3xl bg-zinc-900 border border-zinc-700/80 p-5 md:p-6 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Warehouse Barcode Scanner</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono">
                  EAN-13 / SKU
                </span>
              </h3>
              <p className="text-[11px] text-zinc-400">
                Scan product tag before packing to verify or trigger override
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Expected SKU badge */}
        {currentOrderExpectedSku && (
          <div className="mb-3 px-3 py-2 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-center justify-between text-xs">
            <span className="text-zinc-400">Expected SKU on Invoice:</span>
            <span className="font-mono font-bold text-amber-300 px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700">
              {currentOrderExpectedSku}
            </span>
          </div>
        )}

        {/* Camera Container */}
        <div className="relative rounded-2xl overflow-hidden bg-black border border-zinc-800 aspect-[4/3] flex items-center justify-center mb-4">
          <div id={qrRegionId} className="w-full h-full" />

          {/* Fallback or Camera Error Info */}
          {cameraError && (
            <div className="absolute inset-0 bg-zinc-950/90 flex flex-col items-center justify-center p-6 text-center z-10">
              <AlertCircle className="w-10 h-10 text-amber-400 mb-2" />
              <p className="text-xs font-semibold text-zinc-200 mb-1">
                Camera Viewport Inactive
              </p>
              <p className="text-[11px] text-zinc-400 mb-4 max-w-xs">
                {cameraError} You can instantly test scanning using the preset SKU buttons or manual input below.
              </p>
            </div>
          )}

          {/* Target Scanning Crosshair Overlay */}
          {!cameraError && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-64 h-36 border-2 border-amber-400/70 rounded-2xl relative">
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-amber-300" />
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-amber-300" />
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-amber-300" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-amber-300" />
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent absolute top-1/2 -translate-y-1/2 animate-pulse" />
              </div>
            </div>
          )}
        </div>

        {/* Manual Barcode Entry */}
        <form onSubmit={handleManualSubmit} className="mb-4">
          <label className="block text-[11px] font-semibold text-zinc-400 mb-1.5">
            Manual Barcode / SKU Input:
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="e.g. 8901001004 or POLO-NVY-XL"
              className="flex-1 rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-xs text-white font-mono placeholder-zinc-500 focus:outline-none focus:border-amber-500"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition"
            >
              Verify
            </button>
          </div>
        </form>

        {/* Quick Simulation Buttons */}
        <div className="pt-2 border-t border-zinc-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Simulate Physical Tag Scan:</span>
            </span>
            <span className="text-[10px] text-zinc-500">Instant test</span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {quickTestBarcodes.map((item) => (
              <button
                key={item.sku}
                type="button"
                onClick={() => {
                  playBeep();
                  onScanSuccess(item.sku);
                  onClose();
                }}
                className={`text-[11px] px-2.5 py-1 rounded-lg border font-mono transition ${
                  item.sku === currentOrderExpectedSku
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 font-bold'
                    : item.sku.includes('XL') && currentOrderExpectedSku?.includes('L')
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 hover:bg-amber-500/30 font-bold'
                    : 'bg-zinc-800/80 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
                }`}
                title={`Barcode: ${item.barcode}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
