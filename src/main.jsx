import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/fraunces/600.css';
import '@fontsource/fraunces/700.css';
import '@fontsource/hanken-grotesk/400.css';
import '@fontsource/hanken-grotesk/500.css';
import '@fontsource/hanken-grotesk/600.css';
import './styles/global.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(<App />);
