import React from 'react';
import { render, screen } from '@testing-library/react';
import AboutPanel from './AboutPanel';

describe('AboutPanel', () => {
  test('summarizes the current live-event capabilities', () => {
    render(<AboutPanel />);

    expect(screen.getByRole('heading', { name: 'Lucky Draw Pro' })).toBeTruthy();
    expect(screen.getByText('v2.1.0')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Live audience view' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Secure MC remote' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Show-ready finale' })).toBeTruthy();
    expect(screen.getByText(/Winner selection and eligibility checks stay on the host computer/i)).toBeTruthy();
    expect(screen.getByText('Tao Mon Lae')).toBeTruthy();
    expect(screen.getByRole('link', { name: /GitHub profile/i })).toMatchObject({
      href: 'https://github.com/TaoMonLae',
      target: '_blank',
      rel: 'noopener noreferrer',
    });
  });
});
