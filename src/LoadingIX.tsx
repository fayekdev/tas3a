export default function LoadingIX({label='Loading…',inline=false}:{label?:string;inline?:boolean}){
  return <span className={`ix-loader ${inline?'ix-loader-inline':''}`} role="status" aria-label={label}>
    <svg viewBox="0 0 80 72" fill="none" aria-hidden="true">
      <g className="ix-loader-guide"><path d="M10 12h20M20 12v48M10 60h20M42 12l28 48M70 12 42 60"/></g>
      <g className="ix-loader-strokes"><path pathLength="1" d="M10 12h20"/><path pathLength="1" d="M20 12v48"/><path pathLength="1" d="M10 60h20"/><path pathLength="1" d="M42 12l28 48"/><path pathLength="1" d="M70 12 42 60"/></g>
    </svg>
    {!inline&&<span className="ix-loader-label" aria-hidden="true">{label}</span>}
  </span>;
}
