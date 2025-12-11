# Range Request Fetcher

A JavaScript library for reliably fetching large files using chunked range requests, automatic retries, and progress tracking. Specifically designed to handle common network errors like `ERR_HTTP2_PROTOCOL_ERROR` and `ERR_SSL_PROTOCOL_ERROR` that frequently occur when downloading large files over unstable connections.

## Handling download problems

This library specifically handles common network errors that occur during large file downloads:

### ERR_HTTP2_PROTOCOL_ERROR
This error typically occurs when:
- The HTTP/2 connection is disrupted or closed unexpectedly
- The server terminates the stream prematurely
- Network instability causes protocol-level issues

**How range-request-fetcher helps:**
- Automatically retries failed requests with exponential backoff
- Resumes downloads from the last successful byte position

### ERR_SSL_PROTOCOL_ERROR
This error happens when:
- SSL/TLS handshake fails or is interrupted
- Certificate validation issues occur
- Secure connection is dropped during transfer

**How range-request-fetcher helps:**
- Implements intelligent retry logic for SSL failures
- Maintains connection state to resume from interruption points
- Uses chunked requests to minimize data loss on connection drops

These features make the library particularly reliable for downloading large files over unstable connections or from servers with intermittent issues

## Features

- **Chunked fetching** - Splits large files into chunks for improved reliability
- **Automatic retries** - Automatically retries failed chunks
- **Progress tracking** - Real-time callbacks for progress updates
- **Pause/Resume/Abort** - Full download control with pause, resume, and abort functionality
- **Authentication support** - Compatible with Bearer tokens and custom headers
- **Modern API** - Uses File System Access API for saving files
- **Error handling** - Robust handling of network and protocol errors

## Installation

```bash
npm install range-request-fetcher
```

## Basic Usage

```javascript
import { rangeRequestFetcher } from 'range-request-fetcher';

// Basic fetch (Promise-based)
const download = rangeRequestFetcher({
  url: 'https://example.com/large-file.zip',
  fileName: 'my-download.zip'
});

await download.promise;
console.log('Download completed!');
```

## Download Control Examples

### Simple Progress Tracking
```javascript
const download = rangeRequestFetcher({
  url: 'https://example.com/large-file.zip',
  fileName: 'my-download.zip',
  onProgress: (percent) => console.log(`Progress: ${percent}%`),
  onStatus: (status) => console.log(`Status: ${status}`)
});

await download.promise;
```

### Pause and Resume
```javascript
const download = rangeRequestFetcher({
  url: 'https://example.com/large-file.zip',
  fileName: 'my-download.zip',
  onProgress: (percent) => {
    console.log(`Progress: ${percent}%`);
    
    // Auto-pause at 50%
    if (percent === 50) {
      download.pause();
      console.log('Download paused at 50%');
      
      // Resume after 5 seconds
      setTimeout(() => {
        download.resume();
        console.log('Download resumed');
      }, 5000);
    }
  }
});

await download.promise;
```

### Manual Control with UI
```javascript
const download = rangeRequestFetcher({
  url: 'https://example.com/ubuntu-22.04.3-desktop-amd64.iso',
  fileName: 'ubuntu-22.04.3-desktop-amd64.iso',
  onProgress: (percent) => {
    document.getElementById('progress').style.width = `${percent}%`;
    document.getElementById('percent').textContent = `${percent}%`;
  },
  onStatus: (status) => {
    document.getElementById('status').textContent = status;
  }
});

// UI Controls
document.getElementById('pauseBtn').onclick = () => {
  download.pause();
  document.getElementById('pauseBtn').disabled = true;
  document.getElementById('resumeBtn').disabled = false;
};

document.getElementById('resumeBtn').onclick = () => {
  download.resume();
  document.getElementById('pauseBtn').disabled = false;
  document.getElementById('resumeBtn').disabled = true;
};

document.getElementById('abortBtn').onclick = () => {
  download.abort();
  console.log('Download cancelled');
};

// Check download state
setInterval(() => {
  console.log(`Paused: ${download.isPaused()}, Aborted: ${download.isAborted()}, Progress: ${download.getProgress()}%`);
}, 1000);

try {
  await download.promise;
  console.log('Download completed!');
} catch (error) {
  if (download.isAborted()) {
    console.log('Download was cancelled by user');
  } else {
    console.error('Download failed:', error.message);
  }
}
```

