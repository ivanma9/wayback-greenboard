import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import axios from 'axios'
import cheerio from 'cheerio'

export async function downloadPageAssets(pageData, assetsMap, archiveId) {
  // ✅ Simple approach: just return the HTML as-is
  // No asset downloading for now - let external resources load normally
  console.log(`💾 Skipping asset download for: ${pageData.url}`)
  return pageData.html
}
