# 🌿 Greenboard - Web Archiver

A powerful web archiving tool that saves complete snapshots of websites for offline viewing, with support for multi-page crawling and asset downloading.

## Features

- **Multi-page Crawling** - Archive entire websites with configurable depth and page limits
- **Asset Downloading** - Optional downloading of images, CSS, and other assets for complete offline viewing
- **Concurrent Processing** - Fast archiving with configurable concurrency settings
- **Smart Path Resolution** - Accurate navigation within archived content
- **Anti-bot Measures** - Multi-strategy web scraping for high success rates
- **Clean, Responsive UI** - Modern interface with real-time feedback
- **File-based Storage** - Portable archives stored locally in the `archives/` directory

## How It Works

1. **Enter a URL** in the input field
2. **Choose options** - Enable asset downloading for complete archives
3. **Click "Archive"** to start the crawling process
4. **View archived pages** from the list with full navigation
5. **Browse offline** - All content is stored locally for offline viewing

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/ivanma9/wayback-greenboard.git
cd greenboard
```

2. **Install dependencies:**
```bash
npm install
```

3. **Run the development server:**
```bash
npm run dev
```

4. **Open your browser:**
Navigate to [http://localhost:3000](http://localhost:3000) (or the port shown in terminal)

### Usage

1. **Basic Archiving:**
   - Enter a URL (e.g., `https://example.com`)
   - Click "Archive" for fast single-page archiving

2. **Complete Website Archiving:**
   - Enter a URL
   - Check "Download assets" for complete offline viewing
   - Click "Archive" to crawl multiple pages

3. **Viewing Archives:**
   - Browse the archive list
   - Click "View" to open archived content
   - Navigate between pages using internal links

## Configuration

### Archive Options

- **Max Pages:** Maximum number of pages to archive (default: 50)
- **Max Depth:** How deep to crawl from the starting page (default: 3)
- **Concurrency:** Number of simultaneous requests (default: 5)
- **Asset Downloading:** Enable to download images and CSS files

### Performance Tuning

For large websites, consider:
- Reducing concurrency for slower servers
- Increasing request delays to be more respectful
- Limiting max pages to control storage usage

## Tech Stack

- **Frontend:** Next.js 14, React, Tailwind CSS
- **State Management:** Zustand
- **Backend:** Next.js API Routes
- **Web Scraping:** Axios + Cheerio
- **Storage:** File-based JSON + HTML files

## Project Structure

```
greenboard/
├── app/                 # Next.js app directory
│   ├── components/      # React components
│   ├── store/          # Zustand state management
│   └── api/            # API routes
├── lib/                # Core utilities
│   ├── archiver.js     # Web scraping logic
│   ├── storage.js      # File system operations
│   ├── assetDownloader.js # Asset downloading
│   └── utils.js        # Helper functions
├── archives/           # Stored archives (auto-created)
│   ├── metadata.json   # Archive metadata
│   └── [id]/           # Individual archives
└── TECHNICAL_WRITEUP.md # Technical decisions & scaling
```

## Archive Storage

Archives are stored in the `archives/` directory:

- **Single-page archives:** `archives/[id].html`
- **Multi-page archives:** `archives/[id]/` directory with:
  - `index.html` - Main page
  - `page-X.html` - Additional pages
  - `sitemap.json` - Navigation mapping
  - `assets/` - Downloaded assets (if enabled)

## Troubleshooting

### Common Issues

1. **Port already in use:**
   - The server will automatically try the next available port
   - Check the terminal output for the correct URL

2. **Archive fails:**
   - Some sites may block automated requests
   - Try enabling asset downloading for better compatibility
   - Check the browser console for error details

3. **Slow archiving:**
   - Reduce concurrency settings
   - Disable asset downloading for faster processing
   - Check your internet connection

### Performance Tips

- Use SSD storage for better I/O performance
- Increase Node.js memory limit for large archives: `NODE_OPTIONS="--max-old-space-size=4096"`
- Monitor disk space usage for large archives

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Technical Details

For detailed technical information about architecture decisions, trade-offs, and production scaling strategies, see [TECHNICAL_WRITEUP.md](./TECHNICAL_WRITEUP.md). 