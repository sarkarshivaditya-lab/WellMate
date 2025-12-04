interface MiniLineChartProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}

export default function MiniLineChart({
  data,
  width = 300,
  height = 80,
  color = "#10b981",
}: MiniLineChartProps) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-secondary/50 rounded-lg"
        style={{ width, height }}
      >
        <p className="text-sm text-muted-foreground">No data yet</p>
      </div>
    );
  }

  const padding = 10;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const min = Math.min(...data, 1);
  const max = Math.max(...data, 5);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1 || 1)) * chartWidth;
    const y = padding + chartHeight - ((value - min) / range) * chartHeight;
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(" L ")}`;

  // Create area fill
  const firstPoint = points[0].split(",");
  const lastPoint = points[points.length - 1].split(",");
  const areaD = `${pathD} L ${lastPoint[0]},${height - padding} L ${firstPoint[0]},${height - padding} Z`;

  return (
    <svg width={width} height={height} className="bg-secondary/30 rounded-lg">
      {/* Area fill */}
      <path
        d={areaD}
        fill={color}
        fillOpacity="0.1"
      />
      
      {/* Line */}
      <path
        d={pathD}
        stroke={color}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Points */}
      {points.map((point, index) => {
        const [x, y] = point.split(",").map(Number);
        return (
          <circle
            key={index}
            cx={x}
            cy={y}
            r="3"
            fill={color}
            stroke="white"
            strokeWidth="2"
          />
        );
      })}
    </svg>
  );
}
