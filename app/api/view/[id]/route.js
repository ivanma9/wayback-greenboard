import { NextResponse } from 'next/server'
import { getArchiveContent, getArchiveById, getArchives } from '../../../../lib/storage'

export async function GET (request, { params }) {
  try {
    // ✅ Fix: Use 'id' not 'archiveId' since that's the route parameter name
    const { id } = params
    const { searchParams } = new URL(request.url)
    const subPath = searchParams.get('path') || ''
    
    console.log(`📖 Attempting to view archive with ID: ${id}`)
    console.log(`📁 Sub-path requested: ${subPath}`)
    
    // Get archive metadata
    const archive = await getArchiveById(id)
    console.log(`🔍 Archive lookup result:`, archive ? `Found: ${archive.title}` : 'Not found')
    
    if (!archive) {
      console.log(`❌ Archive not found for ID: ${id}`)
      const allArchives = await getArchives()
      console.log(`📋 Available archives:`, allArchives.map(a => ({ id: a.id, title: a.title })))
      return new NextResponse('Archive not found', { status: 404 })
    }
    
    // For simple viewing (no sub-path), just serve the main page
    if (!subPath) {
      console.log(`📄 Serving main page for archive: ${id}`)
      const content = await getArchiveContent(id, 'index')
      console.log(`📄 Content lookup result:`, content ? `Found (${content.length} chars)` : 'Not found')
      
      if (!content) {
        return new NextResponse('Archive content not found', { status: 404 })
      }
      
      return new NextResponse(content, {
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'public, max-age=31536000'
        }
      })
    }
    
    // Handle sub-paths (for multi-page archives)
    console.log(`🔍 Looking for sub-path: ${subPath}`)
    
    if (!archive.pages) {
      console.log(`❌ No pages found in archive metadata`)
      return new NextResponse('Multi-page archive not found', { status: 404 })
    }
    
    console.log(`📋 Available pages:`, archive.pages.map(p => p.url))
    
    // Find the page that matches this path
    const matchingPage = archive.pages.find(page => {
      const pageUrl = new URL(page.url)
      return pageUrl.pathname === `/${subPath}` || pageUrl.pathname.endsWith(`/${subPath}`)
    })
    
    if (!matchingPage) {
      console.log(`❌ No matching page found for path: ${subPath}`)
      return new NextResponse('Page not found in archive', { status: 404 })
    }
    
    console.log(`✅ Found matching page: ${matchingPage.url}`)
    
    const pageIndex = archive.pages.indexOf(matchingPage)
    const targetPage = pageIndex === 0 ? 'index' : `page-${pageIndex}`
    
    console.log(`📄 Loading page file: ${targetPage}`)
    
    const content = await getArchiveContent(id, targetPage)
    
    if (!content) {
      console.log(`❌ Content not found for page: ${targetPage}`)
      return new NextResponse('Archive content not found', { status: 404 })
    }

    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=31536000'
      }
    })
  } catch (error) {
    console.error('❌ View archive error:', error)
    return new NextResponse(`Failed to load archive: ${error.message}`, { status: 500 })
  }
} 