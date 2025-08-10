import './globals.css'

export const metadata = {
  title: 'Greenboard - Web Archiver',
  description: 'Simple web page archiving tool'
}

export default function RootLayout ({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold text-green-600">
              🌿 Greenboard
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