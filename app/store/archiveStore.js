import { create } from 'zustand'
import axios from 'axios'

export const useArchiveStore = create((set, get) => ({
  archives: [],
  isLoading: false,
  error: null,

  // Archive a new URL
  archiveUrl: async (url, options = {}) => {
    set({ isLoading: true, error: null })
    
    try {
      const response = await axios.post('/api/archive', { url, options })
      const newArchive = response.data
      
      set(state => ({
        archives: [newArchive, ...state.archives],
        isLoading: false
      }))
      
      return newArchive
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Failed to archive URL'
      set({ error: errorMessage, isLoading: false })
      throw new Error(errorMessage)
    }
  },

  // Load existing archives
  loadArchives: async () => {
    try {
      const response = await axios.get('/api/archives')
      set({ archives: response.data })
    } catch (error) {
      set({ error: 'Failed to load archives' })
    }
  },

  // Clear error
  clearError: () => set({ error: null })
})) 