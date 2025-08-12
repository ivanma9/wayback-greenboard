import { NextResponse } from 'next/server'
import { getArchiveContent, getArchiveById, getArchives } from '../../../../../lib/storage'

export async function GET (request, { params }) {
  try {
    const { id, path } = params
    const subPath = path ? path.join('/') : ''
    
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
      const pagePath = pageUrl.pathname
      const requestPath = `/${subPath}`
      
      // Normalize paths by removing/adding trailing slashes for comparison
      const normalizePathForComparison = (path) => {
        // Remove trailing slash for comparison, except for root "/"
        return path === '/' ? '/' : path.replace(/\/$/, '')
      }
      
      const normalizedPagePath = normalizePathForComparison(pagePath)
      const normalizedRequestPath = normalizePathForComparison(requestPath)
      
      console.log(`🔍 Comparing paths:`)
      console.log(`   Page: "${pagePath}" → normalized: "${normalizedPagePath}"`)
      console.log(`   Request: "${requestPath}" → normalized: "${normalizedRequestPath}"`)
      console.log(`   Match: ${normalizedPagePath === normalizedRequestPath}`)
      
      return normalizedPagePath === normalizedRequestPath
    })
    
    if (!matchingPage) {
      console.log(`❌ No matching page found for path: ${subPath}`)
      
      // Create a helpful 404 page that stays within the archive context
      const originalUrl = `${archive.pages[0]?.url ? new URL(archive.pages[0].url).origin : 'original site'}/${subPath}`
      const notFoundHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Page Not Archived - ${archive.title}</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
            .banner { background: #f0f9ff; border: 2px solid #3b82f6; padding: 15px; text-align: center; margin-bottom: 20px; }
            .content { background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 5px; }
            .actions { margin-top: 20px; }
            .btn { background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-right: 10px; }
            .btn:hover { background: #2563eb; }
            .btn-secondary { background: #6b7280; }
          </style>
        </head>
        <body>
          <div class="banner">
            <strong>📁 ARCHIVED SITE</strong> - ${archive.title}
          </div>
          <div class="content">
            <h2>⚠️ Page Not Archived</h2>
            <p>The page <code>/${subPath}</code> was not included in this archive.</p>
            <p>This archive contains ${archive.pages?.length || 0} pages. You can:</p>
            <div class="actions">
              <a href="/api/view/${id}" class="btn">🏠 Back to Archive Home</a>
              <a href="${originalUrl}" target="_blank" class="btn btn-secondary">🔗 View Original Page</a>
            </div>
            <h3>📋 Available Pages in Archive:</h3>
            <ul>
              ${archive.pages?.map(page => {
                const pageUrl = new URL(page.url)
                const pagePath = pageUrl.pathname === '/' ? '' : pageUrl.pathname
                return `<li><a href="/api/view/${id}${pagePath}">${page.title}</a></li>`
              }).join('') || '<li>No pages available</li>'}
            </ul>
          </div>
        </body>
        </html>
      `
      
      return new NextResponse(notFoundHtml, {
        status: 404,
        headers: {
          'Content-Type': 'text/html'
        }
      })
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