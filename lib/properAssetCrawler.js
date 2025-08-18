import puppeteer from 'puppeteer'
import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import axios from 'axios'
import cheerio from 'cheerio'

/**
 * Comprehensive asset crawler using Wayback Machine's approach:
 * 1. Use headless browser to execute JavaScript and discover all assets
 * 2. Intercept network requests to capture dynamically loaded resources
 * 3. Download all discovered assets
 * 4. Rewrite URLs in HTML, CSS, and JS files
 */
export async function crawlPageWithAssets(url, archiveId, options = {}) {
  console.log(`🚀 Starting comprehensive asset crawling for: ${url}`)
  
  const {
    timeout = 30000,
    waitForNetworkIdle = 2000,
    viewport = { width: 1920, height: 1080 }
  } = options
  
  let browser = null
  const assetsMap = new Map() // url -> local path mapping
  
  // Add overall timeout to prevent hanging
  const overallTimeout = setTimeout(() => {
    console.error(`⏰ Puppeteer crawling timed out after ${timeout + 10000}ms`)
    if (browser) {
      browser.close().catch(() => {})
    }
  }, timeout + 10000)
  
  try {
    // Launch browser with minimal options to avoid hanging
    browser = await puppeteer.launch({
      headless: 'new',
      timeout: 30000,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-gpu',
        '--disable-extensions',
        '--no-first-run',
        '--disable-default-apps'
      ]
    })
    
    const page = await browser.newPage()
    
    // Set page timeout
    page.setDefaultTimeout(timeout)
    page.setDefaultNavigationTimeout(timeout)
    
    await page.setViewport(viewport)
    
    // Set up request interception to capture all asset requests
    await page.setRequestInterception(true)
    
    const interceptedAssets = []
    
    page.on('request', (request) => {
      const requestUrl = request.url()
      const resourceType = request.resourceType()
      
      // Log all requests for debugging
      if (['stylesheet', 'image', 'font', 'script', 'document'].includes(resourceType)) {
        console.log(`📡 Intercepted ${resourceType}: ${requestUrl}`)
        interceptedAssets.push({
          url: requestUrl,
          type: resourceType,
          headers: request.headers()
        })
      }
      
      // Allow the request to continue
      request.continue().catch(() => {
        // Ignore errors if request was already handled
      })
    })
    
    // Set realistic browser headers
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    
    console.log(`🌐 Navigating to: ${url}`)
    
    // Navigate and wait for the page to fully load
    await page.goto(url, { 
      waitUntil: 'networkidle0',  // Changed to networkidle0 for faster completion
      timeout 
    })
    
    // Reduced wait time to prevent hanging
    console.log(`⏳ Waiting ${waitForNetworkIdle}ms for lazy-loaded content...`)
    await new Promise(resolve => setTimeout(resolve, waitForNetworkIdle))
    
    // Get the final HTML after all JavaScript execution
    const finalHtml = await page.content()
    const finalUrl = page.url()
    
    console.log(`✅ Page loaded. Final URL: ${finalUrl}`)
    console.log(`📊 Intercepted ${interceptedAssets.length} asset requests`)
    
    // Clear the timeout since we succeeded
    clearTimeout(overallTimeout)
    
    // Close browser early to prevent hanging
    await browser.close()
    browser = null
    
    // Create assets directory
    const assetsDir = path.join(process.cwd(), 'archives', archiveId, 'assets')
    await fs.mkdir(assetsDir, { recursive: true })
    
    // Download all intercepted assets
    console.log(`📥 Starting asset downloads...`)
    const downloadPromises = interceptedAssets.map(async (asset) => {
      try {
        // Skip the main document
        if (asset.type === 'document') return
        
        const filename = generateAssetFilename(asset.url, asset.type)
        if (!filename) {
          console.log(`⚠️ Could not generate filename for: ${asset.url}`)
          return
        }
        
        const localPath = path.join(assetsDir, filename)
        const relativePath = `/api/view/${archiveId}/assets/${filename}`
        
        console.log(`📥 Downloading: ${asset.url} -> ${filename}`)
        await downloadAsset(asset.url, localPath, asset.headers)
        assetsMap.set(asset.url, relativePath)
        
        console.log(`✅ Downloaded: ${filename} (mapped: ${asset.url} -> ${relativePath})`)
      } catch (error) {
        console.warn(`⚠️ Failed to download ${asset.url}:`, error.message)
      }
    })
    
    await Promise.allSettled(downloadPromises)
    
    console.log(`📦 Downloaded ${assetsMap.size} assets`)
    
    // Rewrite URLs in the HTML
    const rewrittenHtml = await rewriteHtmlUrls(finalHtml, finalUrl, assetsMap, archiveId)
    
    // Download and rewrite CSS files
    await processCssFiles(assetsMap, assetsDir, finalUrl, archiveId)
    
    return {
      html: rewrittenHtml,
      url: finalUrl,
      assetsCount: assetsMap.size,
      assets: Array.from(assetsMap.entries())
    }
    
  } catch (error) {
    console.error(`❌ Puppeteer crawling error: ${error.message}`)
    
    // Clear timeout
    clearTimeout(overallTimeout)
    
    // Clean up browser
    if (browser) {
      try {
        await browser.close()
      } catch (closeError) {
        console.warn(`⚠️ Error closing browser: ${closeError.message}`)
      }
    }
    
    throw error
  }
}

