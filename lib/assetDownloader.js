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
  
  // ✅ Download comprehensive assets
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
  
  // JavaScript files
  await downloadAssetType($, 'script[src]', 'src', assetsMap, assetsDir, baseUrl)
  
  // Font files
  await downloadAssetType($, 'link[rel="preload"][as="font"]', 'href', assetsMap, assetsDir, baseUrl)
  await downloadAssetType($, 'link[rel="preload"][as="style"]', 'href', assetsMap, assetsDir, baseUrl)
  
  // Background images in CSS
  await downloadBackgroundImages($, assetsMap, assetsDir, baseUrl)
}

async function downloadAssetType($, selector, attr, assetsMap, assetsDir, baseUrl) {
  const elements = $(selector).toArray()
  
  for (const element of elements) {
    const assetUrl = $(element).attr(attr)
    if (!assetUrl || assetUrl.startsWith('data:') || assetUrl.startsWith('#')) continue
    
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
      if (!filename) continue
      
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

async function downloadBackgroundImages($, assetsMap, assetsDir, baseUrl) {
  // Find background images in inline styles
  $('[style*="background"]').each((i, element) => {
    const style = $(element).attr('style')
    if (!style) return
    
    // Extract background-image URLs
    const bgImageMatch = style.match(/background-image:\s*url\(['"]?([^'")\s]+)['"]?\)/i)
    if (bgImageMatch) {
      const assetUrl = bgImageMatch[1]
      downloadAssetUrl(assetUrl, assetsMap, assetsDir, baseUrl, $, element, 'style')
    }
  })
}

async function downloadAssetUrl(assetUrl, assetsMap, assetsDir, baseUrl, $, element, attr) {
  if (!assetUrl || assetUrl.startsWith('data:') || assetUrl.startsWith('#')) return
  
  try {
    const absoluteUrl = new URL(assetUrl, baseUrl).href
    
    if (assetsMap.has(absoluteUrl)) {
      const relativePath = assetsMap.get(absoluteUrl)
      const currentStyle = $(element).attr(attr)
      const newStyle = currentStyle.replace(
        /background-image:\s*url\(['"]?[^'")\s]+['"]?\)/i,
        `background-image: url("${relativePath}")`
      )
      $(element).attr(attr, newStyle)
      return
    }
    
    const filename = generateAssetFilename(absoluteUrl)
    if (!filename) return
    
    const localPath = path.join(assetsDir, filename)
    const relativePath = `./assets/${filename}`
    
    await downloadFile(absoluteUrl, localPath)
    
    assetsMap.set(absoluteUrl, relativePath)
    
    const currentStyle = $(element).attr(attr)
    const newStyle = currentStyle.replace(
      /background-image:\s*url\(['"]?[^'")\s]+['"]?\)/i,
      `background-image: url("${relativePath}")`
    )
    $(element).attr(attr, newStyle)
    
    console.log(`✅ Downloaded background: ${filename}`)
  } catch (error) {
    console.warn(`⚠️ Failed to download background ${assetUrl}:`, error.message)
  }
}

async function downloadFile(url, filePath) {
  try {
    const response = await axios.get(url, {
      responseType: 'stream',
      timeout: 15000,
      maxContentLength: 10 * 1024 * 1024, // 10MB limit
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
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
      } else if (pathname.includes('/font') || pathname.includes('woff') || pathname.includes('ttf')) {
        extension = '.woff2'
      } else {
        extension = '.jpg' // Default fallback
      }
    }
    
    // ✅ Validate extension and use sensible defaults
    if (!extension.match(/^\.(jpg|jpeg|png|gif|svg|webp|css|js|woff|woff2|ttf|eot|ico|mp4|webm|mp3|wav)$/i)) {
      // Try to determine from URL path
      const pathname = parsed.pathname.toLowerCase()
      if (pathname.includes('css') || pathname.includes('style')) {
        extension = '.css'
      } else if (pathname.includes('js') || pathname.includes('script')) {
        extension = '.js'
      } else if (pathname.includes('img') || pathname.includes('image') || pathname.includes('photo')) {
        extension = '.jpg'
      } else if (pathname.includes('font') || pathname.includes('woff') || pathname.includes('ttf')) {
        extension = '.woff2'
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
