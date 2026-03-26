'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'

type TimeSeriesPoint = {
  date: string
  value: number
}

type Props = {
  data: TimeSeriesPoint[]
}

function formatDateLabel(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-')
    return `${Number(month)}/${Number(day)}`
  }

  const date = new Date(value)

  const month = date.getMonth() + 1
  const day = date.getDate()

  return `${month}/${day}`
}

export default function TrackerLineChart({ data }: Props) {
  if (!data || data.length === 0) {
    return null
  }

  return (
    <div style={{ width: '100%', height: 180 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />

          <XAxis
            dataKey="date"
            tickFormatter={formatDateLabel}
            minTickGap={20}
          />

          <YAxis />

          <Tooltip
            labelFormatter={(label) => formatDateLabel(String(label))}
          />

          <Line
            type="monotone"
            dataKey="value"
            stroke="rgba(0,0,0,0.7)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
