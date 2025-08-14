import { useState } from 'react'
import { useArchiveStore } from '../store/archiveStore'

export default function UrlForm () {
  const [url, setUrl] = useState('')
  const [includeAssets, setIncludeAssets] = useState(false)  // ✅ Add asset toggle
  const { archiveUrl, isLoading, error, clearError } = useArchiveStore()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!url.trim()) return

    try {
      new URL(url) // Validate URL
      
      // ✅ Add performance options
      const options = {
        maxPages: 50,
        maxDepth: 3,
        sameOriginOnly: true,
        includeAssets: includeAssets,   // ✅ Use user preference
        concurrency: 10,
        requestDelay: 100
      }
      
      await archiveUrl(url, options)
      setUrl('')
    } catch (error) {
      console.error('Invalid URL:', error)
    }
  }

  const isValidUrl = (str) => {
    try {
      new URL(str)
      return true
    } catch {
      return false
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
          Website URL
        </label>
        <div className="flex gap-2">
          <input
            type="url"
            id="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !url.trim() || !isValidUrl(url)}
            className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Archiving...' : 'Archive'}
          </button>
        </div>
      </div>
      
      {/* ✅ Asset downloading toggle */}
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="includeAssets"
          checked={includeAssets}
          onChange={(e) => setIncludeAssets(e.target.checked)}
          className="rounded border-gray-300 text-green-600 focus:ring-green-500"
          disabled={isLoading}
        />
        <label htmlFor="includeAssets" className="text-sm text-gray-700">
          Download assets (images, CSS) - Slower but more complete
        </label>
      </div>
      
      {error && (
        <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}
    </form>
  )
} 