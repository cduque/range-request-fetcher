export async function reliableDownload({
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

  const buildHeaders = (extra = {}) => {
    const h = { ...headers, ...extra }
    if (token && !h.Authorization) h.Authorization = `Bearer ${token}`
    return h
  }

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

    while (downloadedSize < totalSize) {
      const start = downloadedSize
      const end = Math.min(start + chunkSize - 1, totalSize - 1)
      let retries = 0
      let success = false

      while (!success && retries < maxRetries) {
        try {
          const res = await fetch(url, {
            method: 'GET',
            headers: buildHeaders({
              Range: `bytes=${start}-${end}`,
              'Cache-Control': 'no-cache'
            }),
            cache: 'no-store'
          })

          if (!res.ok)
            throw new Error(`Chunk fetch failed: ${res.status}`)

          const chunk = await res.arrayBuffer()
          await writer.write(chunk)

          downloadedSize += chunk.byteLength
          onProgress(Math.floor((downloadedSize / totalSize) * 100))
          onStatus('downloading')
          success = true
        } catch (err) {
          retries++
          onStatus(`retrying ${start}-${end}, attempt ${retries}`)
          if (retries >= maxRetries)
            throw new Error(`Chunk ${start}-${end} failed after ${maxRetries} retries: ${err.message}`)
          await new Promise(r => setTimeout(r, 1000 * retries))
        }
      }
    }

    onStatus('finalizing')
    await writer.close()
    onStatus('done')
  } catch (err) {
    onStatus('error')
    if (writer) try { 
      await writer.close() 
    } catch {}
    console.error('Download failed:', err)
    throw err
  }
}
