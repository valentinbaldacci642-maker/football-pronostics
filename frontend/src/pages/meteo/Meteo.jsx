import { Routes, Route } from 'react-router-dom';
import MeteoSearch from './MeteoSearch';
import MeteoDashboard from './MeteoDashboard';

// Weather section router. Mounted at /meteo/* by App.jsx.
export default function Meteo() {
  return (
    <Routes>
      <Route path="/" element={<MeteoSearch />} />
      <Route path="/ville" element={<MeteoDashboard />} />
    </Routes>
  );
}
