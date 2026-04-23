import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { HAEntitiesProvider } from './context/HAEntitiesContext';
import EditorPage from './pages/EditorPage';
import DisplayPage from './pages/DisplayPage';
import DevicesPage from './pages/DevicesPage';
import SettingsPage from './pages/SettingsPage';

// When served through HA ingress the path is /api/hassio_ingress/<token>/...
// Extract that prefix as the router basename so React Router sees clean paths.
function getBasename(): string {
  const match = window.location.pathname.match(/^(\/api\/hassio_ingress\/[^/]+)/);
  return match ? match[1] : '';
}

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#6c63ff' },
    secondary: { main: '#ff6584' },
    background: {
      default: '#0d0d1a',
      paper: '#161628',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", sans-serif',
  },
});

export default function App() {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <HAEntitiesProvider>
        <BrowserRouter basename={getBasename()}>
          <Routes>
            <Route path="/" element={<Navigate to="/editor" replace />} />
            <Route path="/editor/*" element={<EditorPage />} />
            <Route path="/display" element={<DisplayPage />} />
            <Route path="/devices" element={<DevicesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </BrowserRouter>
      </HAEntitiesProvider>
    </ThemeProvider>
  );
}
