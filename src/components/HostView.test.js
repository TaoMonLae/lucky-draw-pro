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

const readSession = () => JSON.parse(localStorage.getItem('lucky-draw-autosave'));
const openDrawSettings = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));
  fireEvent.click(screen.getByRole('navigation', { name: 'Settings sections' }).querySelectorAll('button')[1]);
};
const savedSession = (overrides = {}) => ({
  initialEntries: ['01', '02', '03'], remainingEntries: ['02', '03'],
  prizes: [{ id: 1, name: 'First' }, { id: 2, name: 'Second' }, { id: 3, name: 'Final' }],
  winnersHistory: [{ prize: 'First', tickets: ['01'] }],
  auditLog: [{ id: 1, mode: 'standard', context: 'First', selected: ['01'], timestamp: '2026-10-01T00:00:00Z' }],
  ...overrides,
});

beforeEach(() => {
  localStorage.clear();
  Tone.start.mockReset().mockResolvedValue();
  Object.defineProperty(window, 'crypto', {
    configurable: true,
    value: { getRandomValues: (values) => values.fill(0) },
  });
});
afterEach(() => { jest.useRealTimers(); });

test('focusing and leaving an unchanged participant preserves recorded results', () => {
  localStorage.setItem('lucky-draw-autosave', JSON.stringify(savedSession()));
  render(<HostView />);
  openDrawSettings();
  fireEvent.blur(screen.getByDisplayValue('02'));
  expect(readSession().winnersHistory).toHaveLength(1);
  expect(readSession().auditLog).toHaveLength(1);
  expect(readSession().remainingEntries).toEqual(['02', '03']);
  expect(screen.getByRole('button', { name: 'Remove First' }).disabled).toBe(true);
  expect(screen.getByRole('button', { name: 'Remove Second' }).disabled).toBe(false);
});

test('participant edits and removal preserve names containing commas and quotes', () => {
  localStorage.setItem('lucky-draw-autosave', JSON.stringify({
    initialEntries: ['Ada, Lovelace', 'Grace "Amazing" Hopper'], drawMode: 'names',
  }));
  render(<HostView />);
  openDrawSettings();
  fireEvent.blur(screen.getByDisplayValue('Ada, Lovelace'), { target: { value: 'Ada, Byron' } });
  expect(readSession().initialEntries).toEqual(['Ada, Byron', 'Grace "Amazing" Hopper']);
  fireEvent.click(screen.getByDisplayValue('Grace "Amazing" Hopper').parentElement.querySelector('button'));
  fireEvent.click(screen.getByRole('button', { name: 'Set', exact: true }));
  expect(readSession().initialEntries).toEqual(['Ada, Byron']);
});

test('removing the final participant clears results and audit history', () => {
  localStorage.setItem('lucky-draw-autosave', JSON.stringify(savedSession({ initialEntries: ['01'], remainingEntries: [] })));
  render(<HostView />);
  openDrawSettings();
  fireEvent.click(screen.getAllByDisplayValue('01').at(-1).parentElement.querySelector('button'));
  expect(readSession().initialEntries).toEqual([]);
  expect(readSession().winnersHistory).toEqual([]);
  expect(readSession().auditLog).toEqual([]);
});

test('restoring a legacy session does not reintroduce removed winners', () => {
  localStorage.setItem('lucky-draw-autosave', JSON.stringify(savedSession({ remainingEntries: undefined })));
  render(<HostView />);
  expect(readSession().remainingEntries).toEqual(['02', '03']);
});

test('audio previews unlock the audio context', async () => {
  render(<HostView />);
  fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));
  fireEvent.click(screen.getByRole('navigation', { name: 'Settings sections' }).querySelectorAll('button')[2]);
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Drumroll' })));
  expect(Tone.start).toHaveBeenCalledTimes(1);
});

async function runDraw(duration = 6000) {
  await act(async () => fireEvent.keyDown(window, { key: ' ', code: 'Space' }));
  await act(async () => jest.advanceTimersByTime(duration));
}

test('numeric draw, undo and participant replacement clear locked winner digits', async () => {
  jest.useFakeTimers();
  render(<HostView />);
  await runDraw();
  expect(readSession().winnersHistory).toHaveLength(1);
  expect(document.querySelectorAll('.draw-console__reel--static').length).toBe(2);
  fireEvent.click(screen.getByTitle('Show History & Audit'));
  fireEvent.click(screen.getByRole('button', { name: 'Undo Last' }));
  expect(readSession().winnersHistory).toHaveLength(0);
  expect(readSession().remainingEntries).toHaveLength(50);
  expect(document.querySelectorAll('.draw-console__reel--static')).toHaveLength(0);
  await runDraw();
  openDrawSettings();
  fireEvent.click(screen.getByRole('button', { name: 'Set', exact: true }));
  expect(document.querySelectorAll('.draw-console__reel--static')).toHaveLength(0);
  expect(readSession().auditLog).toHaveLength(0);
});

test('draw settings stay locked while audio startup is pending', async () => {
  let finishStart;
  Tone.start.mockImplementation(() => new Promise((resolve) => { finishStart = resolve; }));
  render(<HostView />);
  fireEvent.keyDown(window, { key: ' ', code: 'Space' });
  openDrawSettings();
  expect(screen.getByRole('button', { name: 'Set', exact: true }).disabled).toBe(true);
  await act(async () => finishStart());
});

test.each(['team-divider', 'role-selector'])('%s respects no-repeat eligibility and undo', async (operationMode) => {
  jest.useFakeTimers();
  localStorage.setItem('lucky-draw-autosave', JSON.stringify({
    initialEntries: ['Alice', 'Bob', 'Carol'], drawMode: 'names', operationMode,
    noRepeatAcrossPrizes: true, roleConfigText: 'Host:1\nJudge:2',
  }));
  render(<HostView />);
  await runDraw(2000);
  const session = readSession();
  expect(session.auditLog).toHaveLength(1);
  expect(new Set(session.auditLog[0].selected).size).toBe(3);
  expect(session.lastAssignmentResult.mode).toBe(operationMode);
  expect(screen.getByRole('button', { name: 'Run Assignment' }).disabled).toBe(true);
  fireEvent.click(screen.getByTitle('Show History & Audit'));
  fireEvent.click(screen.getByRole('button', { name: 'Undo Last' }));
  expect(readSession().auditLog).toEqual([]);
  expect(readSession().lastAssignmentResult).toBeNull();
  expect(screen.getByRole('button', { name: 'Run Assignment' }).disabled).toBe(false);
});

test('name draws keep winners in the pool while no-repeat blocks reselection', async () => {
  jest.useFakeTimers();
  localStorage.setItem('lucky-draw-autosave', JSON.stringify({
    initialEntries: ['Alice', 'Bob'], drawMode: 'names', winnersPerPrize: 2,
    winnerEligibilityMode: 'keep', noRepeatAcrossPrizes: true,
  }));
  render(<HostView />);
  await runDraw();
  await act(async () => jest.advanceTimersByTime(6000));
  expect(readSession().winnersHistory[0].tickets.sort()).toEqual(['Alice', 'Bob']);
  expect(readSession().remainingEntries).toEqual(['Alice', 'Bob']);
  expect(screen.getByRole('button', { name: 'Hold to Draw' }).disabled).toBe(true);
});
