import axios from 'axios'
import cheerio from 'cheerio'
import { saveArchive, saveMultiPageArchive } from './storage'
import { generateId } from './utils'
import { crawlPageWithAssets } from './properAssetCrawler'

export async function archiveWebsite (url, options = {}) {
  const startTime = Date.now()
  console.log(`🚀 Starting archive process at ${new Date().toISOString()}`)
  
  const {
    maxPages = 500,           
    maxDepth = 3,            
    sameOriginOnly = true,   
    includeAssets = false,   // ✅ Disabled by default
    concurrency = 10,         // ✅ New: Number of concurrent requests
    requestDelay = 100       // ✅ New: Reduced delay between requests (was 500ms)
  } = options

  // ✅ Create resolved options object with defaults applied
  const resolvedOptions = {
    maxPages,
    maxDepth,
    sameOriginOnly,
    includeAssets,
    concurrency,
    requestDelay
  }

  const id = generateId()
  const timestamp = Date.now()
  
  try {
    console.log(`🌿 Starting archive: ${url}`)
    console.log(`📊 Settings: maxPages=${maxPages}, maxDepth=${maxDepth}, concurrency=${concurrency}`)
    
    // Try multi-page first
    if (maxPages > 1) {
      try {
        const result = await archiveMultiplePages(url, id, timestamp, resolvedOptions)
        const totalTime = Date.now() - startTime
        console.log(`⏱️ Total archive time: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`)
        console.log(`📈 Performance: ${result.pageCount} pages in ${(totalTime / 1000).toFixed(2)}s = ${(result.pageCount / (totalTime / 1000)).toFixed(1)} pages/sec`)
        return result
      } catch (error) {
        console.warn(`⚠️ Multi-page failed, falling back to single page: ${error.message}`)
        // Fall back to single page
        const result = await archiveSinglePage(url, id, timestamp, resolvedOptions)
        const totalTime = Date.now() - startTime
        console.log(`⏱️ Single page fallback time: ${totalTime}ms`)
        return result
      }
    }
    
    // Single page archiving
    const result = await archiveSinglePage(url, id, timestamp, resolvedOptions)
    const totalTime = Date.now() - startTime
    console.log(`⏱️ Single page archive time: ${totalTime}ms`)
    return result
    
  } catch (error) {
    const totalTime = Date.now() - startTime
    console.error(`❌ Archive failed after ${totalTime}ms:`, error)
    
    // Save failed archive metadata
    const failedArchive = {
      id,
      url,
      title: extractDomainFromUrl(url),
      timestamp,
      status: 'failed',
      error: error.message,
      pageCount: 0,
      size: 0
    }
    
    await saveArchive(id, failedArchive, null)
    throw error
  }
}

// ✅ Single page archiving (original functionality)
async function archiveSinglePage (url, id, timestamp, options = {}) {
  console.log(`📄 Archiving single page: ${url}`)
  
  const { includeAssets = false } = options
  
  // ✅ Use new Puppeteer-based crawler when assets are enabled
  if (includeAssets) {
    console.log(`🚀 Using Puppeteer-based asset crawler for comprehensive archiving`)
    
    try {
      const crawlResult = await crawlPageWithAssets(url, id, {
        timeout: 30000,
        waitForNetworkIdle: 2000
      })
      
      // Create archive metadata
      const archive = {
        id,
        url: crawlResult.url,
        title: extractTitleFromHtml(crawlResult.html) || extractDomainFromUrl(crawlResult.url),
        timestamp,
        status: 'completed',
        pageCount: 1,
        size: crawlResult.html.length,
        assetsCount: crawlResult.assetsCount
      }
      
      console.log(`✅ Puppeteer crawl completed: ${archive.title}`)
      console.log(`📦 Assets downloaded: ${crawlResult.assetsCount}`)
      
      // Process HTML for final cleanup (navigation, banners, etc.)
      const processedHtml = processHtml(crawlResult.html, crawlResult.url, null, 0, true, id)
      
      // Save the archive
      await saveArchive(id, archive, processedHtml)
      
      return archive
      
    } catch (error) {
      console.error(`❌ Puppeteer crawling failed: ${error.message}`)
      throw new Error(`Asset crawling failed: ${error.message}`)
    }
  }
  
  // ✅ Simple HTML-only archiving (no assets)
  const response = await axios.get(url, {
    timeout: 30000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Greenboard-Archiver/1.0)'
    }
  })

  const html = response.data
  const title = extractTitleFromHtml(html) || extractDomainFromUrl(url)

  // ✅ Process HTML with archive ID for proper link rewriting
  const processedHtml = processHtml(html, url, null, 0, false, id)

  // Create archive metadata
  const archive = {
    id,
    url,
    title,
    timestamp,
    status: 'completed',
    pageCount: 1,
    size: html.length
  }

  console.log(`✅ Single page archived: ${title}`)
  
  // Save the archive
  await saveArchive(id, archive, processedHtml)

  return archive
}

