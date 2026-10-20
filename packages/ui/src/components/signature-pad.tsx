import { Eraser } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from './button';

interface SignaturePadProps {
  onChange: (dataUrl: string | null) => void;
  label: string;
  clearLabel?: string;
  hint?: string;
}

/**
 * Pointer-based signature capture (mouse, touch, stylus). Emits a PNG data URL
 * once the patient has drawn enough to count as a signature.
 */
export function SignaturePad({ onChange, label, clearLabel = 'Clear', hint }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const points = useRef(0);
  const [empty, setEmpty] = useState(true);

  const setup = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(ratio, ratio);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#142D36';
  }, []);

  useEffect(() => {
    setup();
  }, [setup]);

  const position = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const clear = () => {
    setup();
    points.current = 0;
    setEmpty(true);
    onChange(null);
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[13px] font-medium">{label}</span>
        <Button variant="ghost" size="sm" onClick={clear} disabled={empty}>
          <Eraser />
          {clearLabel}
        </Button>
      </div>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={label}
        className="h-40 w-full touch-none rounded-xl border-2 border-dashed border-border-strong bg-white"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = true;
          const ctx = e.currentTarget.getContext('2d')!;
          const { x, y } = position(e);
          ctx.beginPath();
          ctx.moveTo(x, y);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = e.currentTarget.getContext('2d')!;
          const { x, y } = position(e);
          ctx.lineTo(x, y);
          ctx.stroke();
          points.current += 1;
        }}
        onPointerUp={(e) => {
          drawing.current = false;
          if (points.current > 8) {
            setEmpty(false);
            onChange(e.currentTarget.toDataURL('image/png'));
          }
        }}
      />
      {hint && <p className="mt-1 text-xs text-fg-subtle">{hint}</p>}
    </div>
  );
}
