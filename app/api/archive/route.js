import { NextResponse } from 'next/server'
import { archiveWebsite } from '../../../lib/archiver'

export async function POST (request) {
  try {
    const { url } = await request.json()
    
    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    // Validate URL
    try {
      new URL(url)
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      )
    }

    const archive = await archiveWebsite(url)
    
    return NextResponse.json(archive)
  } catch (error) {
    console.error('Archive error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to archive website' },
      { status: 500 }
    )
  }
} 