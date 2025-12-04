interface BarData {
  label: string;
  value: number;
  target: number;
  unit?: string;
}

interface ChartBarProps {
  data: BarData[];
  height?: number;
}

export default function ChartBar({ data, height = 300 }: ChartBarProps) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground text-sm"
        style={{ height }}
      >
        No data
      </div>
    );
  }
  
  const barWidth = 40;
  const barGap = 20;
  const width = data.length * (barWidth + barGap) + barGap;
  const chartHeight = height - 60;
  const maxValue = Math.max(...data.map((d) => Math.max(d.value, d.target)), 100);
  
  return (
    <div className="w-full overflow-x-auto">
      <svg width={width} height={height} className="mx-auto">
        <line
          x1={0}
          y1={chartHeight}
          x2={width}
          y2={chartHeight}
          stroke="currentColor"
          strokeWidth="1"
          className="text-border"
        />
        {data.map((item, i) => {
          const x = barGap + i * (barWidth + barGap);
          const valueHeight = (item.value / maxValue) * chartHeight;
          const targetHeight = (item.target / maxValue) * chartHeight;
          const percentage = Math.round((item.value / item.target) * 100);
          
          return (
            <g key={i}>
              <rect
                x={x}
                y={chartHeight - targetHeight}
                width={barWidth}
                height={targetHeight}
                fill="currentColor"
                className="text-muted"
                rx="4"
              />
              <rect
                x={x}
                y={chartHeight - valueHeight}
                width={barWidth}
                height={valueHeight}
                fill="currentColor"
                className="text-primary"
                rx="4"
              />
              <text
                x={x + barWidth / 2}
                y={chartHeight - valueHeight - 5}
                textAnchor="middle"
                className="text-xs font-medium fill-current"
              >
                {percentage}%
              </text>
              <text
                x={x + barWidth / 2}
                y={chartHeight + 15}
                textAnchor="middle"
                className="text-xs fill-current"
              >
                {item.label}
              </text>
              <text
                x={x + barWidth / 2}
                y={chartHeight + 30}
                textAnchor="middle"
                className="text-[10px] fill-current text-muted-foreground"
              >
                {item.value}
                {item.unit || ""}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