// ✅ Multi-page archiving (enhanced functionality)
async function archiveMultiplePages (url, id, timestamp, options) {
  // Debug what's in options
  console.log(`🔧 archiveMultiplePages received options:`, options)
  console.log(`🔧 typeof options:`, typeof options)
  console.log(`🔧 options keys:`, Object.keys(options || {}))
  
  // First, get the actual final URL after redirects
  const firstPageData = await fetchPage(url)
  if (!firstPageData) {
    throw new Error('Could not fetch initial page')
  }

  // Use the final URL as our base for same-origin checking
  const baseUrl = new URL(firstPageData.url)  // ✅ Use redirected URL
  const { maxPages, maxDepth, sameOriginOnly, includeAssets, concurrency, requestDelay } = options
  
  console.log(`🔧 Destructured values:`)
  console.log(`   maxPages: ${maxPages} (${typeof maxPages})`)
  console.log(`   maxDepth: ${maxDepth} (${typeof maxDepth})`)
  console.log(`   sameOriginOnly: ${sameOriginOnly} (${typeof sameOriginOnly})`)
  console.log(`   includeAssets: ${includeAssets} (${typeof includeAssets})`)
  console.log(`   concurrency: ${concurrency} (${typeof concurrency})`)
  console.log(`   requestDelay: ${requestDelay} (${typeof requestDelay})`)
  
  console.log(`📚 Starting multi-page crawl: ${firstPageData.url}`)
  console.log(`🔄 Original URL: ${url} → Final URL: ${firstPageData.url}`)
  
  // ✅ Initialize with the first page already added
  const visitedUrls = new Set([firstPageData.url])
  const urlQueue = []
  const pages = [firstPageData]  // ✅ Start with first page in array
  const errors = []
  const assets = new Map()  // ✅ Track downloaded assets across all pages
  
  console.log(`✅ Added initial page: ${firstPageData.title}`)
  
  // Download assets for first page if enabled
  if (includeAssets) {
    console.log(`💾 Asset downloading ENABLED - using Puppeteer for first page`)
    
    try {
      console.log(`🚀 Using Puppeteer for first page asset crawling`)
      const crawlResult = await crawlPageWithAssets(firstPageData.url, id, {
        timeout: 30000,
        waitForNetworkIdle: 2000
      })
      
      // Update first page data with the Puppeteer result
      firstPageData.html = crawlResult.html
      firstPageData.url = crawlResult.url // Use final URL after redirects
      
      console.log(`✅ Puppeteer crawl for first page: ${crawlResult.assetsCount} assets`)
      
    } catch (puppeteerError) {
      console.error(`❌ Puppeteer failed for first page: ${puppeteerError.message}`)
      throw new Error(`Asset crawling failed for multi-page archive: ${puppeteerError.message}`)
    }
  } else {
    console.log(`❌ Asset downloading DISABLED - HTML only`)
  }
  
  // Extract links from first page to populate initial queue
  console.log(`🔍 Checking if we should extract links: maxDepth=${maxDepth} > 0`)
  if (maxDepth > 0) {
    console.log(`🔍 Extracting initial links from: ${firstPageData.url}`)
    console.log(`📄 HTML length: ${firstPageData.html.length} characters`)
    const initialLinks = extractLinks(firstPageData.html, firstPageData.url, baseUrl, sameOriginOnly)
    console.log(`🔗 Found ${initialLinks.length} initial links`)
    
    if (initialLinks.length > 0) {
      console.log(`📋 Initial links to add to queue:`)
      initialLinks.forEach((link, i) => {
        if (i < 10) console.log(`   ${i + 1}. ${link}`)
      })
    }
    
    let addedToQueue = 0
    initialLinks.forEach(link => {
      if (!visitedUrls.has(link)) {
        urlQueue.push({ url: link, depth: 1 })
        addedToQueue++
      } else {
        console.log(`   ⏭️ Skipping already visited: ${link}`)
      }
    })
    
    console.log(`📝 Added ${addedToQueue} links to queue (${initialLinks.length - addedToQueue} were already visited)`)
  } else {
    console.log(`❌ maxDepth is 0, skipping link extraction`)
  }

  // Breadth-first crawling for additional pages
  console.log(`⏱️ Starting concurrent crawling phase...`)
  const crawlStartTime = Date.now()
  
  while (urlQueue.length > 0 && pages.length < maxPages) {
    console.log(`📝 URL Queue (${urlQueue.length} remaining):`, urlQueue.slice(0, 3).map(item => item.url))
    console.log(`✅ Pages archived so far: ${pages.length}/${maxPages}`)

    // ✅ Process URLs in concurrent batches for better performance
    const batchSize = Math.min(concurrency, urlQueue.length, maxPages - pages.length)
    const currentBatch = urlQueue.splice(0, batchSize)
    
    console.log(`⚡ Processing batch of ${currentBatch.length} URLs concurrently`)
    const batchStartTime = Date.now()
    
    // Fetch all URLs in the batch concurrently
    const batchPromises = currentBatch.map(async ({ url: currentUrl, depth }) => {
      // Skip if already visited or too deep
      if (visitedUrls.has(currentUrl) || depth > maxDepth) {
        console.log(`⏭️ Skipping ${currentUrl} (visited: ${visitedUrls.has(currentUrl)}, depth: ${depth}/${maxDepth})`)
        return null
      }
      
      visitedUrls.add(currentUrl)
      const fetchStartTime = Date.now()
      
      console.log(`🔍 Fetching: ${currentUrl} (depth: ${depth})`)
      
      // Fetch page
      const pageData = await fetchPage(currentUrl)
      const fetchTime = Date.now() - fetchStartTime
      
      if (!pageData) {
        console.log(`❌ Failed to fetch: ${currentUrl} (${fetchTime}ms)`)
        return { error: `Failed to fetch: ${currentUrl}`, fetchTime }
      }
      
      console.log(`✅ Fetched: ${pageData.title} (${fetchTime}ms, ${pageData.size} bytes)`)
      
      // Download assets if enabled (concurrent with link extraction)
      let assetPromise = Promise.resolve()
      if (includeAssets) {
        // ✅ For multi-page archives, only download assets for the first page
        // Additional pages use simple HTML to keep crawling fast
        console.log(`📝 Multi-page mode: skipping assets for additional pages (only first page gets assets)`)
      }
      
      // Extract links if not at max depth
      let newLinks = []
      if (depth < maxDepth) {
        const linkStartTime = Date.now()
        newLinks = extractLinks(pageData.html, currentUrl, baseUrl, sameOriginOnly)
        const linkTime = Date.now() - linkStartTime
        console.log(`🔗 Found ${newLinks.length} links on ${currentUrl} (${linkTime}ms)`)
      }
      
      // Wait for asset download to complete
      await assetPromise
      
      return {
        pageData,
        newLinks,
        fetchTime,
        depth
      }
    })
    
    // Wait for all batch requests to complete
    const batchResults = await Promise.allSettled(batchPromises)
    const batchTime = Date.now() - batchStartTime
    
    // Process batch results
    let successCount = 0
    let errorCount = 0
    
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value && result.value.pageData) {
        const { pageData, newLinks, fetchTime, depth } = result.value
        pages.push(pageData)
        successCount++
        
        // Add new links to queue
        newLinks.forEach(link => {
          if (!visitedUrls.has(link) && pages.length + urlQueue.length < maxPages) {
            urlQueue.push({ url: link, depth: depth + 1 })
          }
        })
      } else {
        errorCount++
        if (result.status === 'fulfilled' && result.value && result.value.error) {
          errors.push(result.value.error)
        } else if (result.status === 'rejected') {
          console.error(`❌ Batch request failed:`, result.reason)
          errors.push(`Batch request failed: ${result.reason.message}`)
        }
      }
    })
    
    console.log(`⚡ Batch completed: ${successCount} success, ${errorCount} errors (${batchTime}ms total)`)
    console.log(`📊 Throughput: ${(successCount / (batchTime / 1000)).toFixed(1)} pages/sec for this batch`)
    
    // Small delay between batches to be respectful
    if (urlQueue.length > 0 && requestDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, requestDelay))
    }
  }
  
  const crawlTime = Date.now() - crawlStartTime
  
  console.log(`📊 Multi-page crawl completed:`)
  console.log(`   Pages successfully archived: ${pages.length}`)
  console.log(`   Errors encountered: ${errors.length}`)
  console.log(`   Total crawl time: ${crawlTime}ms (${(crawlTime / 1000).toFixed(2)}s)`)
  console.log(`   Average time per page: ${pages.length > 0 ? (crawlTime / pages.length).toFixed(0) : 0}ms`)
  console.log(`   Overall crawl throughput: ${(pages.length / (crawlTime / 1000)).toFixed(1)} pages/sec`)
  console.log(`   Final pages:`, pages.map(p => ({ url: p.url, title: p.title, size: p.size })))
  
  if (pages.length === 0) {
    throw new Error('No pages could be archived')
  }
  
  // ✅ Process all pages concurrently for better performance
  console.log(`⏱️ Starting HTML processing phase...`)
  const processStartTime = Date.now()
  
  const processedPages = await Promise.all(
    pages.map(async (page, index) => {
      const processStart = Date.now()
      const processedHtml = processHtml(page.html, page.url, pages, index, includeAssets, id)
      const processTime = Date.now() - processStart
      
      if (index < 5) { // Log first few for debugging
        console.log(`🔧 Processed page ${index + 1}: ${page.title} (${processTime}ms)`)
      }
      
      return {
        ...page,
        processedHtml
      }
    })
  )
  
  const processTime = Date.now() - processStartTime
  console.log(`⏱️ HTML processing completed: ${processTime}ms (${(processTime / pages.length).toFixed(0)}ms avg per page)`)
  
  // Create archive metadata
  console.log(`⏱️ Creating archive metadata...`)
  const metadataStartTime = Date.now()
  const archive = createArchiveMetadata(id, url, pages, timestamp, errors)
  const metadataTime = Date.now() - metadataStartTime
  console.log(`⏱️ Metadata created: ${metadataTime}ms`)
  
  // Save multi-page archive
  console.log(`⏱️ Saving archive to disk...`)
  const saveStartTime = Date.now()
  await saveMultiPageArchive(id, archive, processedPages)
  const saveTime = Date.now() - saveStartTime
  console.log(`⏱️ Archive saved: ${saveTime}ms`)
  
  console.log(`✅ Multi-page archive saved: ${archive.title}`)
  
  return archive
}

