# 🌿 Greenboard - Web Archiver

A simple web archiving tool that saves snapshots of websites for offline viewing.

## Features

- Archive any public website with a single URL
- View archived pages offline
- Persistent storage using the file system
- Clean, responsive UI
- Archives include page title and timestamp

## How It Works

1. Enter a URL in the input field
2. Click "Archive" to save a snapshot
3. View archived pages from the list
4. Archived content is stored locally in the `archives/` directory

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Tech Stack

- **Frontend**: Next.js 14, React, Tailwind CSS
- **State Management**: Zustand
- **Backend**: Next.js API Routes
- **Web Scraping**: Axios + Cheerio
- **Storage**: File-based JSON + HTML files

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
│   └── utils.js        # Helper functions
└── archives/           # Stored archives (auto-created)
```

## Limitations

- Currently archives single pages only (no crawling)
- JavaScript is removed from archived pages
- External resources are linked (not downloaded)
- No authentication support for protected sites

## Future Enhancements

- Multi-page crawling within same domain
- Asset downloading (images, CSS, JS)
- Archive versioning and comparison
- Search within archived content
- Scheduled archiving 