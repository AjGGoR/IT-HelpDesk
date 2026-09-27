import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmDialog } from './ConfirmDialog';

function Harness({ onConfirm, onCancel }: { onConfirm?: () => void; onCancel?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Otwórz
      </button>
      <ConfirmDialog
        open={open}
        title="Potwierdź akcję"
        message="Czy na pewno chcesz to zrobić?"
        onConfirm={() => {
          onConfirm?.();
          setOpen(false);
        }}
        onCancel={() => {
          onCancel?.();
          setOpen(false);
        }}
      />
    </div>
  );
}

describe('ConfirmDialog', () => {
  it('renders nothing when closed', () => {
    render(
      <ConfirmDialog open={false} title="Tytuł" message="Wiadomość" onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders the dialog with title and message when open', () => {
    render(<ConfirmDialog open title="Tytuł" message="Wiadomość" onConfirm={vi.fn()} onCancel={vi.fn()} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Tytuł')).toBeInTheDocument();
    expect(screen.getByText('Wiadomość')).toBeInTheDocument();
  });

  it('calls onConfirm when the confirm button is clicked', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmDialog open title="Tytuł" message="Wiadomość" onConfirm={onConfirm} onCancel={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Potwierdź' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when the cancel button is clicked', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmDialog open title="Tytuł" message="Wiadomość" onConfirm={vi.fn()} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: 'Anuluj' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Escape is pressed', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmDialog open title="Tytuł" message="Wiadomość" onConfirm={vi.fn()} onCancel={onCancel} />);

    await user.keyboard('{Escape}');

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when the backdrop is clicked', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmDialog open title="Tytuł" message="Wiadomość" onConfirm={vi.fn()} onCancel={onCancel} />);

    await user.click(screen.getByTestId('confirm-dialog-backdrop'));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('does not call onCancel when clicking inside the dialog content', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmDialog open title="Tytuł" message="Wiadomość" onConfirm={vi.fn()} onCancel={onCancel} />);

    await user.click(screen.getByText('Wiadomość'));

    expect(onCancel).not.toHaveBeenCalled();
  });

  it('traps focus inside the dialog, cycling with Tab and Shift+Tab', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('Otwórz'));

    const cancelButton = screen.getByRole('button', { name: 'Anuluj' });
    const confirmButton = screen.getByRole('button', { name: 'Potwierdź' });

    expect(cancelButton).toHaveFocus();

    await user.tab();
    expect(confirmButton).toHaveFocus();

    await user.tab();
    expect(cancelButton).toHaveFocus();

    await user.tab({ shift: true });
    expect(confirmButton).toHaveFocus();

    await user.tab({ shift: true });
    expect(cancelButton).toHaveFocus();
  });

  it('restores focus to the trigger element after confirm', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByText('Otwórz');

    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Potwierdź' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('restores focus to the trigger element after cancel', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByText('Otwórz');

    await user.click(trigger);
    await user.click(screen.getByRole('button', { name: 'Anuluj' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('restores focus to the trigger element after Escape', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByText('Otwórz');

    await user.click(trigger);
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('restores focus to the trigger element after a backdrop click', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByText('Otwórz');

    await user.click(trigger);
    await user.click(screen.getByTestId('confirm-dialog-backdrop'));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