// ✅ Fetch individual page with optimized HTTP settings and anti-bot measures
async function fetchPage (url) {
  // ✅ Preprocess URL to handle common issues
  let processedUrl = url
  
  // Add https:// if no protocol
  if (!processedUrl.startsWith('http://') && !processedUrl.startsWith('https://')) {
    processedUrl = 'https://' + processedUrl
  }
  
  // Convert http:// to https:// for better success rate
  if (processedUrl.startsWith('http://')) {
    processedUrl = processedUrl.replace('http://', 'https://')
    console.log(`🔒 Converting to HTTPS: ${url} → ${processedUrl}`)
  }
  
  // ✅ More comprehensive browser-like headers
  const browserHeaders = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Cache-Control': 'max-age=0',
    'Connection': 'keep-alive'
  }

  // ✅ Try multiple approaches with different strategies
  const strategies = [
    {
      name: 'Standard',
      config: {
        headers: browserHeaders,
        timeout: 15000,
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 400,
        decompress: true,
        maxContentLength: 50 * 1024 * 1024,
        maxBodyLength: 50 * 1024 * 1024
      }
    },
    {
      name: 'With Referer',
      config: {
        headers: {
          ...browserHeaders,
          'Referer': 'https://www.google.com/'
        },
        timeout: 15000,
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 400
      }
    },
    {
      name: 'Simple Mobile',
      config: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        timeout: 15000,
        maxRedirects: 5
      }
    }
  ]

  for (const strategy of strategies) {
    try {
      console.log(`🔄 Trying ${strategy.name} strategy for: ${processedUrl}`)
      
      const response = await axios.get(processedUrl, strategy.config)
      
      // ✅ Get the final URL after redirects
      const finalUrl = response.request.res.responseUrl || processedUrl
      
      console.log(`✅ ${strategy.name} strategy succeeded for: ${finalUrl}`)
      
      const $ = cheerio.load(response.data)
      return {
        url: finalUrl,  // Use final URL, not original
        html: response.data,
        title: $('title').text().trim() || extractDomainFromUrl(finalUrl),
        size: response.data.length
      }
    } catch (error) {
      console.warn(`❌ ${strategy.name} strategy failed for ${processedUrl}: ${error.message}`)
      
      // If this isn't the last strategy, continue to next
      if (strategy !== strategies[strategies.length - 1]) {
        // Add delay between retries
        await new Promise(resolve => setTimeout(resolve, 1000))
        continue
      }
      
      // All strategies failed
      console.error(`❌ All strategies failed for ${processedUrl}:`, error.message)
      return null
    }
  }
}

