import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as Tone from 'tone';
import HostView from './HostView';

jest.mock('tone', () => {
  const makeNode = () => ({
    volume: { value: 0 },
    connect() { return this; },
    toDestination() { return this; },
    dispose() {},
    triggerAttackRelease() {},
    stop() {},
  });
  return {
    Volume: function Volume() { return makeNode(); },
    Filter: function Filter() { return makeNode(); },
    MembraneSynth: function MembraneSynth() { return makeNode(); },
    NoiseSynth: function NoiseSynth() { return makeNode(); },
    Player: function Player() { return makeNode(); },
    Destination: { volume: { value: 0 } },
    start: jest.fn(),
    now: jest.fn(() => 0),
  };
});

jest.mock('./LetterGlitch', () => () => null);

test('releasing the hold button during audio startup cancels the draw', async () => {
  jest.useFakeTimers();
  localStorage.clear();
  let finishAudioStart;
  Tone.start.mockImplementation(() => new Promise((resolve) => { finishAudioStart = resolve; }));

  const { unmount } = render(<HostView />);
  const drawButton = screen.getByRole('button', { name: 'Hold to Draw' });

  fireEvent.pointerDown(drawButton);
  fireEvent.pointerUp(drawButton);
  await act(async () => finishAudioStart());
  act(() => jest.advanceTimersByTime(2000));

  expect(screen.getByText('Prizes Drawn: 0 / 3')).not.toBeNull();
  expect(screen.getByRole('button', { name: 'Hold to Draw' }).disabled).toBe(false);
  unmount();
  jest.useRealTimers();
});

test('CSV import waits for review before replacing participants', async () => {
  localStorage.clear();
  Tone.start.mockResolvedValue();
  const { container } = render(<HostView />);
  fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));
  const settingsNavigation = screen.getByRole('navigation', { name: 'Settings sections' });
  fireEvent.click(settingsNavigation.querySelectorAll('button')[1]);
  fireEvent.change(screen.getByText('Participant Type').nextElementSibling, { target: { value: 'names' } });

  const csvInput = container.querySelector('input[accept=".csv,text/csv"]');
  const file = new File(['name\n"Ada, Lovelace"\nGrace Hopper\nGrace Hopper\n'], 'people.csv', { type: 'text/csv' });
  fireEvent.change(csvInput, { target: { files: [file] } });

  await waitFor(() => expect(screen.getByText('2 names ready')).not.toBeNull());
  expect(screen.getByText('Total: 50')).not.toBeNull();
  expect(screen.getByText('duplicates removed')).not.toBeNull();
  expect(screen.getByText('Using the “name” column. Header skipped.')).not.toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByText('2 names ready')).toBeNull();
  expect(screen.getByText('Total: 50')).not.toBeNull();

  fireEvent.change(csvInput, { target: { files: [file] } });
  await waitFor(() => expect(screen.getByText('2 names ready')).not.toBeNull());
  fireEvent.click(screen.getByRole('button', { name: 'Replace participants' }));
  expect(screen.getByText('Total: 2')).not.toBeNull();
  expect(screen.getByDisplayValue('Ada, Lovelace')).not.toBeNull();
});
