import { fireEvent, render, screen } from '@testing-library/react';

import { Section } from './Section';

describe('Section', () => {
  test('renders title, actions, and children when not collapsible', () => {
    render(
      <Section title="Goal" actions={<button>action</button>}>
        <div>content</div>
      </Section>,
    );

    expect(screen.getByText('Goal')).toBeInTheDocument();
    expect(screen.getByText('action')).toBeInTheDocument();
    expect(screen.getByText('content')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Collapse Goal' })).toBeNull();
  });

  test('expanded collapsible shows children and a collapse button', () => {
    render(
      <Section title="Goal" collapsible collapsed={false} onToggle={vi.fn()}>
        <div>content</div>
      </Section>,
    );

    expect(screen.getByText('content')).toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'Collapse Goal' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  test('collapsed hides children and actions, shows summary', () => {
    render(
      <Section
        title="Goal"
        collapsible
        collapsed
        onToggle={vi.fn()}
        summary="10 minutes"
        actions={<button>action</button>}
      >
        <div>content</div>
      </Section>,
    );

    expect(screen.queryByText('content')).toBeNull();
    expect(screen.queryByText('action')).toBeNull();
    expect(screen.getByText('10 minutes')).toBeInTheDocument();
  });

  test('both the chevron and the header button fire onToggle', () => {
    const onToggle = vi.fn();
    render(
      <Section
        title="Goal"
        collapsible
        collapsed
        onToggle={onToggle}
        summary="10 minutes"
      >
        <div>content</div>
      </Section>,
    );

    const [header, chevron] = screen.getAllByRole('button', {
      name: 'Expand Goal',
    });
    fireEvent.click(header);
    fireEvent.click(chevron);
    expect(onToggle).toHaveBeenCalledTimes(2);
  });
});
