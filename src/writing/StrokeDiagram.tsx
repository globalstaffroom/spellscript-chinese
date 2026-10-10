import type { StrokeJson } from '../content/types';

/** Static drawing with each stroke numbered at its start, in Make Me a Hanzi coordinates (y up, baseline -124). */
export function StrokeDiagram({ data, size }: { data: StrokeJson; size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 1024 1024" role="img" aria-label="筆順圖">
      <g transform="translate(0, 900) scale(1, -1)">
        {data.strokes.map((d, i) => <path key={i} d={d} fill={`hsl(${(i * 47) % 360} 60% 45%)`} opacity={0.85} />)}
      </g>
      {data.medians.map((m, i) => {
        const [x, y] = m[0]!;
        return <text key={i} x={x} y={900 - y!} fontSize="64" fontWeight="700" fill="#000" stroke="#fff" strokeWidth="10" paintOrder="stroke">{i + 1}</text>;
      })}
    </svg>
  );
}
