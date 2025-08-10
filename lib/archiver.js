import axios from 'axios'
import cheerio from 'cheerio'
import { saveArchive } from './storage'
import { generateId } from './utils'

export async function archiveWebsite (url) {
  const id = generateId()
  const timestamp = Date.now()
  
  try {
    // Fetch the main page
    const response = await axios.get(url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Greenboard-Archiver/1.0)'
      }
    })

    const html = response.data
    const $ = cheerio.load(html)
    
    // Extract page title
    const title = $('title').text().trim() || new URL(url).hostname

    // Basic HTML processing - make paths relative and clean up
    const processedHtml = processHtml(html, url)

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

    // Save the archive
    await saveArchive(id, archive, processedHtml)

    return archive
  } catch (error) {
    console.error('Archive failed:', error)
    
    // Save failed archive metadata
    const failedArchive = {
      id,
      url,
      title: new URL(url).hostname,
      timestamp,
      status: 'failed',
      error: error.message
    }
    
    await saveArchive(id, failedArchive, null)
    throw error
  }
}

function processHtml (html, baseUrl) {
  const $ = cheerio.load(html)
  
  // Remove scripts that might cause issues when viewing offline
  $('script').remove()
  
  // Convert relative URLs to absolute URLs for external resources
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

  // Add a banner to indicate this is an archived page
  const banner = `
    <div style="background: #f0f9ff; border-bottom: 2px solid #3b82f6; padding: 10px; text-align: center; font-family: sans-serif; position: sticky; top: 0; z-index: 9999;">
      <strong>📁 Archived Page</strong> - 
      Original: <a href="${baseUrl}" target="_blank" style="color: #3b82f6;">${baseUrl}</a> - 
      Archived: ${new Date().toLocaleString()}
    </div>
  `
  
  $('body').prepend(banner)
  
  return $.html()
} 