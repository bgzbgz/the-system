// TrendChart Component - Simple SVG line chart
// Feature: Boss Office Redesign

export interface DataPoint {
  date: string;
  value: number;
  label?: string;
}

export interface TrendChartProps {
  data: DataPoint[];
  title?: string;
  height?: number;
  showLabels?: boolean;
  showGrid?: boolean;
  lineColor?: string;
  fillColor?: string;
}

/**
 * Render a trend chart
 */
export function renderTrendChart(props: TrendChartProps): string {
  const {
    data,
    title,
    showLabels = true,
    showGrid = true,
    lineColor = 'var(--color-yellow)',
    fillColor = 'rgba(255, 244, 105, 0.2)',
  } = props;

  if (data.length < 2) {
    return `
      <div class="trend-chart trend-chart--empty">
        <p>Not enough data to display chart</p>
      </div>
    `;
  }

  const width = 100;
  const chartHeight = 100;
  const padding = { top: 10, right: 10, bottom: 20, left: 10 };

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const minValue = Math.min(...data.map((d) => d.value), 0);
  const range = maxValue - minValue || 1;

  // Generate points
  const points = data.map((d, i) => {
    const x = padding.left + (i / (data.length - 1)) * (width - padding.left - padding.right);
    const y = padding.top + (1 - (d.value - minValue) / range) * (chartHeight - padding.top - padding.bottom);
    return { x, y, data: d };
  });

  const linePoints = points.map((p) => `${p.x},${p.y}`).join(' ');

  // Area fill path
  const areaPath = `
    M ${points[0].x},${chartHeight - padding.bottom}
    L ${linePoints.split(' ').join(' L ')}
    L ${points[points.length - 1].x},${chartHeight - padding.bottom}
    Z
  `;

  // Grid lines
  const gridLines = showGrid ? generateGridLines(5, padding, width, chartHeight) : '';

  // X-axis labels (show first, middle, last)
  const xLabels = showLabels ? generateXLabels(data, padding, width, chartHeight) : '';

  return `
    <div class="trend-chart">
      ${title ? `<h4 class="trend-chart__title">${title}</h4>` : ''}
      <svg viewBox="0 0 ${width} ${chartHeight + 10}" preserveAspectRatio="xMidYMid meet" class="trend-chart__svg">
        <!-- Grid -->
        ${gridLines}

        <!-- Area fill -->
        <path
          d="${areaPath}"
          fill="${fillColor}"
          stroke="none"
        />

        <!-- Line -->
        <polyline
          points="${linePoints}"
          fill="none"
          stroke="${lineColor}"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />

        <!-- Data points -->
        ${points.map((p) => `
          <circle
            cx="${p.x}"
            cy="${p.y}"
            r="3"
            fill="${lineColor}"
            class="trend-chart__point"
            data-value="${p.data.value}"
            data-date="${p.data.date}"
          />
        `).join('')}

        <!-- X-axis labels -->
        ${xLabels}
      </svg>

      <!-- Legend -->
      <div class="trend-chart__legend">
        <span class="trend-chart__legend-min">${Math.round(minValue)}</span>
        <span class="trend-chart__legend-max">${Math.round(maxValue)}</span>
      </div>
    </div>
  `;
}

/**
 * Generate grid lines
 */
function generateGridLines(count: number, padding: { top: number; right: number; bottom: number; left: number }, width: number, height: number): string {
  const lines = [];
  for (let i = 0; i <= count; i++) {
    const y = padding.top + (i / count) * (height - padding.top - padding.bottom);
    lines.push(`
      <line
        x1="${padding.left}"
        y1="${y}"
        x2="${width - padding.right}"
        y2="${y}"
        stroke="var(--color-grey)"
        stroke-width="0.5"
        stroke-dasharray="2,2"
        opacity="0.3"
      />
    `);
  }
  return lines.join('');
}

/**
 * Generate X-axis labels
 */
function generateXLabels(data: DataPoint[], padding: { top: number; right: number; bottom: number; left: number }, width: number, height: number): string {
  if (data.length < 2) return '';

  const labels: string[] = [];
  const indices = [0, Math.floor(data.length / 2), data.length - 1];

  indices.forEach((i) => {
    const x = padding.left + (i / (data.length - 1)) * (width - padding.left - padding.right);
    const date = new Date(data[i].date);
    const label = `${date.getMonth() + 1}/${date.getDate()}`;

    labels.push(`
      <text
        x="${x}"
        y="${height + 8}"
        text-anchor="middle"
        font-size="6"
        fill="var(--color-grey)"
        font-family="var(--font-mono)"
      >${label}</text>
    `);
  });

  return labels.join('');
}

/**
 * Render a bar chart (alternative visualization)
 */
export function renderBarChart(props: TrendChartProps): string {
  const { data, title, height = 150 } = props;

  if (data.length === 0) {
    return `
      <div class="bar-chart bar-chart--empty">
        <p>No data to display</p>
      </div>
    `;
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return `
    <div class="bar-chart">
      ${title ? `<h4 class="bar-chart__title">${title}</h4>` : ''}
      <div class="bar-chart__bars" style="height: ${height}px;">
        ${data.map((d) => {
          const heightPct = (d.value / maxValue) * 100;
          return `
            <div class="bar-chart__bar-wrapper" title="${d.label || d.date}: ${d.value}">
              <div class="bar-chart__bar" style="height: ${heightPct}%;">
                <span class="bar-chart__bar-value">${Math.round(d.value)}</span>
              </div>
              <span class="bar-chart__bar-label">${d.label || formatDate(d.date)}</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}