// ✅ Extract links from page with optimized performance
function extractLinks (html, baseUrl, siteBase, sameOriginOnly) {
  const $ = cheerio.load(html)
  const links = new Set()
  const allHrefs = []
  const filteredOut = []
  const debugMode = false  // ✅ Disable verbose logging for performance
  
  if (debugMode) {
    console.log(`🔍 Extracting links from: ${baseUrl}`)
    console.log(`🏠 Site base origin: ${siteBase.origin}`)
    console.log(`🔒 Same origin only: ${sameOriginOnly}`)
  }
  
  $('a[href]').each((i, link) => {
    const href = $(link).attr('href')
    if (!href) return
    
    allHrefs.push(href)
    
    try {
      const absoluteUrl = new URL(href, baseUrl).href
      const linkUrl = new URL(absoluteUrl)
      
      // Debug first 10 links only in debug mode
      if (debugMode && i < 10) {
        console.log(`\n📎 Link ${i + 1}: ${href}`)
        console.log(`   Absolute: ${absoluteUrl}`)
        console.log(`   Origin: ${linkUrl.origin}`)
        console.log(`   Pathname: ${linkUrl.pathname}`)
      }
      
      // ✅ Optimized filter conditions - fail fast
      if (sameOriginOnly && linkUrl.origin !== siteBase.origin) {
        if (debugMode && i < 10) console.log(`   ❌ Different origin`)
        filteredOut.push({ href, reason: 'different origin' })
        return
      }
      
      // ✅ More comprehensive file extension filter
      if (linkUrl.pathname.match(/\.(pdf|jpg|jpeg|png|gif|svg|webp|ico|zip|rar|7z|tar|gz|doc|docx|xls|xlsx|ppt|pptx|mp3|mp4|avi|mov|wmv|flv|css|js|json|xml|txt|csv)$/i)) {
        if (debugMode && i < 10) console.log(`   ❌ File extension filtered`)
        filteredOut.push({ href, reason: 'file extension' })
        return
      }
      
      // ✅ Skip fragments/anchors on same page
      if (linkUrl.href.includes('#') && linkUrl.pathname === new URL(baseUrl).pathname) {
        if (debugMode && i < 10) console.log(`   ❌ Same-page anchor`)
        filteredOut.push({ href, reason: 'same-page anchor' })
        return
      }
      
      // ✅ Skip obvious duplicates
      if (linkUrl.pathname === '/' && baseUrl.includes(linkUrl.origin)) {
        if (debugMode && i < 10) console.log(`   ❌ Home page duplicate`)
        filteredOut.push({ href, reason: 'home page duplicate' })
        return
      }
      
      // ✅ Skip common non-content paths
      if (linkUrl.pathname.match(/^\/(api|admin|login|logout|signin|signup|register|account|profile|dashboard|cart|checkout|search|contact|about|privacy|terms|sitemap|robots\.txt|favicon\.ico)/)) {
        filteredOut.push({ href, reason: 'non-content path' })
        return
      }
      
      if (debugMode && i < 10) console.log(`   ✅ Adding to queue`)
      links.add(absoluteUrl)
    } catch (e) {
      if (debugMode && i < 10) console.log(`   ❌ Invalid URL: ${e.message}`)
      filteredOut.push({ href, reason: 'invalid URL' })
    }
  })
  
  // ✅ Simplified summary logging for performance
  if (debugMode) {
    console.log(`\n📊 Link extraction summary:`)
    console.log(`   Total href attributes found: ${allHrefs.length}`)
    console.log(`   Valid links added: ${links.size}`)
    console.log(`   Filtered out: ${filteredOut.length}`)
    
    // Show filter reasons
    const reasons = {}
    filteredOut.forEach(item => {
      reasons[item.reason] = (reasons[item.reason] || 0) + 1
    })
    console.log(`   Filter reasons:`, reasons)
  }
  
  return Array.from(links).slice(0, 100) // ✅ Increased limit but still capped
}

