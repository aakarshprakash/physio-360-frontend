import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Badge, Button, ConfirmDialog, Field, Input, Pagination, Segmented, StatCard } from '../index';

describe('ui components', () => {
  it('Field wires label, error and description for assistive tech', () => {
    render(
      <Field label="Phone" error="Invalid phone" hint="With country code" required>
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText(/phone/i);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-required', 'true');
    expect(input).toHaveAccessibleDescription('Invalid phone');
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid phone');
  });

  it('Button shows a busy state and blocks clicks while loading', async () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('ConfirmDialog runs the async action and closes', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<ConfirmDialog trigger={<Button>Void</Button>} title="Void invoice?" confirmLabel="Yes, void" onConfirm={onConfirm} />);

    await userEvent.click(screen.getByRole('button', { name: 'Void' }));
    expect(screen.getByRole('alertdialog', { name: 'Void invoice?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Yes, void' }));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('Segmented behaves as a radio group', async () => {
    const onChange = vi.fn();
    render(<Segmented label="View" value="week" onChange={onChange} options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }]} />);
    expect(screen.getByRole('radio', { name: 'Week' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('radio', { name: 'Day' }));
    expect(onChange).toHaveBeenCalledWith('day');
  });

  it('Pagination hides itself for a single page and pages otherwise', async () => {
    const { rerender } = render(<Pagination page={1} lastPage={1} onChange={() => {}} />);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();

    const onChange = vi.fn();
    rerender(<Pagination page={1} lastPage={3} onChange={onChange} />);
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('StatCard shows direction of change with text, not colour alone', () => {
    render(<StatCard label="Revenue" value="₹1.4L" icon={<span />} change={-12.5} changeLabel="vs last month" />);
    expect(screen.getByText(/-12.5%/)).toBeInTheDocument();
    render(<Badge tone="success">Paid</Badge>);
    expect(screen.getByText('Paid')).toBeInTheDocument();
  });
});

describe('avatar colours', () => {
  it('always meets 4.5:1 for initials, even for user-picked mid-tones', async () => {
    const { avatarColors } = await import('./data');
    const lum = (h: string) => {
      const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const ratio = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
    for (const input of ['#3E8E76', '#E0A030', '#65A995', '#4C7BD9', '#FFFFFF', '#000000', '#2B9AA8']) {
      const { bg, fg } = avatarColors(input);
      expect(ratio(bg, fg)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
