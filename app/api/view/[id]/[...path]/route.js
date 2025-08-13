import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

export async function GET (request, { params }) {
  const { id, path: subPath } = params
  
  try {
    // ✅ Handle asset requests (e.g., /api/view/[id]/assets/filename.jpg)
    if (subPath && subPath[0] === 'assets') {
      const assetPath = path.join(process.cwd(), 'archives', id, ...subPath)
      
      try {
        const assetBuffer = await fs.readFile(assetPath)
        const ext = path.extname(assetPath).toLowerCase()
        
        // ✅ Set appropriate content type based on file extension
        const contentType = getContentType(ext)
        
        return new NextResponse(assetBuffer, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000' // Cache for 1 year
          }
        })
      } catch (error) {
        console.warn(`Asset not found: ${assetPath}`)
        return new NextResponse('Asset not found', { status: 404 })
      }
    }
    
    // ✅ Load archive metadata
    const metadataPath = path.join(process.cwd(), 'archives', 'metadata.json')
    let archive = null
    
    try {
      const metadataContent = await fs.readFile(metadataPath, 'utf-8')
      const allArchives = JSON.parse(metadataContent)
      archive = allArchives.find(a => a.id === id)
    } catch (error) {
      console.warn(`Failed to load metadata: ${error.message}`)
    }
    
    // ✅ Handle multi-page archives
    if (archive && archive.pages && archive.pages.length > 1) {
      // ✅ Load sitemap for accurate path matching
      let sitemap = null
      try {
        const sitemapPath = path.join(process.cwd(), 'archives', id, 'sitemap.json')
        const sitemapContent = await fs.readFile(sitemapPath, 'utf-8')
        sitemap = JSON.parse(sitemapContent)
        console.log(`✅ Loaded sitemap with ${sitemap.length} pages`)
      } catch (error) {
        console.warn(`Failed to load sitemap: ${error.message}`)
      }
      
      // ✅ Use sitemap for path matching if available
      if (sitemap) {
        const requestPath = `/${subPath.join('/')}`
        
        const normalizePathForComparison = (path) => {
          // Remove trailing slash, but keep root slash
          if (path === '/') return '/'
          return path.replace(/\/$/, '')
        }
        
        const normalizedRequestPath = normalizePathForComparison(requestPath)
        
        // Find matching page in sitemap
        const matchingPage = sitemap.find(page => {
          const pageUrl = new URL(page.url)
          const pagePath = pageUrl.pathname
          const normalizedPagePath = normalizePathForComparison(pagePath)
          
          console.log(`🔍 Comparing paths:`)
          console.log(`   Page: "${pagePath}" → normalized: "${normalizedPagePath}"`)
          console.log(`   Request: "${requestPath}" → normalized: "${normalizedRequestPath}"`)
          console.log(`   Match: ${normalizedPagePath === normalizedRequestPath}`)
          
          return normalizedPagePath === normalizedRequestPath
        })
        
        if (matchingPage) {
          const htmlPath = path.join(process.cwd(), 'archives', id, matchingPage.file)
          
          try {
            const htmlContent = await fs.readFile(htmlPath, 'utf-8')
            return new NextResponse(htmlContent, {
              headers: { 'Content-Type': 'text/html' }
            })
          } catch (error) {
            console.error(`Failed to read page HTML: ${htmlPath}`, error)
            return new NextResponse('Page not found', { status: 404 })
          }
        }
      } else {
        // Fallback to metadata pages array (old method)
        const matchingPage = archive.pages.find(page => {
          const pageUrl = new URL(page.url)
          const pagePath = pageUrl.pathname
          const requestPath = `/${subPath.join('/')}`
          
          const normalizePathForComparison = (path) => {
            // Remove trailing slash, but keep root slash
            if (path === '/') return '/'
            return path.replace(/\/$/, '')
          }
          
          const normalizedPagePath = normalizePathForComparison(pagePath)
          const normalizedRequestPath = normalizePathForComparison(requestPath)
          
          console.log(`🔍 Comparing paths (fallback):`)
          console.log(`   Page: "${pagePath}" → normalized: "${normalizedPagePath}"`)
          console.log(`   Request: "${requestPath}" → normalized: "${normalizedRequestPath}"`)
          console.log(`   Match: ${normalizedPagePath === normalizedRequestPath}`)
          
          return normalizedPagePath === normalizedRequestPath
        })
        
        if (matchingPage) {
          // Find the page index
          const pageIndex = archive.pages.findIndex(page => page.url === matchingPage.url)
          const htmlPath = path.join(process.cwd(), 'archives', id, `page-${pageIndex + 1}.html`)
          
          try {
            const htmlContent = await fs.readFile(htmlPath, 'utf-8')
            return new NextResponse(htmlContent, {
              headers: { 'Content-Type': 'text/html' }
            })
          } catch (error) {
            console.error(`Failed to read page HTML: ${htmlPath}`, error)
            return new NextResponse('Page not found', { status: 404 })
          }
        }
      }
      
      // If no matching page found, show 404 with navigation
      const navigationHtml = generateNavigationHtml(archive, id, sitemap)
      return new NextResponse(navigationHtml, {
        status: 404,
        headers: { 'Content-Type': 'text/html' }
      })
    }
    
    // ✅ Handle single page archives - try both possible locations
    let htmlContent = null
    
    // Try single-page archive file first
    const singlePagePath = path.join(process.cwd(), 'archives', `${id}.html`)
    try {
      htmlContent = await fs.readFile(singlePagePath, 'utf-8')
      console.log(`✅ Found single-page archive: ${singlePagePath}`)
    } catch (error) {
      console.log(`❌ Single-page archive not found: ${singlePagePath}`)
    }
    
    // If not found, try multi-page archive index
    if (!htmlContent) {
      const multiPageIndexPath = path.join(process.cwd(), 'archives', id, 'index.html')
      try {
        htmlContent = await fs.readFile(multiPageIndexPath, 'utf-8')
        console.log(`✅ Found multi-page archive index: ${multiPageIndexPath}`)
      } catch (error) {
        console.log(`❌ Multi-page archive index not found: ${multiPageIndexPath}`)
      }
    }
    
    if (htmlContent) {
      return new NextResponse(htmlContent, {
        headers: { 'Content-Type': 'text/html' }
      })
    }
    
    // ✅ If no archive found, show 404
    const navigationHtml = generateNavigationHtml(archive, id)
    return new NextResponse(navigationHtml, {
      status: 404,
      headers: { 'Content-Type': 'text/html' }
    })
    
  } catch (error) {
    console.error('View error:', error)
    
    // ✅ Enhanced 404 page with navigation
    const navigationHtml = generateNavigationHtml(null, id)
    return new NextResponse(navigationHtml, {
      status: 404,
      headers: { 'Content-Type': 'text/html' }
    })
  }
}