### With Authentication
```javascript
const download = rangeRequestFetcher({
  url: 'https://api.example.com/secure-file.zip',
  fileName: 'secure-file.zip',
  token: 'your-bearer-token',
  headers: {
    'X-API-Key': 'your-api-key'
  },
  onProgress: (percent) => console.log(`Progress: ${percent}%`)
});

// You can still control authenticated downloads
setTimeout(() => download.pause(), 5000);
setTimeout(() => download.resume(), 10000);

await download.promise;
```

## API Reference

### rangeRequestFetcher(options)

Downloads a file using chunked range requests with automatic retries and full download control.

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

#### Return Value

The function returns a control object with the following methods and properties:

| Method/Property | Type | Description |
|-----------------|------|-------------|
| `promise` | `Promise` | Main download promise to await |
| `pause()` | `function` | Pauses the download |
| `resume()` | `function` | Resumes the download |
| `abort()` | `function` | Cancels the download completely |
| `isPaused()` | `function` | Returns `true` if download is paused |
| `isAborted()` | `function` | Returns `true` if download was aborted |
| `getProgress()` | `function` | Returns current progress percentage (0-100) |

#### onStatus States

- `'preparing'` - Getting file information
- `'downloading'` - Downloading chunks
- `'paused'` - Download is paused
- `'aborted'` - Download was cancelled
- `'retrying ${start}-${end}, attempt ${retries}'` - Retrying a specific chunk
- `'finalizing'` - Finalizing the download
- `'done'` - Download completed successfully
- `'error'` - Download error

#### Complete Example with Error Handling

```javascript
import { rangeRequestFetcher } from 'range-request-fetcher';

const download = rangeRequestFetcher({
  url: 'https://releases.ubuntu.com/22.04/ubuntu-22.04.3-desktop-amd64.iso',
  fileName: 'ubuntu-22.04.3-desktop-amd64.iso',
  chunkSize: 50 * 1024 * 1024, // 50MB chunks
  maxRetries: 5,
  headers: {
    'User-Agent': 'MyApp/1.0'
  },
  onProgress: (percent) => {
    console.log(`Download progress: ${percent}%`);
    
    // Update UI
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    
    if (progressBar) progressBar.style.width = `${percent}%`;
    if (progressText) progressText.textContent = `${percent}%`;
  },
  onStatus: (status) => {
    console.log(`Download status: ${status}`);
    
    const statusElement = document.getElementById('download-status');
    if (statusElement) statusElement.textContent = status;
    
    // Handle different states
    if (status === 'paused') {
      document.getElementById('pause-btn')?.setAttribute('disabled', 'true');
      document.getElementById('resume-btn')?.removeAttribute('disabled');
    } else if (status === 'downloading') {
      document.getElementById('pause-btn')?.removeAttribute('disabled');
      document.getElementById('resume-btn')?.setAttribute('disabled', 'true');
    }
  }
});

// Set up UI controls
document.getElementById('pause-btn')?.addEventListener('click', () => {
  download.pause();
  console.log('Download paused by user');
});

document.getElementById('resume-btn')?.addEventListener('click', () => {
  download.resume();
  console.log('Download resumed by user');
});

document.getElementById('cancel-btn')?.addEventListener('click', () => {
  download.abort();
  console.log('Download cancelled by user');
});

// Monitor download state
const monitor = setInterval(() => {
  const progress = download.getProgress();
  const paused = download.isPaused();
  const aborted = download.isAborted();
  
  console.log(`State - Progress: ${progress}%, Paused: ${paused}, Aborted: ${aborted}`);
  
  if (aborted || progress === 100) {
    clearInterval(monitor);
  }
}, 2000);

// Wait for completion
try {
  await download.promise;
  console.log('Download completed successfully!');
  clearInterval(monitor);
} catch (error) {
  clearInterval(monitor);
  
  if (download.isAborted()) {
    console.log('Download was cancelled by user');
  } else {
    console.error('Download failed:', error.message);
    
    // Show user-friendly error messages
    if (error.message.includes('ERR_HTTP2_PROTOCOL_ERROR')) {
      console.log('Try again - HTTP/2 connection issue detected');
    } else if (error.message.includes('ERR_SSL_PROTOCOL_ERROR')) {
      console.log('Try again - SSL connection issue detected');
    }
  }
}
```

