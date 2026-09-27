import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useDocumentTitle } from './useDocumentTitle';

function Probe({ title }: { title: string }) {
  useDocumentTitle(title);
  return null;
}

describe('useDocumentTitle', () => {
  it('sets document.title with the shared HelpDesk suffix', () => {
    render(<Probe title="Pulpit" />);

    expect(document.title).toBe('Pulpit — HelpDesk');
  });

  it('updates document.title when the title prop changes', () => {
    const { rerender } = render(<Probe title="Zgłoszenia" />);
    expect(document.title).toBe('Zgłoszenia — HelpDesk');

    rerender(<Probe title="Zgłoszenie HD-000001" />);

    expect(document.title).toBe('Zgłoszenie HD-000001 — HelpDesk');
  });
});
