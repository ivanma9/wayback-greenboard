import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Generate a simple unique ID
export function generateId () {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

// Format file size
export function formatFileSize (bytes: number) {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Validate URL
export function isValidUrl (string: string) {
  try {
    new URL(string)
    return true
  } catch {
    return false
  }
}

// Extract domain from URL
export function extractDomain (url: string) {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
} 