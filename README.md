# Range Request Fetcher

A JavaScript library for reliably fetching large files using chunked range requests, automatic retries, and progress tracking.

## Features

- ✅ **Chunked fetching** - Splits large files into chunks for improved reliability
- ✅ **Automatic retries** - Automatically retries failed chunks
- ✅ **Progress tracking** - Real-time callbacks for progress updates
- ✅ **Authentication support** - Compatible with Bearer tokens and custom headers
- ✅ **Modern API** - Uses File System Access API for saving files
- ✅ **Error handling** - Robust handling of network and protocol errors

## Installation

```bash
npm install range-request-fetcher
```

## Basic Usage

```javascript
import { rangeRequestFetcher } from 'range-request-fetcher';

// Basic fetch
await rangeRequestFetcher({
  url: 'https://example.com/large-file.zip',
  fileName: 'my-download.zip'
});

// With progress tracking
await rangeRequestFetcher({
  url: 'https://example.com/large-file.zip',
  fileName: 'my-download.zip',
  onProgress: (percent) => console.log(`Progress: ${percent}%`),
  onStatus: (status) => console.log(`Status: ${status}`)
});

// With authentication
await rangeRequestFetcher({
  url: 'https://api.example.com/secure-file.zip',
  fileName: 'secure-file.zip',
  token: 'your-bearer-token',
  headers: {
    'X-API-Key': 'your-api-key'
  }
});
```

## API Reference

### rangeRequestFetcher(options)

Downloads a file using chunked range requests with automatic retries.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `url` | `string` | ✅ | - | URL of the file to download |
| `fileName` | `string` | ❌ | `'downloaded-file'` | Suggested name for the saved file |
| `token` | `string` | ❌ | - | Bearer token for authentication (automatically added to Authorization header) |
| `headers` | `object` | ❌ | `{}` | Custom HTTP headers |
| `chunkSize` | `number` | ❌ | `104857600` (100MB) | Size of each chunk in bytes |
| `maxRetries` | `number` | ❌ | `10` | Maximum number of retries per chunk |
| `onProgress` | `function` | ❌ | `() => {}` | Callback called with progress percentage (0-100) |
| `onStatus` | `function` | ❌ | `() => {}` | Callback called with status updates |

#### onStatus States

- `'preparing'` - Getting file information
- `'downloading'` - Downloading chunks
- `'retrying ${start}-${end}, attempt ${retries}'` - Retrying a specific chunk
- `'finalizing'` - Finalizing the download
- `'done'` - Download completed successfully
- `'error'` - Download error

#### Advanced Example

```javascript
import { rangeRequestFetcher } from 'range-request-fetcher';

try {
  await rangeRequestFetcher({
    url: 'https://releases.ubuntu.com/22.04/ubuntu-22.04.3-desktop-amd64.iso',
    fileName: 'ubuntu-22.04.3-desktop-amd64.iso',
    chunkSize: 50 * 1024 * 1024, // 50MB chunks
    maxRetries: 5,
    headers: {
      'User-Agent': 'MyApp/1.0'
    },
    onProgress: (percent) => {
      document.getElementById('progress').style.width = `${percent}%`;
      document.getElementById('percent').textContent = `${percent}%`;
    },
    onStatus: (status) => {
      document.getElementById('status').textContent = status;
    }
  });
  
  console.log('Download completed!');
} catch (error) {
  console.error('Download error:', error.message);
}
```

## Server Configuration

For this library to work correctly, your HTTP server must support:

1. **HEAD requests** - To get file size information
2. **Range requests** - To download chunks
3. **CORS headers** - Only needed for cross-origin requests (different domain/port/protocol)

### Same-Origin Setup (No CORS needed)

If your web app and files are served from the same domain, you only need to enable range requests:

### Same-Origin Setup (No CORS needed)

If your web app and files are served from the same domain, you only need to enable range requests:

#### Nginx (Same Origin)
```nginx
server {
    listen 80;
    server_name example.com;
    
    location /downloads/ {
        # Enable range requests
        add_header Accept-Ranges bytes;
        
        # Serve static files
        root /var/www/downloads;
        try_files $uri =404;
    }
}
```

