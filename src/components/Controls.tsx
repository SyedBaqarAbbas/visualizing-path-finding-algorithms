import React, { useState } from 'react';
import { AlgorithmType, AlgorithmInfo } from '../types/graph';
import { ALGORITHMS_INFO } from './HUD';
import {
  Play,
  Pause,
  RotateCcw,
  Shuffle,
  Video,
  Film,
  HelpCircle,
  Smartphone,
  Maximize2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ControlsProps {
  selectedAlgorithm: AlgorithmType;
  onSelectAlgorithm: (alg: AlgorithmType) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onReset: () => void;
  onRandomizePoints: () => void;
  onStartAutoShowcase: () => void;
  isAutoShowcaseRunning: boolean;
  isRecording: boolean;
  onToggleRecord: () => void;
  durationMs: number;
  onChangeDuration: (dur: number) => void;
  onOpenInfo: () => void;
  isMobileFrame: boolean;
  onToggleMobileFrame: () => void;
}

export const Controls: React.FC<ControlsProps> = ({
  selectedAlgorithm,
  onSelectAlgorithm,
  isPlaying,
  onTogglePlay,
  onReset,
  onRandomizePoints,
  onStartAutoShowcase,
  isAutoShowcaseRunning,
  isRecording,
  onToggleRecord,
  durationMs,
  onChangeDuration,
  onOpenInfo,
  isMobileFrame,
  onToggleMobileFrame,
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const algorithmsList: AlgorithmInfo[] = Object.values(ALGORITHMS_INFO);
  const currentAlgInfo = ALGORITHMS_INFO[selectedAlgorithm];

  if (isCollapsed) {
    return (
      <div className="controls-collapsed-pill">
        <button
          className="collapsed-expand-btn"
          onClick={() => setIsCollapsed(false)}
          title="Expand Control Panel"
        >
          <ChevronUp size={18} />
          <span className="collapsed-title">{currentAlgInfo.name}</span>
        </button>

        <div className="collapsed-actions">
          <button
            className="collapsed-play-btn"
            onClick={onTogglePlay}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="controls-container">
      {/* Collapse Handle Header */}
      <div className="controls-header">
        <span className="controls-header-title">Control Panel</span>
        <button
          className="collapse-icon-btn"
          onClick={() => setIsCollapsed(true)}
          title="Collapse Control Panel for Unobstructed Map View"
        >
          <ChevronDown size={18} />
        </button>
      </div>

      {/* Top row: Algorithm selection tabs */}
      <div className="algorithm-tabs">
        {algorithmsList.map((alg) => {
          const isActive = selectedAlgorithm === alg.id;
          return (
            <button
              key={alg.id}
              className={`tab-btn ${isActive ? 'active' : ''} ${alg.category}`}
              onClick={() => onSelectAlgorithm(alg.id)}
              title={alg.description}
            >
              {alg.name}
            </button>
          );
        })}
      </div>

      {/* Main control toolbar */}
      <div className="toolbar">
        <div className="tool-group main-actions">
          <button
            className="action-btn play-btn"
            onClick={onTogglePlay}
            title={isPlaying ? 'Pause Animation' : 'Start Pathfinding Animation'}
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            <span>{isPlaying ? 'Pause' : 'Run Path'}</span>
          </button>

          <button className="action-btn secondary" onClick={onReset} title="Reset Canvas">
            <RotateCcw size={16} />
            <span>Reset</span>
          </button>

          <button
            className="action-btn secondary"
            onClick={onRandomizePoints}
            title="Randomize Start & Destination"
          >
            <Shuffle size={16} />
            <span>Randomize</span>
          </button>
        </div>

        <div className="tool-group showcase-actions">
          <button
            className={`action-btn showcase-btn ${isAutoShowcaseRunning ? 'active' : ''}`}
            onClick={onStartAutoShowcase}
            title="Play full 30-second sequence of all algorithms"
          >
            <Film size={16} />
            <span>30s Showcase</span>
          </button>

          <button
            className={`action-btn record-btn ${isRecording ? 'recording' : ''}`}
            onClick={onToggleRecord}
            title="Record HTML Canvas to 30s WebM Video"
          >
            <Video size={16} />
            <span>{isRecording ? 'Recording...' : 'Record Video'}</span>
          </button>
        </div>

        <div className="tool-group settings-actions">
          <div className="duration-slider-container">
            <label>Speed:</label>
            <input
              type="range"
              min={1000}
              max={10000}
              step={500}
              value={durationMs}
              onChange={(e) => onChangeDuration(Number(e.target.value))}
            />
            <span className="duration-val">{(durationMs / 1000).toFixed(1)}s</span>
          </div>

          <button
            className="icon-btn"
            onClick={onToggleMobileFrame}
            title={isMobileFrame ? 'Switch to Fullscreen Canvas' : 'Switch to 9:16 Mobile Frame'}
          >
            {isMobileFrame ? <Maximize2 size={18} /> : <Smartphone size={18} />}
          </button>

          <button className="icon-btn" onClick={onOpenInfo} title="Algorithm Details & Info">
            <HelpCircle size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
