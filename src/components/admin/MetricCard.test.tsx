import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricCard } from './MetricCard';
import { Users } from 'lucide-react';

describe('MetricCard', () => {
  it('should render with basic props', () => {
    render(<MetricCard title="Test Metric" value="100" icon={Users} color="blue" />);

    expect(screen.getByText('Test Metric')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('should display positive change in green', () => {
    render(<MetricCard title="Test Metric" value="100" icon={Users} color="blue" change="+10%" />);

    const changeElement = screen.getByText('+10%');
    expect(changeElement).toHaveClass('text-green-400');
  });

  it('should display negative change in red', () => {
    render(<MetricCard title="Test Metric" value="100" icon={Users} color="blue" change="-5%" />);

    const changeElement = screen.getByText('-5%');
    expect(changeElement).toHaveClass('text-red-400');
  });

  it('should show alert indicator when alert is true', () => {
    const { container } = render(
      <MetricCard title="Test Metric" value="100" icon={Users} color="red" alert={true} />
    );

    const alertDot = container.querySelector('.animate-pulse');
    expect(alertDot).toBeInTheDocument();
  });

  it('should handle NaN value gracefully', () => {
    render(<MetricCard title="Test Metric" value={NaN} icon={Users} color="blue" />);

    expect(screen.getByText('NaN')).toBeInTheDocument();
  });

  it('should handle Infinity value gracefully', () => {
    render(<MetricCard title="Test Metric" value={Infinity} icon={Users} color="blue" />);

    expect(screen.getByText('Infinity')).toBeInTheDocument();
  });

  it('should display subtext when provided', () => {
    render(
      <MetricCard
        title="Test Metric"
        value="100"
        icon={Users}
        color="blue"
        subtext="Additional info"
      />
    );

    expect(screen.getByText('Additional info')).toBeInTheDocument();
  });

  it('should apply correct color classes', () => {
    const { container } = render(
      <MetricCard title="Test Metric" value="100" icon={Users} color="purple" />
    );

    const card = container.querySelector('.from-purple-900\\/20');
    expect(card).toBeInTheDocument();
  });
});
