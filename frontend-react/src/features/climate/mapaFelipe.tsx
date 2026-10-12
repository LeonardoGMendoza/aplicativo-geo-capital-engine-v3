// Estilo do desenho do Felipe aplicado ao mapa real (OpenStreetMap): fundo verde-escuro, rios azuis,
// ruas claras e nomes claros. É um filtro SVG nas imagens do mapa: os dados continuam os mesmos do OpenStreetMap.
// Cores do OSM usadas: terreno #f2efe9 → verde-escuro; água #aad3df → azul; avenidas (amarelo/laranja) → linhas claras;
// parques → verde um pouco mais claro; textos escuros → claros.
export const FILTRO_FELIPE_ID = 'omni-mapa-felipe'
const FILTRO = `<filter id="omni-mapa-felipe" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"> <feColorMatrix in="SourceGraphic" type="matrix" values=".2126 .7152 .0722 0 0 .2126 .7152 .0722 0 0 .2126 .7152 .0722 0 0 0 0 0 1 0" result="lum"/> <feComponentTransfer in="lum" result="base"><feFuncR type="table" tableValues="0.93 0.93 0.93 0.9 0.85 0.75 0.6 0.45 0.32 0.25 0.2 0.16 0.14 0.13 0.12 0.12 0.135 0.14 0.125 0.11 0.44"/><feFuncG type="table" tableValues="0.96 0.96 0.96 0.94 0.9 0.82 0.7 0.55 0.42 0.35 0.3 0.27 0.25 0.24 0.23 0.235 0.25 0.26 0.24 0.215 0.53"/><feFuncB type="table" tableValues="0.945 0.945 0.945 0.92 0.88 0.8 0.67 0.52 0.4 0.32 0.27 0.23 0.21 0.2 0.19 0.19 0.205 0.21 0.195 0.175 0.58"/></feComponentTransfer> <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 .17 0 0 0 0 .36 0 0 0 0 .27 0 8 -8 0 -.75" result="verde"/> <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 .1 0 0 0 0 .33 0 0 0 0 .64 -8 0 8 0 -.6" result="agua"/> <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 .72 0 0 0 0 .78 0 0 0 0 .76 7 0 -7 0 -.9" result="vias"/> <feMerge><feMergeNode in="base"/><feMergeNode in="verde"/><feMergeNode in="agua"/><feMergeNode in="vias"/></feMerge> </filter>`

/** Coloque uma vez dentro do mapa; o TileLayer usa className="mapa-felipe". */
export function FiltroMapaFelipe() {
  return <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: 'absolute', width: 0, height: 0 }} dangerouslySetInnerHTML={{ __html: FILTRO }} />
}
