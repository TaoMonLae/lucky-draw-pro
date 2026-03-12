import React, { useEffect, useState } from 'react';
import HostView from './components/HostView';
import PublicView from './components/PublicView';

export default function App() {
  const [view, setView] = useState('host');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'public') {
      setView('public');
    }
  }, []);

  return view === 'public' ? <PublicView /> : <HostView />;
}
