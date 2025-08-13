import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import axios from 'axios'
import cheerio from 'cheerio'

export async function downloadPageAssets(pageData, assetsMap, archiveId) {
  const $ = cheerio.load(pageData.html)
  const assetsDir = path.join(process.cwd(), 'archives', archiveId, 'assets')
  
  // ✅ Create assets directory
  await fs.mkdir(assetsDir, { recursive: true })
  
  console.log(`💾 Starting asset download for: ${pageData.url}`)
  
  // ✅ Download basic assets (images, CSS)
  await downloadBasicAssets($, assetsMap, assetsDir, pageData.url)
  
  const assetCount = assetsMap.size
  console.log(`💾 Asset download completed: ${assetCount} assets processed`)
  
  // ✅ Return modified HTML with local asset paths
  return $.html()
}

async function downloadBasicAssets($, assetsMap, assetsDir, baseUrl) {
  // Images
  await downloadAssetType($, 'img', 'src', assetsMap, assetsDir, baseUrl)
  
  // CSS files
  await downloadAssetType($, 'link[rel="stylesheet"]', 'href', assetsMap, assetsDir, baseUrl)
}

async function downloadAssetType($, selector, attr, assetsMap, assetsDir, baseUrl) {
  const elements = $(selector).toArray()
  
  for (const element of elements) {
    const assetUrl = $(element).attr(attr)
    if (!assetUrl || assetUrl.startsWith('data:')) continue
    
    try {
      // ✅ Convert to absolute URL
      const absoluteUrl = new URL(assetUrl, baseUrl).href
      
      // ✅ Skip if already downloaded
      if (assetsMap.has(absoluteUrl)) {
        $(element).attr(attr, assetsMap.get(absoluteUrl))
        continue
      }
      
      // ✅ Download asset
      const filename = generateAssetFilename(absoluteUrl)
      const localPath = path.join(assetsDir, filename)
      const relativePath = `./assets/${filename}`
      
      await downloadFile(absoluteUrl, localPath)
      
      // ✅ Update asset map and DOM
      assetsMap.set(absoluteUrl, relativePath)
      $(element).attr(attr, relativePath)
      
      console.log(`✅ Downloaded: ${filename}`)
    } catch (error) {
      console.warn(`⚠️ Failed to download ${assetUrl}:`, error.message)
      // ✅ Keep original URL on failure
    }
  }
}

async function downloadFile(url, filePath) {
  try {
    const response = await axios.get(url, {
      responseType: 'stream',
      timeout: 10000,
      maxContentLength: 5 * 1024 * 1024, // 5MB limit
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Greenboard-Archiver/1.0)'
      }
    })
    
    // ✅ Ensure directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    
    const writer = fsSync.createWriteStream(filePath)
    response.data.pipe(writer)
    
    return new Promise((resolve, reject) => {
      writer.on('finish', resolve)
      writer.on('error', (error) => {
        fsSync.unlink(filePath).catch(() => {}) // Cleanup on error
        reject(error)
      })
    })
  } catch (error) {
    throw new Error(`Download failed: ${error.message}`)
  }
}

function generateAssetFilename(url) {
  try {
    const parsed = new URL(url)
    let extension = path.extname(parsed.pathname)
    
    // ✅ Clean up extension and handle query parameters
    extension = extension.split('?')[0].split('#')[0] // Remove query/fragment
    
    // ✅ If no extension found, try to determine from URL path or content type
    if (!extension) {
      // Check if URL path suggests a file type
      const pathname = parsed.pathname.toLowerCase()
      if (pathname.includes('/css') || pathname.includes('style')) {
        extension = '.css'
      } else if (pathname.includes('/js') || pathname.includes('script')) {
        extension = '.js'
      } else if (pathname.includes('/img') || pathname.includes('image')) {
        extension = '.jpg'
      } else {
        extension = '.jpg' // Default fallback
      }
    }
    
    // ✅ Validate extension and use sensible defaults
    if (!extension.match(/^\.(jpg|jpeg|png|gif|svg|css|js|woff|woff2|ttf|ico)$/i)) {
      // Try to determine from URL path
      const pathname = parsed.pathname.toLowerCase()
      if (pathname.includes('css') || pathname.includes('style')) {
        extension = '.css'
      } else if (pathname.includes('js') || pathname.includes('script')) {
        extension = '.js'
      } else if (pathname.includes('img') || pathname.includes('image') || pathname.includes('photo')) {
        extension = '.jpg'
      } else {
        extension = '.jpg' // Default for images
      }
    }
    
    // ✅ Generate a hash-based filename
    const hash = Date.now().toString(36) + Math.random().toString(36).substr(2, 5)
    
    return `${hash}${extension}`
  } catch (error) {
    console.warn(`Error generating filename for ${url}:`, error.message)
    return null
  }
}
