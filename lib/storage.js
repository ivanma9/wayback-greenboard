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

// Get archive content by ID
export async function getArchiveContent (id) {
  try {
    const htmlFile = path.join(STORAGE_DIR, `${id}.html`)
    return await fs.readFile(htmlFile, 'utf8')
  } catch {
    return null
  }
}

// Get archive metadata by ID
export async function getArchiveById (id) {
  const archives = await loadMetadata()
  return archives.find(a => a.id === id)
} 