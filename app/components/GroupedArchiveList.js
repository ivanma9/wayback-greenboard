'use client'

import { useState, useEffect } from 'react'
import { useArchiveStore } from '../store/archiveStore'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { ChevronRight, Archive, Clock, Eye } from 'lucide-react'

function ArchiveItem ({ archive, onReArchive }) {
  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString()
  }

  const handleView = () => {
    window.open(`/api/view/${archive.id}`, '_blank')
  }

  return (
    <div
      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
      style={{ backgroundColor: 'rgb(238, 239, 211)' }}
    >
      <div className="flex items-center space-x-3">
        <Clock className="h-4 w-4 text-gray-400" />
        <div>
          <p className="text-sm font-medium text-gray-900">
            {formatDate(archive.timestamp)}
          </p>
          {archive.pageCount && (
            <p className="text-xs text-gray-500">
              {archive.pageCount} page{archive.pageCount !== 1 ? 's' : ''} • {Math.round(archive.size / 1024)}KB
            </p>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleView}
        className="h-8 px-2"
      >
        <Eye className="h-4 w-4" />
      </Button>
    </div>
  )
}

function SiteGroup ({ siteUrl, archives, onReArchive }) {
  const [isOpen, setIsOpen] = useState(false)
  
  // Get the most recent archive for display
  const mostRecent = archives[0]
  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString()
  }

  const handleReArchive = async () => {
    try {
      await onReArchive(siteUrl)
      setIsOpen(false)
    } catch (error) {
      console.error('Failed to re-archive:', error)
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <div
          className="border border-gray-200 rounded-lg overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
          style={{ backgroundColor: 'rgb(238, 239, 211)' }}
        >
          <div className="flex items-center justify-between p-4" style={{ backgroundColor: 'rgb(238, 239, 211)' }}>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-medium text-gray-900 truncate">
                {mostRecent.title || siteUrl}
              </h3>
              <p className="text-sm text-gray-500 truncate">{siteUrl}</p>
              <p className="text-xs text-gray-400 mt-1">
                {archives.length} snapshot{archives.length !== 1 ? 's' : ''} • Last: {formatDate(mostRecent.timestamp)}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={e => {
                  e.stopPropagation()
                  handleReArchive()
                }}
                className="h-8"
              >
                <Archive className="h-4 w-4 mr-1" />
                Re-archive
              </Button>
              <div className="flex items-center justify-center w-8 h-8">
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </div>
            </div>
          </div>
        </div>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[50rem] !max-w-none border-l border-gray-200"
        style={{ backgroundColor: 'rgb(232, 233, 191)' }}
      >
        <SheetHeader>
          <SheetTitle className="text-left">
            <div className="truncate">{mostRecent.title || siteUrl}</div>
            <div className="text-sm font-normal text-gray-500 truncate">{siteUrl}</div>
          </SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Archive History</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReArchive}
              className="h-7 text-green-700 bg-green-600 border-green-600 hover:bg-green-700 text-white"
            >
              <Archive className="h-3 w-3 mr-1 text-white" />
              New Snapshot
            </Button>
          </div>
          <div className="space-y-2 max-h-[700px] overflow-y-auto">
            {archives.map(archive => (
              <ArchiveItem 
                key={archive.id} 
                archive={archive}
                onReArchive={onReArchive}
              />
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export default function GroupedArchiveList ({ archives }) {
  const { archiveUrl, loadArchives } = useArchiveStore()

  // Group archives by URL
  const groupedArchives = archives.reduce((groups, archive) => {
    const url = archive.url
    if (!groups[url]) {
      groups[url] = []
    }
    groups[url].push(archive)
    return groups
  }, {})

  // Sort each group by timestamp (newest first)
  Object.keys(groupedArchives).forEach(url => {
    groupedArchives[url].sort((a, b) => b.timestamp - a.timestamp)
  })

  // Sort groups by most recent archive
  const sortedGroups = Object.entries(groupedArchives)
    .sort(([, a], [, b]) => b[0].timestamp - a[0].timestamp)

  const handleReArchive = async (url) => {
    try {
      await archiveUrl(url)
      await loadArchives() // Refresh the list
    } catch (error) {
      console.error('Failed to re-archive:', error)
      throw error
    }
  }

  if (archives.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No archived sites yet.</p>
        <p className="text-sm">Enter a URL above to get started!</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {sortedGroups.map(([url, siteArchives]) => (
        <SiteGroup
          key={url}
          siteUrl={url}
          archives={siteArchives}
          onReArchive={handleReArchive}
        />
      ))}
    </div>
  )
} 