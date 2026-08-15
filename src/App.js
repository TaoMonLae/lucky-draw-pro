import React from 'react';
import HostView from './components/HostView';
import PublicView from './components/PublicView';
import RemoteControlView from './components/RemoteControlView';
import { getPublicRoomId } from './utils/publicViewUrl';
import { getRemoteControlCredentials } from './utils/remoteControl';

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  if (view === 'public') return <PublicView roomId={getPublicRoomId(window.location.href)} />;
  if (view === 'remote') return <RemoteControlView credentials={getRemoteControlCredentials(window.location.href)} />;
  return <HostView />;
}
