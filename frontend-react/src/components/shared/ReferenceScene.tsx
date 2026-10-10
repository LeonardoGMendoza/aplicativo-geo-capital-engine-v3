import referenceImage from '@/assets/design-reference.png'

// Fotografia da referência fornecida enquadrada via SVG, sem alterar o arquivo original.
// Rótulos LIVE, números, logo e controles da captura não são usados como interface.
const frames = {
  camera: '1117 158 255 104', panorama: '843 67 240 113',
  bridge: '1233 480 79 58', river: '1327 480 79 58', district: '1421 480 79 58',
}
export function ReferenceScene({ variant = 'camera', className = '' }: { variant?: keyof typeof frames; className?: string }) {
  return <svg viewBox={frames[variant]} preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true"><image href={referenceImage} width="1536" height="1024" /></svg>
}
