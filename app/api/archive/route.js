import { NextResponse } from 'next/server'
import { archiveWebsite } from '../../../lib/archiver'

export async function POST (request) {
  try {
    const { url, options = {} } = await request.json()
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // ✅ Preprocess URL before validation
    let processedUrl = url.trim()
    
    // Add https:// if no protocol
    if (!processedUrl.startsWith('http://') && !processedUrl.startsWith('https://')) {
      processedUrl = 'https://' + processedUrl
    }

    // Validate URL
    try {
      new URL(processedUrl)
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
    }

    console.log(`📋 Archive request: ${url} → ${processedUrl}`)
    console.log(`🔧 Options received:`, options)
    console.log(`🔧 includeAssets: ${options.includeAssets}`)

    // ✅ Pass the processed URL to archiver
    const archive = await archiveWebsite(processedUrl, options)
    return NextResponse.json(archive)
  } catch (error) {
    console.error('Archive error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to archive website' },
      { status: 500 }
    )
  }
} 