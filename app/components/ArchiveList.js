import { useEffect } from 'react'
import { useArchiveStore } from '../store/archiveStore'

function ArchiveItem ({ archive }) {
  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString()
  }

  const handleView = () => {
    // Open archived page in new tab
    window.open(`/api/view/${archive.id}`, '_blank')
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-medium text-gray-900 truncate">
            {archive.title || archive.url}
          </h3>
          <p className="text-sm text-gray-500 truncate">{archive.url}</p>
          <p className="text-xs text-gray-400 mt-1">
            Archived on {formatDate(archive.timestamp)}
          </p>
          {archive.pageCount && (
            <p className="text-xs text-gray-400">
              {archive.pageCount} page{archive.pageCount !== 1 ? 's' : ''} archived
            </p>
          )}
        </div>
        <button
          onClick={handleView}
          className="ml-4 px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          View
        </button>
      </div>
    </div>
  )
}

export default function ArchiveList ({ archives }) {
  const { loadArchives } = useArchiveStore()

  useEffect(() => {
    loadArchives()
  }, [loadArchives])

  if (archives.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No archived sites yet.</p>
        <p className="text-sm">Enter a URL above to get started!</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {archives.map(archive => (
        <ArchiveItem key={archive.id} archive={archive} />
      ))}
    </div>
  )
} 