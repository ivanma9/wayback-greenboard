import { NextResponse } from 'next/server'
import { getArchiveContent } from '../../../../lib/storage'

export async function GET (request, { params }) {
  try {
    const { id } = params
    const content = await getArchiveContent(id)
    
    if (!content) {
      return new NextResponse('Archive not found', { status: 404 })
    }

    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/html'
      }
    })
  } catch (error) {
    console.error('View archive error:', error)
    return new NextResponse('Failed to load archive', { status: 500 })
  }
} 