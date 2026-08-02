import React from 'react';
import { Plus, Minus, Target } from 'lucide-react';

interface MapNavigationControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
}

export const MapNavigationControls: React.FC<MapNavigationControlsProps> = ({
  zoom,
  onZoomIn,
  onZoomOut,
  onResetView,
}) => {
  const percent = Math.round(zoom * 100);

  return (
    <div className="map-nav-controls">
      <button className="nav-btn" onClick={onZoomIn} title="Zoom In (Scroll Up)">
        <Plus size={18} />
      </button>
      
      <div className="zoom-indicator" title="Current Zoom Level">
        {percent}%
      </div>

      <button className="nav-btn" onClick={onZoomOut} title="Zoom Out (Scroll Down)">
        <Minus size={18} />
      </button>

      <div className="nav-divider" />

      <button className="nav-btn highlight" onClick={onResetView} title="Reset View & Center City">
        <Target size={18} />
      </button>
    </div>
  );
};
