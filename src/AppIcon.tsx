export default function AppIcon({size=28}:{size?:number}) {
  return <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true" className="app-icon">
    <path d="M14 4h36l10 10v36L50 60H14L4 50V14Z" fill="#d8b66a"/>
    <path d="M14 17h14v5h-4v20h4v5H14v-5h4V22h-4Z" fill="#172438"/>
    <path d="m31 17 20 30m0-30L31 47" stroke="#172438" strokeWidth="6"/>
  </svg>;
}
