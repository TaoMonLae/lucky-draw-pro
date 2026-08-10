import React from 'react';
import HostView from './components/HostView';
import PublicView from './components/PublicView';
import { getPublicRoomId } from './utils/publicViewUrl';

export default function App() {
  const params = new URLSearchParams(window.location.search);
  return params.get('view') === 'public'
    ? <PublicView roomId={getPublicRoomId(window.location.href)} />
    : <HostView />;
}
