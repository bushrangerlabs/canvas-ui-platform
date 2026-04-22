import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import EditorPage from './pages/EditorPage';
import DisplayPage from './pages/DisplayPage';

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
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/editor" replace />} />
          <Route path="/editor/*" element={<EditorPage />} />
          <Route path="/display" element={<DisplayPage />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}