#### Apache (Same Origin)
```apache
<VirtualHost *:80>
    ServerName example.com
    DocumentRoot /var/www/downloads
    
    <Directory "/var/www/downloads">
        # Enable range requests
        Header always set Accept-Ranges "bytes"
    </Directory>
</VirtualHost>
```

### Cross-Origin Setup (CORS required)

If your files are served from a different domain/port/protocol, you need CORS headers:

### Nginx (Cross-Origin)

```nginx
server {
    listen 80;
    server_name example.com;
    
    location /downloads/ {
        # Enable range requests
        add_header Accept-Ranges bytes;
        
        # CORS Headers
        add_header Access-Control-Allow-Origin "otherdomain.com";
        add_header Access-Control-Allow-Methods "GET, HEAD, OPTIONS";
        add_header Access-Control-Allow-Headers "Range, Content-Type, Authorization";
        add_header Access-Control-Expose-Headers "Content-Length, Content-Range, Accept-Ranges";
        
        # Handle preflight OPTIONS
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Max-Age 86400;
            add_header Content-Length 0;
            add_header Content-Type text/plain;
            return 204;
        }
        
        # Serve static files
        root /var/www/downloads;
        try_files $uri =404;
    }
}
```

### Apache (Cross-Origin)

```apache
<VirtualHost *:80>
    ServerName example.com
    DocumentRoot /var/www/downloads
    
    <Directory "/var/www/downloads">
        # Enable range requests
        Header always set Accept-Ranges "bytes"
        
        # CORS Headers
        Header always set Access-Control-Allow-Origin "otherdomain.com"
        Header always set Access-Control-Allow-Methods "GET, HEAD, OPTIONS"
        Header always set Access-Control-Allow-Headers "Range, Content-Type, Authorization"
        Header always set Access-Control-Expose-Headers "Content-Length, Content-Range, Accept-Ranges"
        
        # Handle preflight OPTIONS
        RewriteEngine On
        RewriteCond %{REQUEST_METHOD} OPTIONS
        RewriteRule ^(.*)$ $1 [R=204,L]
    </Directory>
</VirtualHost>

# Load required modules
LoadModule headers_module modules/mod_headers.so
LoadModule rewrite_module modules/mod_rewrite.so
```

### Express.js (Node.js)

```javascript
const express = require('express');
const path = require('path');
const app = express();

// Middleware CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'otherdomain.com');
  res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Range, Content-Type, Authorization');
  res.header('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
  
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Max-Age', '86400');
    return res.status(204).send();
  }
  
  next();
});

// Serve files with range support
app.use('/downloads', express.static('downloads', {
  acceptRanges: true,
  lastModified: true,
  etag: true
}));

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### Cloudflare Workers

```javascript
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Only handle download routes
    if (!url.pathname.startsWith('/downloads/')) {
      return new Response('Not found', { status: 404 });
    }
    
    // CORS Headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': 'otherdomain.com',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type, Authorization',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges'
    };
    
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeaders,
          'Access-Control-Max-Age': '86400'
        }
      });
    }
    
    // Fetch file from your storage
    const fileResponse = await fetch(`https://your-storage.com${url.pathname}`, {
      method: request.method,
      headers: request.headers
    });
    
    const response = new Response(fileResponse.body, {
      status: fileResponse.status,
      headers: {
        ...Object.fromEntries(fileResponse.headers),
        ...corsHeaders,
        'Accept-Ranges': 'bytes'
      }
    });
    
    return response;
  }
};
```

## Compatibility

- ✅ **Modern browsers** - Chrome 86+, Firefox 82+, Safari 14+
- ✅ **File System Access API** - Required for saving files
- ✅ **Fetch API** - For HTTP requests
- ✅ **ES Modules** - Import/export syntax

## Limitations

- Only works in browsers that support File System Access API
- Requires server to support Range Requests
- Needs proper CORS configuration for cross-origin usage

## Use Cases

- Downloading large files (ISOs, videos, datasets)
- Applications handling multimedia files
- Backup and synchronization tools
- Software distribution platforms

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests if necessary
4. Submit a pull request

## License

MIT © César Duque Calle