// ✅ Helper function to get content type for assets
function getContentType (ext) {
  const contentTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.ico': 'image/x-icon'
  }
  
  return contentTypes[ext] || 'application/octet-stream'
}

// ✅ Generate navigation HTML for 404 pages
function generateNavigationHtml (archive, id, sitemap) {
  // Use sitemap if available, otherwise fall back to metadata pages
  const pages = sitemap || archive?.pages || []
  
  return `
<!DOCTYPE html>
<html>
<head>
  <title>Page Not Found - Greenboard Archive</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    .nav { margin: 20px 0; }
    .nav a { margin-right: 10px; color: #3b82f6; }
  </style>
</head>
<body>
  <h1>📁 Page Not Found</h1>
  <p>This page was not archived or doesn't exist.</p>
  
  ${pages.length > 0 ? `
    <div class="nav">
      <h3>Available Pages:</h3>
      ${pages.map((page, index) => {
        const pageUrl = sitemap ? new URL(page.url) : new URL(page.url)
        const pagePath = pageUrl.pathname
        const displayTitle = page.title || `Page ${index + 1}`
        const linkPath = pagePath === '/' ? '' : pagePath
        
        return `<a href="/api/view/${id}${linkPath}">${displayTitle}</a>`
      }).join('')}
    </div>
  ` : ''}
  
  <p><a href="/">← Back to Archive List</a></p>
</body>
</html>
  `
} 