import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

export async function GET (request, { params }) {
  try {
    const { id, filename } = params
    
    // Construct the path to the asset file
    const assetPath = path.join(process.cwd(), 'archives', id, 'assets', filename)
    
    // Check if file exists and read it
    const fileBuffer = await fs.readFile(assetPath)
    
    // Determine content type based on file extension
    const ext = path.extname(filename).toLowerCase()
    let contentType = 'application/octet-stream'
    
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg'
        break
      case '.png':
        contentType = 'image/png'
        break
      case '.gif':
        contentType = 'image/gif'
        break
      case '.svg':
        contentType = 'image/svg+xml'
        break
      case '.webp':
        contentType = 'image/webp'
        break
      case '.css':
        contentType = 'text/css'
        break
      case '.js':
        contentType = 'application/javascript'
        break
      case '.woff':
        contentType = 'font/woff'
        break
      case '.woff2':
        contentType = 'font/woff2'
        break
      case '.ttf':
        contentType = 'font/ttf'
        break
      case '.eot':
        contentType = 'application/vnd.ms-fontobject'
        break
      case '.ico':
        contentType = 'image/x-icon'
        break
    }
    
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000'
      }
    })
  } catch (error) {
    console.error(`❌ Asset serving error for ${params?.filename}:`, error.message)
    return new NextResponse('Asset not found', { status: 404 })
  }
} 