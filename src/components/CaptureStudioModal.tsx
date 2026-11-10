import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import type { CaptureData } from '../../shared/types';
import { Icon } from './Icon';
import { cx } from '../lib';

interface Props {
  data: CaptureData;
  onClose: () => void;
}

type Tool = 'pen' | 'arrow' | 'rect' | 'blur' | 'text' | 'crop';

interface DrawAction {
  tool: Tool;
  color: string;
  lineWidth: number;
  points?: { x: number; y: number }[];
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  text?: string;
}

const COLORS = [
  { id: 'red', hex: '#ef4444', label: 'אדום' },
  { id: 'emerald', hex: '#10b981', label: 'ירוק' },
  { id: 'sky', hex: '#38bdf8', label: 'כחול' },
  { id: 'amber', hex: '#f59e0b', label: 'צהוב' },
  { id: 'purple', hex: '#a855f7', label: 'סגול' },
  { id: 'white', hex: '#ffffff', label: 'לבן' },
  { id: 'dark', hex: '#0f172a', label: 'שחור' },
];

export function CaptureStudioModal({ data, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseImgRef = useRef<HTMLImageElement | null>(null);

  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#ef4444');
  const [lineWidth, setLineWidth] = useState(4);
  const [actions, setActions] = useState<DrawAction[]>([]);
  const [currentAction, setCurrentAction] = useState<DrawAction | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [copiedToast, setCopiedToast] = useState(false);

  // Text tool input prompt state
  const [textPromptPos, setTextPromptPos] = useState<{ x: number; y: number } | null>(null);
  const [textInputVal, setTextInputVal] = useState('');

  // Load image onto canvas
  useEffect(() => {
    const img = new Image();
    img.src = data.dataUrl;
    img.onload = () => {
      baseImgRef.current = img;
      renderCanvas();
    };
  }, [data.dataUrl]);

  // Re-render when actions change
  useEffect(() => {
    renderCanvas();
  }, [actions, currentAction]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        setActions((prev) => prev.slice(0, -1));
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        copyToClipboard();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const renderCanvas = () => {
    const canvas = canvasRef.current;
    const baseImg = baseImgRef.current;
    if (!canvas || !baseImg) return;

    if (canvas.width !== baseImg.width || canvas.height !== baseImg.height) {
      canvas.width = baseImg.width;
      canvas.height = baseImg.height;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw base screenshot
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(baseImg, 0, 0);

    const allActions = currentAction ? [...actions, currentAction] : actions;

    for (const a of allActions) {
      ctx.save();
      ctx.strokeStyle = a.color;
      ctx.fillStyle = a.color;
      ctx.lineWidth = a.lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (a.tool === 'pen' && a.points && a.points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(a.points[0].x, a.points[0].y);
        for (let i = 1; i < a.points.length; i++) {
          ctx.lineTo(a.points[i].x, a.points[i].y);
        }
        ctx.stroke();
      } else if (a.tool === 'rect' && a.startX !== undefined && a.startY !== undefined && a.endX !== undefined && a.endY !== undefined) {
        const x = Math.min(a.startX, a.endX);
        const y = Math.min(a.startY, a.endY);
        const w = Math.abs(a.endX - a.startX);
        const h = Math.abs(a.endY - a.startY);
        ctx.strokeRect(x, y, w, h);
      } else if (a.tool === 'arrow' && a.startX !== undefined && a.startY !== undefined && a.endX !== undefined && a.endY !== undefined) {
        drawArrow(ctx, a.startX, a.startY, a.endX, a.endY, a.lineWidth);
      } else if (a.tool === 'blur' && a.startX !== undefined && a.startY !== undefined && a.endX !== undefined && a.endY !== undefined) {
        drawBlurRedact(ctx, a.startX, a.startY, a.endX, a.endY);
      } else if (a.tool === 'text' && a.startX !== undefined && a.startY !== undefined && a.text) {
        ctx.font = `bold ${Math.max(16, a.lineWidth * 4)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        ctx.fillStyle = a.color;
        // Text background badge for clarity
        const textWidth = ctx.measureText(a.text).width;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
        ctx.fillRect(a.startX - 6, a.startY - 22, textWidth + 12, 30);
        ctx.fillStyle = a.color;
        ctx.fillText(a.text, a.startX, a.startY);
      }

      ctx.restore();
    }
  };

  const drawArrow = (ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number, width: number) => {
    const headlen = Math.max(14, width * 3.5);
    const angle = Math.atan2(toY - fromY, toX - fromX);

    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  };

  const drawBlurRedact = (ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) => {
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const w = Math.abs(x2 - x1);
    const h = Math.abs(y2 - y1);
    if (w < 4 || h < 4) return;

    // Dark frosted redaction filter
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.fillRect(x, y, w, h);

    // Diagonal safety warning stripes pattern
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let offset = -h; offset < w; offset += 14) {
      ctx.moveTo(Math.max(x, x + offset), y);
      ctx.lineTo(Math.min(x + w, x + offset + h), y + h);
    }
    ctx.stroke();

    // Redacted border
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);
  };

  const getCanvasCoords = (e: RPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: RPointerEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);

    if (tool === 'text') {
      setTextPromptPos(coords);
      return;
    }

    setIsDrawing(true);

    if (tool === 'pen') {
      setCurrentAction({
        tool: 'pen',
        color,
        lineWidth,
        points: [coords],
      });
    } else {
      setCurrentAction({
        tool,
        color,
        lineWidth,
        startX: coords.x,
        startY: coords.y,
        endX: coords.x,
        endY: coords.y,
      });
    }
  };

  const handlePointerMove = (e: RPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentAction) return;
    const coords = getCanvasCoords(e);

    if (tool === 'pen' && currentAction.points) {
      setCurrentAction({
        ...currentAction,
        points: [...currentAction.points, coords],
      });
    } else {
      setCurrentAction({
        ...currentAction,
        endX: coords.x,
        endY: coords.y,
      });
    }
  };

  const handlePointerUp = () => {
    if (!isDrawing || !currentAction) return;
    setIsDrawing(false);
    setActions((prev) => [...prev, currentAction]);
    setCurrentAction(null);
  };

  const commitText = () => {
    if (textPromptPos && textInputVal.trim()) {
      setActions((prev) => [
        ...prev,
        {
          tool: 'text',
          color,
          lineWidth,
          startX: textPromptPos.x,
          startY: textPromptPos.y,
          text: textInputVal.trim(),
        },
      ]);
    }
    setTextPromptPos(null);
    setTextInputVal('');
  };

  const copyToClipboard = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        setCopiedToast(true);
        setTimeout(() => setCopiedToast(false), 2200);
      } catch (err) {
        console.error('Clipboard copy failed:', err);
      }
    }, 'image/png');
  };

  const downloadImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const a = document.createElement('a');
    a.download = `Drift-Capture-${stamp}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  };

  const searchGoogleLens = () => {
    // Open Google Lens with active page URL
    if (data.url) {
      window.open(`https://lens.google.com/uploadbyurl?url=${encodeURIComponent(data.url)}`, '_blank');
    } else {
      downloadImage();
    }
  };

  return (
    <div className="capture-modal-backdrop" onMouseDown={onClose}>
      <div className="capture-studio-container" onMouseDown={(e) => e.stopPropagation()} dir="rtl">
        {/* Top Control Bar */}
        <div className="capture-top-toolbar">
          <div className="toolbar-section tools-group">
            <button
              className={cx('tool-btn', tool === 'pen' && 'active')}
              onClick={() => setTool('pen')}
              title="עט ציור חופשי (Freehand Pen)"
            >
              ✏️ עט
            </button>
            <button
              className={cx('tool-btn', tool === 'arrow' && 'active')}
              onClick={() => setTool('arrow')}
              title="חץ הדגשה (Arrow pointer)"
            >
              ➡️ חץ
            </button>
            <button
              className={cx('tool-btn', tool === 'rect' && 'active')}
              onClick={() => setTool('rect')}
              title="מלבן מסגרת (Rectangle box)"
            >
              🔲 מלבן
            </button>
            <button
              className={cx('tool-btn', tool === 'blur' && 'active')}
              onClick={() => setTool('blur')}
              title="טשטוש והסתרת מידע רגיש (Blur & Redact)"
            >
              🌫️ טשטוש
            </button>
            <button
              className={cx('tool-btn', tool === 'text' && 'active')}
              onClick={() => setTool('text')}
              title="הוספת הערת טקסט (Add Text note)"
            >
              🔤 טקסט
            </button>
          </div>

          <div className="toolbar-divider" />

          {/* Color Palette */}
          <div className="toolbar-section colors-group">
            {COLORS.map((c) => (
              <button
                key={c.id}
                className={cx('color-swatch-btn', color === c.hex && 'active')}
                style={{ backgroundColor: c.hex }}
                onClick={() => setColor(c.hex)}
                title={c.label}
              />
            ))}
          </div>

          <div className="toolbar-divider" />

          {/* Stroke Width Selector */}
          <div className="toolbar-section stroke-group">
            {[2, 5, 10].map((w) => (
              <button
                key={w}
                className={cx('stroke-btn', lineWidth === w && 'active')}
                onClick={() => setLineWidth(w)}
                title={`עובי קו: ${w}px`}
              >
                <span className="stroke-circle" style={{ width: w + 2, height: w + 2 }} />
              </button>
            ))}
          </div>

          <div className="toolbar-divider" />

          {/* Undo / Clear */}
          <div className="toolbar-section actions-group">
            <button
              className="action-icon-btn"
              disabled={actions.length === 0}
              onClick={() => setActions((prev) => prev.slice(0, -1))}
              title="בטל פעולה אחרונה (Ctrl+Z)"
            >
              <Icon name="back" size={14} />
            </button>
            <button
              className="action-icon-btn"
              disabled={actions.length === 0}
              onClick={() => setActions([])}
              title="נקה את כל הסימונים"
            >
              <Icon name="broom" size={14} />
            </button>
          </div>

          <div className="toolbar-fill" />

          {/* Export Actions */}
          <div className="toolbar-section export-group">
            <button className="btn primary small" onClick={copyToClipboard} title="העתק תמונה ללוח (Ctrl+C)">
              <Icon name="copy" size={13} />
              <span>העתק ללוח</span>
            </button>
            <button className="btn small" onClick={downloadImage} title="הורד לקובץ תמונה בתיקיית ההורדות">
              <Icon name="download" size={13} />
              <span>שמור PNG</span>
            </button>
            <button className="btn small ghost" onClick={searchGoogleLens} title="חפש מידע על התמונה ב-Google Lens">
              <Icon name="search" size={13} />
            </button>
            <button className="action-icon-btn close-btn" onClick={onClose} title="סגור (Esc)">
              <Icon name="x" size={16} />
            </button>
          </div>
        </div>

        {/* Canvas Workspace Viewport */}
        <div className="capture-canvas-viewport">
          <canvas
            ref={canvasRef}
            className={cx('capture-canvas', `tool-${tool}`)}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />

          {/* Text Input Prompt */}
          {textPromptPos && (
            <div
              className="canvas-text-prompt"
              style={{
                left: textPromptPos.x,
                top: textPromptPos.y,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <input
                autoFocus
                type="text"
                className="text-prompt-input"
                placeholder="הקלד הערה..."
                value={textInputVal}
                onChange={(e) => setTextInputVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitText();
                  if (e.key === 'Escape') setTextPromptPos(null);
                }}
              />
              <button className="btn small primary" onClick={commitText}>
                אישור
              </button>
            </div>
          )}
        </div>

        {/* Copy Notification Toast */}
        {copiedToast && (
          <div className="capture-toast">
            <Icon name="check" size={14} />
            <span>התמונה הועתקה ללוח בהצלחה! (Ctrl+V להדבקה)</span>
          </div>
        )}
      </div>
    </div>
  );
}

