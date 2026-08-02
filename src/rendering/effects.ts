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
  context.globalCompositeOperation = 'lighter';

  // Outer ring glow 1
  context.globalAlpha = 0.15;
  context.fillStyle = color;
  context.beginPath();
  context.arc(x, y, 22 * pulse, 0, Math.PI * 2);
  context.fill();

  // Outer ring glow 2
  context.globalAlpha = 0.35;
  context.beginPath();
  context.arc(x, y, 12 * pulse, 0, Math.PI * 2);
  context.fill();

  // Concentric circle ring stroke
  context.globalAlpha = 0.8;
  context.strokeStyle = color;
  context.lineWidth = 1.5;
  context.beginPath();
  context.arc(x, y, 8 * pulse, 0, Math.PI * 2);
  context.stroke();

  // Solid color dot
  context.globalAlpha = 1;
  context.fillStyle = color;
  context.beginPath();
  context.arc(x, y, 5, 0, Math.PI * 2);
  context.fill();

  // White core highlight
  context.fillStyle = '#ffffff';
  context.beginPath();
  context.arc(x, y, 2.5, 0, Math.PI * 2);
  context.fill();

  context.restore();

  // Optional label underneath
  if (label) {
    context.save();
    context.font = 'bold 11px "JetBrains Mono", monospace';
    context.fillStyle = color;
    context.textAlign = 'center';
    context.shadowColor = 'rgba(0, 0, 0, 0.8)';
    context.shadowBlur = 4;
    context.fillText(label, x, y + 26);
    context.restore();
  }
}

export function drawFinalPath(
  context: CanvasRenderingContext2D,
  pointsList: [number, number][][],
  progress: number = 1.0
) {
  if (pointsList.length === 0) return;

  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';

  const maxSegmentIndex = Math.floor(progress * pointsList.length);

  // Layer 1: Wide background glow
  context.shadowColor = '#00f0ff';
  context.shadowBlur = 12;
  context.strokeStyle = 'rgba(0, 230, 255, 0.8)';
  context.lineWidth = 4.5;
  context.beginPath();

  for (let i = 0; i < maxSegmentIndex; i++) {
    const pts = pointsList[i];
    if (pts.length < 2) continue;
    context.moveTo(pts[0][0], pts[0][1]);
    for (let j = 1; j < pts.length; j++) {
      context.lineTo(pts[j][0], pts[j][1]);
    }
  }
  context.stroke();

  // Layer 2: Bright inner core
  context.shadowBlur = 0;
  context.strokeStyle = '#ffffff';
  context.lineWidth = 2.0;
  context.beginPath();

  for (let i = 0; i < maxSegmentIndex; i++) {
    const pts = pointsList[i];
    if (pts.length < 2) continue;
    context.moveTo(pts[0][0], pts[0][1]);
    for (let j = 1; j < pts.length; j++) {
      context.lineTo(pts[j][0], pts[j][1]);
    }
  }
  context.stroke();

  context.restore();
}
