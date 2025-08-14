import './globals.css'

export const metadata = {
  title: 'Mr. Archive - Web Archiver',
  description: 'Simple web page archiving tool'
}

export default function RootLayout ({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen" style={{ backgroundColor: '#016565' }}>
        <header
          className="shadow-sm border-b"
          style={{ backgroundColor: 'rgb(232, 233, 191)' }}
        >
          <div className="max-w-7xl mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold text-green-600">
              ArchiveBoard
            </h1>
            <p className="text-gray-600 text-sm">Web Archive Tool</p>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  )
} 