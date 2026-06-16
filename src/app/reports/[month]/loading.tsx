// app/reports/\[month\]/loading.tsx

const Loading = () => {
  return (
    <div className="p-10 animate-pulse space-y-6">
      <div className="h-8 bg-gray-200 w-1/3" />
      <div className="h-4 bg-gray-200 w-1/2" />
      <div className="grid grid-cols-3 gap-4">
        <div className="h-20 bg-gray-200" />
        <div className="h-20 bg-gray-200" />
        <div className="h-20 bg-gray-200" />
      </div>
    </div>
  )
}

export default Loading