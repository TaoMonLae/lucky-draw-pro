import React from 'react';
import { motion } from 'framer-motion';
import { Button } from './ui';

export default function SettingsPanel({ showSettings, onClose, settingsTab, setSettingsTab, children }) {
  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="absolute top-0 right-0 h-full w-full max-w-md bg-[var(--panel-bg)] backdrop-blur-sm shadow-2xl z-50 border-l border-[var(--panel-border)] flex flex-col"
    >
      <div className="flex-shrink-0 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-[var(--title-color)]">Settings</h2>
          <Button onClick={onClose} style={{ backgroundColor: '#dc2626' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </Button>
        </div>
        <div className="flex border-b border-[var(--panel-border)] mb-4">
          <button className={`py-2 px-4 ${settingsTab === 'main' ? 'border-b-2 border-[var(--title-color)] text-[var(--title-color)]' : 'text-[var(--text-muted)]'}`} onClick={() => setSettingsTab('main')}>Main</button>
          <button className={`py-2 px-4 ${settingsTab === 'sound' ? 'border-b-2 border-[var(--title-color)] text-[var(--title-color)]' : 'text-[var(--text-muted)]'}`} onClick={() => setSettingsTab('sound')}>Sound</button>
          <button className={`py-2 px-4 ${settingsTab === 'about' ? 'border-b-2 border-[var(--title-color)] text-[var(--title-color)]' : 'text-[var(--text-muted)]'}`} onClick={() => setSettingsTab('about')}>About</button>
        </div>
      </div>

      <div className="flex-grow overflow-y-auto px-6 pb-6">{children}</div>
    </motion.div>
  );
}
