// app/infrastructure/page.tsx

'use client'

import { useInfrastructureMetrics } from '@/hooks/useInfrastructureMetrics'

export default function InfrastructurePage() {
  const { data, loading, error, lastUpdated, refetch } = useInfrastructureMetrics('/api/infrastructure')

  if (loading) return <div>Loading infrastructure...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <div>
      <h1>Infrastructure Health</h1>

      <button onClick={refetch}>Refresh</button>

      <p>Last updated: {lastUpdated}</p>

      <table>
        <thead>
          <tr>
            <th>Instance</th>
            <th>CPU</th>
            <th>Memory</th>
            <th>Disk</th>
          </tr>
        </thead>

        <tbody>
          {data.map(i => (
            <tr key={i.instanceId}>
              <td>{i.name}</td>
              <td>{i.cpuUsedPercent}</td>
              <td>{i.memoryUsedPercent}</td>
              <td>{i.diskUsedPercent}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}