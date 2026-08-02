import { ColorScheme } from '../types/graph';

export function drawGlowingPoint(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  time: number,
  label?: string
) {
  const pulse = 1 + Math.sin(time * 0.005) * 0.18;

  context.save();

  // 1. Softly animated outer pulse
  context.globalCompositeOperation = 'lighter';
  context.globalAlpha = 0.18;
  context.fillStyle = color;
  context.beginPath();
  context.arc(x, y, 20 * pulse, 0, Math.PI * 2);
  context.fill();

  // 2. Intermediate glow ring
  context.globalAlpha = 0.38;
  context.beginPath();
  context.arc(x, y, 11 * pulse, 0, Math.PI * 2);
  context.fill();

  // 3. Saturated colored ring stroke
  context.globalCompositeOperation = 'source-over';
  context.globalAlpha = 0.9;
  context.strokeStyle = color;
  context.lineWidth = 1.8;
  context.beginPath();
  context.arc(x, y, 7.5 * pulse, 0, Math.PI * 2);
  context.stroke();

  // 4. Solid color inner dot
  context.globalAlpha = 1.0;
  context.fillStyle = color;
  context.beginPath();
  context.arc(x, y, 5, 0, Math.PI * 2);
  context.fill();

  // 5. Small white center core
  context.fillStyle = '#ffffff';
  context.beginPath();
  context.arc(x, y, 2.2, 0, Math.PI * 2);
  context.fill();

  context.restore();

  // Label text if provided
  if (label) {
    context.save();
    context.font = '700 11px "JetBrains Mono", monospace';
    context.fillStyle = color;
    context.textAlign = 'center';
    context.shadowColor = 'rgba(0, 0, 0, 0.95)';
    context.shadowBlur = 5;
    context.fillText(label, x, y + 26);
    context.restore();
  }
}

export function drawFinalPath(
  context: CanvasRenderingContext2D,
  pointsList: [number, number][][],
  colorScheme: ColorScheme,
  progress: number = 1.0
) {
  if (pointsList.length === 0) return;

  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';

  const maxSegmentIndex = Math.floor(progress * pointsList.length);

  // Helper to trace path segments
  const tracePath = () => {
    context.beginPath();
    for (let i = 0; i < maxSegmentIndex; i++) {
      const pts = pointsList[i];
      if (!pts || pts.length < 2) continue;
      context.moveTo(pts[0][0], pts[0][1]);
      for (let j = 1; j < pts.length; j++) {
        context.lineTo(pts[j][0], pts[j][1]);
      }
    }
  };

  // Additive screen-style blending for the outer glow layers
  context.globalCompositeOperation = 'lighter';

  // Layer 1: Wide soft outer glow
  context.globalAlpha = 0.25;
  context.strokeStyle = colorScheme.primary;
  context.lineWidth = 7.0;
  context.shadowColor = colorScheme.primary;
  context.shadowBlur = 14;
  tracePath();
  context.stroke();

  // Layer 2: Medium concentrated glow
  context.globalAlpha = 0.55;
  context.strokeStyle = colorScheme.primary;
  context.lineWidth = 4.0;
  context.shadowBlur = 8;
  tracePath();
  context.stroke();

  // Layer 3: Saturated inner halo
  context.globalAlpha = 0.85;
  context.strokeStyle = colorScheme.primary;
  context.lineWidth = 2.8;
  context.shadowBlur = 4;
  tracePath();
  context.stroke();

  // Layer 4: Thin white core (crisp & energetic)
  context.globalCompositeOperation = 'source-over';
  context.globalAlpha = 1.0;
  context.strokeStyle = '#ffffff';
  context.lineWidth = 1.8;
  context.shadowBlur = 0;
  tracePath();
  context.stroke();

  context.restore();
}
