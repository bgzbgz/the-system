// MetricCard Component - Dashboard statistics display
// Feature: Boss Office Redesign

export interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  icon?: string;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error';
}

/**
 * Render a metric card
 */
export function renderMetricCard(props: MetricCardProps): string {
  const {
    label,
    value,
    subtitle,
    trend,
    trendValue,
    icon,
    variant = 'default',
  } = props;

  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
  const trendClass = trend === 'up' ? 'trend--up' : trend === 'down' ? 'trend--down' : 'trend--stable';

  return `
    <div class="metric-card metric-card--${variant}">
      ${icon ? `<div class="metric-card__icon">${icon}</div>` : ''}
      <div class="metric-card__content">
        <span class="metric-card__value">${value}</span>
        <span class="metric-card__label">${label}</span>
        ${subtitle ? `<span class="metric-card__subtitle">${subtitle}</span>` : ''}
        ${trend ? `
          <div class="metric-card__trend ${trendClass}">
            <span class="metric-card__trend-icon">${trendIcon}</span>
            ${trendValue ? `<span class="metric-card__trend-value">${trendValue}</span>` : ''}
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Render multiple metric cards in a grid
 */
export function renderMetricGrid(cards: MetricCardProps[]): string {
  return `
    <div class="metric-grid">
      ${cards.map(renderMetricCard).join('')}
    </div>
  `;
}
