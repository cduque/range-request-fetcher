export function rangeRequestFetcher({
  url,
  fileName = 'downloaded-file',
  token,
  headers = {},
  chunkSize = 1024 * 1024 * 100,
  maxRetries = 10,
  onProgress = () => {},
  onStatus = () => {}
}) {
  let totalSize = 0
  let downloadedSize = 0
  let writer
  let isPaused = false
  let isAborted = false
  let currentController = null

  const buildHeaders = (extra = {}) => {
    const h = { ...headers, ...extra }
    if (token && !h.Authorization) h.Authorization = `Bearer ${token}`
    return h
  }

  const waitWhilePaused = () => {
    return new Promise((resolve) => {
      const checkPause = () => {
        if (isAborted) {
          throw new Error('Download aborted')
        }
        if (!isPaused) {
          resolve()
        } else {
          setTimeout(checkPause, 100)
        }
      }
      checkPause()
    })
  }

  const downloadPromise = (async () => {
    try {
      onStatus('preparing')

      const headResponse = await fetch(url, {
        method: 'HEAD',
        headers: buildHeaders()
      })

      if (!headResponse.ok)
        throw new Error(`Failed to get file info: ${headResponse.status}`)

      totalSize = parseInt(headResponse.headers.get('Content-Length')) || 0
      if (!totalSize)
        throw new Error('Could not determine file size')

      const fileHandle = await window.showSaveFilePicker({ suggestedName: fileName })
      writer = await fileHandle.createWritable()

      while (downloadedSize < totalSize && !isAborted) {
        await waitWhilePaused()
        
        if (isAborted) break

        const start = downloadedSize
        const end = Math.min(start + chunkSize - 1, totalSize - 1)
        let retries = 0
        let success = false

        while (!success && retries < maxRetries && !isAborted) {
          try {
            await waitWhilePaused()
            
            if (isAborted) break

            currentController = new AbortController()
            
            const res = await fetch(url, {
              method: 'GET',
              headers: buildHeaders({
                Range: `bytes=${start}-${end}`,
                'Cache-Control': 'no-cache'
              }),
              cache: 'no-store',
              signal: currentController.signal
            })

            if (!res.ok)
              throw new Error(`Chunk fetch failed: ${res.status}`)

            const chunk = await res.arrayBuffer()
            
            await waitWhilePaused()
            
            if (isAborted) break

            await writer.write(chunk)

            downloadedSize += chunk.byteLength
            onProgress(Math.floor((downloadedSize / totalSize) * 100))
            onStatus(isPaused ? 'paused' : 'downloading')
            success = true
            currentController = null
          } catch (err) {
            currentController = null
            
            if (err.name === 'AbortError' || isAborted) {
              break
            }
            
            retries++
            onStatus(`retrying ${start}-${end}, attempt ${retries}`)
            if (retries >= maxRetries)
              throw new Error(`Chunk ${start}-${end} failed after ${maxRetries} retries: ${err.message}`)
            await new Promise(r => setTimeout(r, 1000 * retries))
          }
        }
        
        if (isAborted) break
      }

      if (isAborted) {
        onStatus('aborted')
        throw new Error('Download aborted')
      }

      onStatus('finalizing')
      await writer.close()
      onStatus('done')
    } catch (err) {
      if (!isAborted) {
        onStatus('error')
      }
      if (writer) try { 
        await writer.close() 
      } catch {}
      if (currentController) {
        currentController.abort()
      }
      console.error('Fetch failed:', err)
      throw err
    }
  })()

  // Return control object
  return {
    promise: downloadPromise,
    pause: () => {
      isPaused = true
      onStatus('paused')
    },
    resume: () => {
      isPaused = false
      onStatus('downloading')
    },
    abort: () => {
      isAborted = true
      if (currentController) {
        currentController.abort()
      }
      onStatus('aborted')
    },
    isPaused: () => isPaused,
    isAborted: () => isAborted,
    getProgress: () => totalSize > 0 ? Math.floor((downloadedSize / totalSize) * 100) : 0
  }
}
