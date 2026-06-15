// components/insights/Recommendations.tsx

import type { TopRecommendation } from '@/types'

type Props = {
  topRecommendations: TopRecommendation[]
}

const Recommendations = ({topRecommendations}: Props) => {
  return (
    <div className = "border rounded p-4" >
      <h2 className="font-semibold mb-4">Top Recommendations</h2>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left border-b">
            <th className="py-2">Resource</th>
            <th className="py-2">Action</th>
            <th className="py-2">Current</th>
            <th className="py-2">Recommended</th>
          </tr>
        </thead>

        <tbody>
          {topRecommendations.map((item, idx) => (
            <tr key={idx} className="border-b">
              <td className="py-2">{item.resourceType}</td>
              <td className="py-2">{item.action}</td>
              <td className="py-2">{item.current}</td>
              <td className="py-2">{item.recommended}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div >
  )
}

export default Recommendations