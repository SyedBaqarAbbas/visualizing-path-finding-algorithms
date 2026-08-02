import React from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { ALGORITHMS_INFO } from './HUD';

interface AlgorithmInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AlgorithmInfoModal: React.FC<AlgorithmInfoModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Info size={22} className="info-icon" />
            <h3>Pathfinding Algorithms Reference</h3>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div className="info-grid">
            {Object.values(ALGORITHMS_INFO).map((alg) => (
              <div key={alg.id} className="info-card">
                <div className="card-header">
                  <h4>{alg.name}</h4>
                  {alg.isOptimal ? (
                    <span className="badge optimal">
                      <CheckCircle size={12} /> Optimal
                    </span>
                  ) : (
                    <span className="badge non-optimal">
                      <AlertCircle size={12} /> Heuristic / Traversal
                    </span>
                  )}
                </div>

                <p className="card-desc">{alg.description}</p>

                <div className="card-specs">
                  <div className="spec">
                    <span className="spec-label">Time:</span>
                    <code>{alg.timeComplexity}</code>
                  </div>
                  <div className="spec">
                    <span className="spec-label">Space:</span>
                    <code>{alg.spaceComplexity}</code>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="info-footer-note">
            <p>
              <strong>Note on Traversal vs Shortest Path:</strong> Breadth-First Search (BFS) treats all road segments as having unit weight, while Depth-First Search (DFS) explores branch paths non-optimally. Dijkstra, A*, and Bidirectional Dijkstra enforce exact edge distance weights in meters.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