// ✅ Create archive metadata
function createArchiveMetadata (id, url, pages, timestamp, errors = []) {
  const totalSize = pages.reduce((sum, page) => sum + page.size, 0)
  const mainPage = pages[0] || {}
  
  return {
    id,
    url,
    title: mainPage.title || extractDomainFromUrl(url),
    timestamp,
    status: 'completed',
    pageCount: pages.length,
    size: totalSize,
    errors: errors,
    pages: pages.map(page => ({
      url: page.url,
      title: page.title,
      size: page.size
    }))
  }
}

// ✅ Enhanced HTML processing with navigation
function processHtml (html, baseUrl, allPages = null, currentPageIndex = 0, includeAssets = false, archiveId = null) {
  const $ = cheerio.load(html)
  
  // ✅ Remove only problematic elements, not all scripts
  $('meta[http-equiv="refresh"]').remove()  // Remove meta refresh redirects
  $('meta[name*="redirect"]').remove()  // Remove redirect meta tags
  $('meta[name="globalmessage-segment-redirect"]').remove()  // Remove Apple's redirect meta tag
  
  // ✅ Remove any elements with redirect-related attributes
  $('[data-redirect], [data-redirect-url], [data-redirect-to]').remove()
  
  // ✅ Remove any elements with redirect-related classes or IDs
  $('.redirect, #redirect, [class*="redirect"], [id*="redirect"]').remove()
  
  // ✅ Only remove external scripts, keep inline scripts for layout
  $('script[src]').remove()  // Remove external scripts
  // Keep inline scripts for now to preserve layout
  
  // ✅ Handle assets based on includeAssets setting
  if (includeAssets) {
    // ✅ Assets are already downloaded and paths rewritten by downloadPageAssets
    // ✅ DO NOT process assets here - they're already handled!
    console.log(`🔧 Skipping asset processing in processHtml (already handled by downloadPageAssets)`)
  } else {
    // ✅ Make all relative URLs absolute (current behavior)
    $('img').each((i, img) => {
      const src = $(img).attr('src')
      if (src && !src.startsWith('http') && !src.startsWith('data:')) {
        try {
          const absoluteUrl = new URL(src, baseUrl).href
          $(img).attr('src', absoluteUrl)
        } catch (e) {
          // Skip invalid URLs
        }
      }
    })

    $('link[rel="stylesheet"]').each((i, link) => {
      const href = $(link).attr('href')
      if (href && !href.startsWith('http')) {
        try {
          const absoluteUrl = new URL(href, baseUrl).href
          $(link).attr('href', absoluteUrl)
        } catch (e) {
          // Skip invalid URLs
        }
      }
    })
  }

  // ✅ Create a minimal, non-intrusive banner
  const bannerHtml = `
<div id="greenboard-banner" style="
  background: #f0f9ff; 
  border-bottom: 2px solid #3b82f6; 
  padding: 8px 15px; 
  text-align: center; 
  font-family: Arial, sans-serif; 
  font-size: 12px;
  color: #1e40af;
  position: sticky;
  top: 0;
  z-index: 1000;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
">
  📁 <strong>ARCHIVED</strong> - 
  <a href="${baseUrl}" target="_blank" style="color: #3b82f6; text-decoration: underline;">Original</a> - 
  ${new Date().toLocaleString()}
</div>
  `

  // ✅ Insert banner at the very beginning of body
  $('body').prepend(bannerHtml)
  
  // ✅ Fix internal links to point to archived versions
  $('a[href]').each((i, link) => {
    const href = $(link).attr('href')
    if (!href) return
    
    try {
      const absoluteUrl = new URL(href, baseUrl).href
      const linkUrl = new URL(absoluteUrl)
      const siteBase = new URL(baseUrl)
      
      // If it's an internal link (same origin)
      if (linkUrl.origin === siteBase.origin && archiveId) {
        // ✅ Simple path-based rewriting
        const pathPart = linkUrl.pathname === '/' ? '' : linkUrl.pathname
        const viewerUrl = `/api/view/${archiveId}${pathPart}`
        
        $(link).attr('href', viewerUrl)
      } else {
        // External link - point to original
        $(link).attr('href', absoluteUrl)
        $(link).attr('target', '_blank')
      }
    } catch (e) {
      // Skip invalid URLs
    }
  })
  
  // ✅ Debug: Log some info about the processed HTML
  const finalHtml = $.html()
  console.log(`🔧 HTML processing completed:`)
  console.log(`   Total length: ${finalHtml.length} characters`)
  console.log(`   CSS links: ${$('link[rel="stylesheet"]').length}`)
  console.log(`   Images: ${$('img').length}`)
  console.log(`   Scripts: ${$('script').length}`)
  
  // Log a few sample asset references
  $('link[rel="stylesheet"]').slice(0, 3).each((i, link) => {
    const href = $(link).attr('href')
    console.log(`   CSS[${i}]: ${href}`)
  })
  
  $('img').slice(0, 3).each((i, img) => {
    const src = $(img).attr('src')
    console.log(`   IMG[${i}]: ${src}`)
  })
  
  return finalHtml
}

// ✅ Utility function
function extractDomainFromUrl (url) {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

// ✅ Extract title from HTML
function extractTitleFromHtml (html) {
  try {
    const $ = cheerio.load(html)
    return $('title').text().trim()
  } catch {
    return null
  }
} 