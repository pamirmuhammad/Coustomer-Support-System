// Props for the SkeletonLoader component – controls which skeleton layout to render
interface SkeletonLoaderProps {
  type?: 'stats' | 'chart' | 'table' | 'title' | 'full' | 'recent';
}

// Skeleton loading placeholder component – renders shimmer placeholders for stats, chart, table, title, recent, or full-page layouts
export default function SkeletonLoader({ type = 'full' }: SkeletonLoaderProps) {
  const shimmer = `
    @keyframes shimmer {
      0% {
        background-position: -1000px 0;
      }
      100% {
        background-position: 1000px 0;
      }
    }
    .animate-shimmer {
      animation: shimmer 2s infinite linear;
      background: linear-gradient(to right, #f1f5f9 4%, #e2e8f0 25%, #f1f5f9 36%);
      background-size: 1000px 100%;
    }
  `;

  return (
    <>
      <style>{shimmer}</style>
      {type === 'title' && (
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl animate-shimmer"></div>
          <div className="h-8 w-48 rounded animate-shimmer"></div>
        </div>
      )}

      {type === 'stats' && (
        <div className="flex gap-3 w-full flex-wrap lg:flex-nowrap">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-1 bg-white rounded-xl shadow-md border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg animate-shimmer"></div>
                <div className="h-4 w-16 rounded animate-shimmer"></div>
              </div>
              <div className="h-8 w-20 rounded animate-shimmer"></div>
              <div className="h-3 w-24 rounded animate-shimmer mt-2"></div>
            </div>
          ))}
        </div>
      )}

      {type === 'chart' && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 flex flex-col" style={{ height: '460px', minHeight: '350px' }}>
          <div className="flex items-center gap-3 px-6 py-4">
            <div className="w-10 h-10 rounded-lg animate-shimmer"></div>
            <div className="h-6 w-40 rounded animate-shimmer"></div>
          </div>
          <div className="flex-1 p-6 animate-shimmer" style={{ minHeight: '280px' }}></div>
        </div>
      )}

      {type === 'table' && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
          <div className="bg-gradient-to-r from-gray-50 to-white px-4 py-4 lg:px-6 lg:py-5 border-b border-gray-100">
            <div className="flex items-center justify-between flex-col lg:flex-row gap-4">
              <div className="flex items-center gap-3 w-full lg:w-auto">
                <div className="w-10 h-10 rounded-lg animate-shimmer"></div>
                <div className="h-6 w-32 rounded animate-shimmer"></div>
              </div>
              <div className="flex items-center gap-3 w-full lg:w-auto justify-center lg:justify-end">
                <div className="h-10 w-32 rounded-lg animate-shimmer"></div>
                <div className="h-10 w-40 rounded-lg animate-shimmer"></div>
              </div>
            </div>
          </div>
          <div className="w-full overflow-hidden">
            <div className="overflow-y-auto" style={{ maxHeight: '60vh' }}>
              <div className="w-full">
                <div className="bg-gray-50 px-2 py-2 lg:px-4 lg:py-3">
                  <div className="grid grid-cols-7 gap-2">
                    {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                      <div key={i} className="h-4 rounded animate-shimmer"></div>
                    ))}
                  </div>
                </div>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                  <div key={i} className="px-2 py-2 lg:px-4 lg:py-3 border-b border-gray-100">
                    <div className="grid grid-cols-7 gap-2">
                      {[1, 2, 3, 4, 5, 6, 7].map((j) => (
                        <div key={j} className="h-4 rounded animate-shimmer"></div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-center items-center gap-2 lg:gap-4 px-4 py-3 lg:px-6 lg:py-4 border-t border-gray-100 bg-gray-50">
            <div className="h-8 w-20 rounded-lg animate-shimmer"></div>
            <div className="flex items-center gap-1 lg:gap-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="w-8 h-8 lg:w-9 lg:h-9 rounded-lg animate-shimmer"></div>
              ))}
            </div>
            <div className="h-8 w-20 rounded-lg animate-shimmer"></div>
          </div>
        </div>
      )}

      {type === 'recent' && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 flex flex-col" style={{ height: '460px', minHeight: '350px' }}>
          <div className="flex items-center gap-3 px-6 py-4">
            <div className="w-10 h-10 rounded-lg animate-shimmer"></div>
            <div className="h-6 w-40 rounded animate-shimmer"></div>
          </div>
          <div className="flex-1 p-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 rounded-lg animate-shimmer mb-3"></div>
            ))}
          </div>
        </div>
      )}

      {type === 'full' && (
        <div className="w-full px-2 py-2 lg:px-4 lg:py-4">
          <SkeletonLoader type="title" />
          <div className="flex gap-4 min-h-0 mt-4 flex-col lg:flex-row">
            <div className="flex-1">
              <SkeletonLoader type="stats" />
              <div className="flex gap-4 min-h-0 mt-4 flex-col lg:flex-row">
                <SkeletonLoader type="chart" />
                <SkeletonLoader type="recent" />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
