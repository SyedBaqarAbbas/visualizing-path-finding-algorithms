import React, { useState } from 'react';
import { Search, MapPin, Upload, X, Loader2, Globe } from 'lucide-react';
import { geocodeCity, fetchCityGraphFromOSM } from '../services/osmFetcher';
import { CityGraph } from '../types/graph';

interface CitySelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCityGraph: (graph: CityGraph) => void;
}

const PRESET_CITIES = [
  { name: 'Berlin', country: 'Germany', lat: 52.52, lon: 13.405, isBuiltIn: true },
  { name: 'Lahore', country: 'Pakistan', lat: 31.5204, lon: 74.3587, isBuiltIn: false },
  { name: 'London', country: 'United Kingdom', lat: 51.5074, lon: -0.1278, isBuiltIn: false },
  { name: 'New York', country: 'United States', lat: 40.7128, lon: -74.006, isBuiltIn: false },
  { name: 'Tokyo', country: 'Japan', lat: 35.6762, lon: 139.6503, isBuiltIn: false },
  { name: 'Paris', country: 'France', lat: 48.8566, lon: 2.3522, isBuiltIn: false },
];

export const CitySelectorModal: React.FC<CitySelectorModalProps> = ({
  isOpen,
  onClose,
  onSelectCityGraph,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingCityName, setLoadingCityName] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFetchCity = async (cityName: string, lat?: number, lon?: number) => {
    setLoading(true);
    setLoadingCityName(cityName);
    setErrorMessage(null);

    try {
      let targetLat = lat;
      let targetLon = lon;
      let displayName = cityName;

      if (targetLat === undefined || targetLon === undefined) {
        const geo = await geocodeCity(cityName);
        targetLat = geo.lat;
        targetLon = geo.lon;
        displayName = geo.name;
      }

      const graph = await fetchCityGraphFromOSM(displayName, targetLat, targetLon);
      onSelectCityGraph(graph);
      setLoading(false);
      onClose();
    } catch (err: any) {
      console.error('Failed to fetch custom city map:', err);
      setErrorMessage(err.message || 'Failed to fetch map data for this city.');
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    handleFetchCity(searchQuery.trim());
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setLoadingCityName(file.name);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed: CityGraph = JSON.parse(event.target?.result as string);
        if (!parsed.nodes || !parsed.edges) {
          throw new Error('Invalid city graph file format. Missing nodes or edges.');
        }
        onSelectCityGraph(parsed);
        setLoading(false);
        onClose();
      } catch (err: any) {
        setErrorMessage(`JSON parse error: ${err.message}`);
        setLoading(false);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content city-selector-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Globe size={22} />
            <h3>Load Custom City Map</h3>
          </div>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Search Box */}
          <form className="city-search-form" onSubmit={handleSearchSubmit}>
            <div className="search-input-wrapper">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder="Search any city in the world (e.g. Lahore, Tokyo, New York)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={loading}
              />
            </div>
            <button type="submit" className="action-btn play-btn search-btn" disabled={loading}>
              {loading ? <Loader2 size={16} className="spin" /> : 'Fetch Map'}
            </button>
          </form>

          {errorMessage && <div className="error-banner">{errorMessage}</div>}

          {loading && (
            <div className="loading-state">
              <Loader2 size={32} className="spin" style={{ color: '#29C7FF' }} />
              <p>Fetching OpenStreetMap road network for <strong>{loadingCityName}</strong>...</p>
              <span className="loading-subtext">Converting geometry into NetworkX graph nodes & edges</span>
            </div>
          )}

          {!loading && (
            <>
              {/* Preset Cities */}
              <div className="preset-cities-section">
                <h4>Popular Preset Cities</h4>
                <div className="preset-grid">
                  {PRESET_CITIES.map((city) => (
                    <button
                      key={city.name}
                      className="preset-city-card"
                      onClick={() => handleFetchCity(city.name, city.lat, city.lon)}
                    >
                      <MapPin size={16} className="pin-icon" />
                      <div className="preset-info">
                        <span className="city-name">{city.name}</span>
                        <span className="country-name">{city.country}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Upload Local JSON */}
              <div className="upload-section">
                <h4>Upload Local Graph JSON</h4>
                <label className="file-upload-label">
                  <Upload size={18} />
                  <span>Choose custom `.json` file from computer</span>
                  <input type="file" accept=".json" onChange={handleFileUpload} />
                </label>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
