import fs from 'fs/promises'
import path from 'path'

const STORAGE_DIR = path.join(process.cwd(), 'archives')
const METADATA_FILE = path.join(STORAGE_DIR, 'metadata.json')

// Ensure storage directory exists
async function ensureStorageDir () {
  try {
    await fs.access(STORAGE_DIR)
  } catch {
    await fs.mkdir(STORAGE_DIR, { recursive: true })
  }
}

// Load metadata file
async function loadMetadata () {
  try {
    await ensureStorageDir()
    const data = await fs.readFile(METADATA_FILE, 'utf8')
    return JSON.parse(data)
  } catch {
    return []
  }
}

// Save metadata file
async function saveMetadata (archives) {
  await ensureStorageDir()
  await fs.writeFile(METADATA_FILE, JSON.stringify(archives, null, 2))
}

// Save an archive
export async function saveArchive (id, metadata, html) {
  const archives = await loadMetadata()
  
  // Add or update metadata
  const existingIndex = archives.findIndex(a => a.id === id)
  if (existingIndex >= 0) {
    archives[existingIndex] = metadata
  } else {
    archives.unshift(metadata) // Add to beginning for most recent first
  }
  
  await saveMetadata(archives)
  
  // Save HTML content if provided
  if (html) {
    const htmlFile = path.join(STORAGE_DIR, `${id}.html`)
    await fs.writeFile(htmlFile, html, 'utf8')
  }
}

// Get all archives metadata
export async function getArchives () {
  return await loadMetadata()
}

// Get archive metadata by ID
export async function getArchiveById (id) {
  const archives = await loadMetadata()
  return archives.find(a => a.id === id)
} 

// ✅ Add missing saveArchiveMetadata function
async function saveArchiveMetadata (id, metadata) {
  const archives = await loadMetadata()
  
  const existingIndex = archives.findIndex(a => a.id === id)
  if (existingIndex >= 0) {
    archives[existingIndex] = metadata
  } else {
    archives.unshift(metadata)
  }
  
  await saveMetadata(archives)
}

// ✅ Enhanced saveMultiPageArchive (clean up duplicate)
export async function saveMultiPageArchive(id, metadata, pages) {
  const archiveDir = path.join(STORAGE_DIR, id)
  await fs.mkdir(archiveDir, { recursive: true })
  
  // Save metadata to main metadata.json
  await saveArchiveMetadata(id, metadata)
  
  // Save pages
  for (const [index, page] of pages.entries()) {
    const filename = index === 0 ? 'index.html' : `page-${index}.html`
    await fs.writeFile(
      path.join(archiveDir, filename), 
      page.processedHtml, 
      'utf8'
    )
  }
  
  // Save sitemap for navigation
  const sitemap = pages.map((page, index) => ({
    url: page.url,
    title: page.title,
    file: index === 0 ? 'index.html' : `page-${index}.html`
  }))
  
  await fs.writeFile(
    path.join(archiveDir, 'sitemap.json'),
    JSON.stringify(sitemap, null, 2)
  )
}

// ✅ Enhanced getArchiveContent for multi-page
export async function getArchiveContent (id, page = 'index') {
  try {
    // Try single file first (backward compatibility)
    const singleFile = path.join(STORAGE_DIR, `${id}.html`)
    if (await fs.access(singleFile).then(() => true).catch(() => false)) {
      return await fs.readFile(singleFile, 'utf8')
    }
    
    // Try multi-page structure
    const filename = page === 'index' ? 'index.html' : `${page}.html`
    const multiFile = path.join(STORAGE_DIR, id, filename)
    return await fs.readFile(multiFile, 'utf8')
  } catch {
    return null
  }
} 