import React from 'react';
import { Button, Input } from './ui';

export default function PrizeEditor({ prizes, setPrizes, winnersPerPrize, setWinnersPerPrize, drawing }) {
  return (
    <>
      <div>
        <label className="font-semibold text-sm mb-1 block">Prizes</label>
        {prizes.map((prize, index) => (
          <div key={prize.id} className="flex items-center gap-2 mb-2">
            <Input
              type="text"
              value={prize.name}
              onChange={(e) => {
                const newPrizes = [...prizes];
                newPrizes[index].name = e.target.value;
                setPrizes(newPrizes);
              }}
              className="w-full bg-[var(--input-bg)] border-[var(--panel-border)]"
            />
            <Button onClick={() => setPrizes(prizes.filter((p) => p.id !== prize.id))} className="!bg-red-600 text-xs !p-2">X</Button>
          </div>
        ))}
        <Button onClick={() => setPrizes([...prizes, { id: Date.now(), name: 'New Prize' }])} className="w-full text-sm !bg-gray-600 hover:!bg-gray-700">Add Prize</Button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="winners-per-prize" className="font-semibold text-sm mb-1 block">Winners per Prize</label>
          <Input id="winners-per-prize" type="number" value={winnersPerPrize} onChange={(e) => setWinnersPerPrize(Math.max(1, parseInt(e.target.value, 10) || 1))} className="w-full bg-[var(--input-bg)] border-[var(--panel-border)]" disabled={drawing} min="1" />
        </div>
      </div>
    </>
  );
}
