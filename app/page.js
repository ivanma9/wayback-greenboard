'use client'

import { useState } from 'react'
import UrlForm from './components/UrlForm'
import ArchiveList from './components/ArchiveList'
import { useArchiveStore } from './store/archiveStore'
import GroupedArchiveList from './components/GroupedArchiveList'
export default function HomePage () {
  const { archives, isLoading } = useArchiveStore()

  return (
    <div className="space-y-8">
      {/* URL Input Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Archive a Website</h2>
        <UrlForm />
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Grouped Archives</h2>
        <GroupedArchiveList archives={archives} />
      </div>

      {/* Archives List Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">
          Archived Sites ({archives.length})
        </h2>
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
            <span className="ml-2 text-gray-600">Archiving...</span>
          </div>
        )}
        <ArchiveList archives={archives} />
      </div>
    </div>
  )
} 