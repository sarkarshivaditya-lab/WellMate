interface PieSlice {
  label: string;
  value: number;
  color: string;
}

interface ChartPieProps {
  data: PieSlice[];
  size?: number;
}

export default function ChartPie({ data, size = 200 }: ChartPieProps) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0);
  if (total === 0) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground text-sm"
        style={{ width: size, height: size }}
      >
        No data
      </div>
    );
  }
  
  let currentAngle = -90;
  const slices = data.map((slice) => {
    const percentage = slice.value / total;
    const angle = percentage * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;
    
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const radius = size / 2 - 10;
    const centerX = size / 2;
    const centerY = size / 2;
    
    const x1 = centerX + radius * Math.cos(startRad);
    const y1 = centerY + radius * Math.sin(startRad);
    const x2 = centerX + radius * Math.cos(endRad);
    const y2 = centerY + radius * Math.sin(endRad);
    
    const largeArc = angle > 180 ? 1 : 0;
    
    const pathData = [
      `M ${centerX} ${centerY}`,
      `L ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      `Z`,
    ].join(" ");
    
    return {
      ...slice,
      pathData,
      percentage: Math.round(percentage * 100),
    };
  });
  
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((slice, i) => (
          <path
            key={i}
            d={slice.pathData}
            fill={slice.color}
            stroke="white"
            strokeWidth="2"
          />
        ))}
      </svg>
      <div className="mt-4 space-y-2 w-full">
        {slices.map((slice, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: slice.color }}
              />
              <span>{slice.label}</span>
            </div>
            <span className="font-medium">
              {slice.value}g ({slice.percentage}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
