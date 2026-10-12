import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Agora } from '../data/complementares'

/** Mesmo gráfico do Felipe (recharts, passar o mouse mostra o valor), com a previsão real das próximas 24 h. */
export default function RealTimeline({ horas }: { horas: Agora['horas'] }) {
  const dados = horas.map(h => ({ hora: h.hora, chuva: h.chuva ?? 0, temperatura: h.temperatura }))
  const maxChuva = Math.max(...dados.map(d => d.chuva))
  const temps = dados.map(d => d.temperatura).filter((t): t is number => t !== null)
  const descricao = `Próximas 24 horas: chuva até ${maxChuva.toLocaleString('pt-BR')} mm por hora, temperatura de ${Math.round(Math.min(...temps))} a ${Math.round(Math.max(...temps))} °C`
  return <div className="h-full w-full" role="img" aria-label={descricao}><ResponsiveContainer width="100%" height="100%" minWidth={0}>
    <ComposedChart data={dados} margin={{ top: 8, right: 0, left: -25, bottom: 0 }}>
      <CartesianGrid stroke="#24506b" vertical={false} />
      <XAxis dataKey="hora" interval={5} tick={{ fill: '#b2d7e9', fontSize: 12 }} tickLine={false} axisLine={false} />
      <YAxis yAxisId="chuva" domain={[0, (max: number) => Math.max(4, Math.ceil(max))]} tick={{ fill: '#b2d7e9', fontSize: 12 }} tickLine={false} axisLine={false} />
      <YAxis yAxisId="temp" orientation="right" hide domain={['dataMin - 2', 'dataMax + 2']} />
      <Tooltip contentStyle={{ background: '#062e46', color: '#ecf8ff', borderColor: '#217fa3', fontSize: 12 }} cursor={{ stroke: '#e8f7ff', strokeWidth: 1 }}
        labelFormatter={value => `Previsão · ${value}`}
        formatter={(value, nome) => nome === 'chuva' ? [`${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mm`, 'Chuva'] : [`${Math.round(Number(value))} °C`, 'Temperatura']} />
      <Bar yAxisId="chuva" dataKey="chuva" fill="#23cde5" fillOpacity={0.75} radius={[2, 2, 0, 0]} isAnimationActive={false} />
      <Line yAxisId="temp" type="monotone" dataKey="temperatura" stroke="#f5a016" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#e8f7ff' }} isAnimationActive={false} />
    </ComposedChart>
  </ResponsiveContainer></div>
}