/**
 * Download an asset with proper headers and error handling
 */
async function downloadAsset(url, localPath, originalHeaders = {}) {
  try {
    const response = await axios.get(url, {
      responseType: 'stream',
      timeout: 15000,
      maxContentLength: 50 * 1024 * 1024, // 50MB limit
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': originalHeaders.accept || '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': originalHeaders.referer || url,
        'DNT': '1',
        'Connection': 'keep-alive'
      }
    })
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(localPath), { recursive: true })
    
    const writer = fsSync.createWriteStream(localPath)
    response.data.pipe(writer)
    
    return new Promise((resolve, reject) => {
      writer.on('finish', resolve)
      writer.on('error', (error) => {
        fsSync.unlink(localPath).catch(() => {}) // Cleanup on error
        reject(error)
      })
    })
  } catch (error) {
    throw new Error(`Failed to download ${url}: ${error.message}`)
  }
}

/**
 * Rewrite URLs in HTML content
 */
async function rewriteHtmlUrls(html, baseUrl, assetsMap, archiveId) {
  const $ = cheerio.load(html)
  
  console.log(`🔧 Rewriting HTML URLs...`)
  console.log(`🔧 Assets map has ${assetsMap.size} entries`)
  console.log(`🔧 Sample assets map entries:`)
  let count = 0
  for (const [url, path] of assetsMap.entries()) {
    if (count < 3) {
      console.log(`   ${url} -> ${path}`)
      count++
    }
  }
  
  // Rewrite image sources
  $('img[src]').each((i, img) => {
    const src = $(img).attr('src')
    if (src && !src.startsWith('data:')) {
      const absoluteUrl = new URL(src, baseUrl).href
      if (assetsMap.has(absoluteUrl)) {
        $(img).attr('src', assetsMap.get(absoluteUrl))
        console.log(`🔗 Rewrote img: ${src} -> ${assetsMap.get(absoluteUrl)}`)
      } else {
        console.log(`❌ Image not found in assets map: ${absoluteUrl}`)
      }
    }
  })
  
  // Rewrite CSS links
  $('link[rel="stylesheet"]').each((i, link) => {
    const href = $(link).attr('href')
    if (href) {
      const absoluteUrl = new URL(href, baseUrl).href
      if (assetsMap.has(absoluteUrl)) {
        $(link).attr('href', assetsMap.get(absoluteUrl))
        console.log(`🔗 Rewrote CSS: ${href} -> ${assetsMap.get(absoluteUrl)}`)
      } else {
        console.log(`❌ CSS not found in assets map: ${absoluteUrl}`)
      }
    }
  })
  
  // Rewrite script sources
  $('script[src]').each((i, script) => {
    const src = $(script).attr('src')
    if (src) {
      const absoluteUrl = new URL(src, baseUrl).href
      if (assetsMap.has(absoluteUrl)) {
        $(script).attr('src', assetsMap.get(absoluteUrl))
        console.log(`🔗 Rewrote script: ${src} -> ${assetsMap.get(absoluteUrl)}`)
      } else {
        console.log(`❌ Script not found in assets map: ${absoluteUrl}`)
      }
    }
  })
  
  // Rewrite background images in inline styles
  $('[style*="background"]').each((i, element) => {
    const style = $(element).attr('style')
    if (style) {
      let newStyle = style
      const bgImageMatches = style.matchAll(/background(?:-image)?:\s*url\(['"]?([^'")\s]+)['"]?\)/gi)
      
      for (const match of bgImageMatches) {
        const imageUrl = match[1]
        try {
          const absoluteUrl = new URL(imageUrl, baseUrl).href
          if (assetsMap.has(absoluteUrl)) {
            newStyle = newStyle.replace(match[0], match[0].replace(imageUrl, assetsMap.get(absoluteUrl)))
            console.log(`🔗 Rewrote bg-image: ${imageUrl} -> ${assetsMap.get(absoluteUrl)}`)
          }
        } catch (e) {
          // Skip invalid URLs
        }
      }
      
      if (newStyle !== style) {
        $(element).attr('style', newStyle)
      }
    }
  })
  
  return $.html()
}

