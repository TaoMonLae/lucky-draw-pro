import React from 'react';
import { usePublicSync } from '../hooks/usePublicSync';

export default function PublicView() {
  const drawState = usePublicSync();

  if (!drawState) {
    return <div className="flex items-center justify-center min-h-screen bg-gray-100 text-gray-800">Waiting for draw to start...</div>;
  }

  const { title, logo, winnersHistory } = drawState;
  const vintageStyle = {
    fontFamily: "'Playfair Display', serif",
    backgroundColor: '#fdf6e3',
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
  };

  return (
    <div style={vintageStyle} className="min-h-screen p-8 text-[#3a2f2f]">
      <div className="max-w-4xl mx-auto">
        {logo && <img src={logo} alt="Event Logo" className="h-24 w-auto mx-auto mb-6" />}
        <h1 className="text-5xl font-bold text-center mb-8" style={{ fontFamily: "'Lobster', cursive" }}>{title} - Winners</h1>
        {winnersHistory.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {winnersHistory.map((group) => (
              <div key={group.prize} className="bg-white bg-opacity-50 p-6 rounded-lg shadow-lg border border-gray-300">
                <h3 className="text-3xl font-bold border-b-2 border-gray-300 pb-2 mb-4" style={{ fontFamily: "'Lobster', cursive" }}>{group.prize}</h3>
                <ul className="space-y-2">
                  {group.tickets.map((ticket) => <li key={ticket} className="font-mono text-2xl bg-gray-100 px-3 py-1 rounded">{ticket}</li>)}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-2xl mt-16">Winners will be displayed here as they are drawn...</p>
        )}
      </div>
    </div>
  );
}