/**
 * Process CSS files to rewrite URLs within them
 */
async function processCssFiles(assetsMap, assetsDir, baseUrl, archiveId) {
  console.log(`🎨 Processing CSS files for URL rewriting...`)
  
  for (const [originalUrl, localPath] of assetsMap.entries()) {
    if (originalUrl.includes('.css')) {
      try {
        const fullLocalPath = path.join(process.cwd(), 'archives', archiveId, 'assets', path.basename(localPath))
        
        // Check if file exists
        if (!fsSync.existsSync(fullLocalPath)) continue
        
        const cssContent = await fs.readFile(fullLocalPath, 'utf-8')
        const rewrittenCss = await rewriteCssUrls(cssContent, originalUrl, assetsMap, baseUrl)
        
        if (rewrittenCss !== cssContent) {
          await fs.writeFile(fullLocalPath, rewrittenCss, 'utf-8')
          console.log(`🎨 Rewrote URLs in CSS: ${path.basename(localPath)}`)
        }
        
      } catch (error) {
        console.warn(`⚠️ Failed to process CSS file ${originalUrl}:`, error.message)
      }
    }
  }
}

/**
 * Rewrite URLs within CSS content
 */
async function rewriteCssUrls(cssContent, cssUrl, assetsMap, baseUrl) {
  let rewrittenCss = cssContent
  
  // Find all url() references in CSS
  const urlMatches = cssContent.matchAll(/url\(['"]?([^'")\s]+)['"]?\)/gi)
  
  for (const match of urlMatches) {
    const resourceUrl = match[1]
    
    // Skip data URLs
    if (resourceUrl.startsWith('data:')) continue
    
    try {
      // Resolve relative to the CSS file's URL
      const absoluteUrl = new URL(resourceUrl, cssUrl).href
      
      if (assetsMap.has(absoluteUrl)) {
        const localPath = assetsMap.get(absoluteUrl)
        rewrittenCss = rewrittenCss.replace(match[0], `url("${localPath}")`)
        console.log(`🎨 CSS URL rewrite: ${resourceUrl} -> ${localPath}`)
      }
    } catch (e) {
      // Skip invalid URLs
    }
  }
  
  return rewrittenCss
}

/**
 * Generate a filename for an asset
 */
function generateAssetFilename(url, resourceType) {
  try {
    const urlObj = new URL(url)
    let pathname = urlObj.pathname
    
    // Remove query parameters for filename
    const baseName = path.basename(pathname).split('?')[0]
    
    if (baseName && baseName.includes('.')) {
      return `${generateId()}_${baseName}`
    } else {
      // Generate filename based on resource type
      const extensions = {
        'stylesheet': 'css',
        'script': 'js',
        'image': 'jpg',
        'font': 'woff2'
      }
      const ext = extensions[resourceType] || 'bin'
      return `${generateId()}.${ext}`
    }
  } catch (e) {
    return null
  }
}

/**
 * Generate a unique ID
 */
function generateId() {
  return Math.random().toString(36).substring(2, 15)
} 