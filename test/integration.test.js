import { describe, it, expect, vi } from 'vitest'
import { rangeRequestFetcher } from '../index.js'

describe('Integration Tests', () => {
  it('should handle a complete download workflow', async () => {
    const fileSize = 250 * 1024 * 1024
    const chunkSize = 100 * 1024 * 1024
    
    const progressUpdates = []
    const statusUpdates = []
    
    const onProgress = (percent) => progressUpdates.push(percent)
    const onStatus = (status) => statusUpdates.push(status)

    fetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: vi.fn().mockReturnValue(fileSize.toString()) }
    })

    for (let i = 0; i < 3; i++) {
      const chunkSize = i < 2 ? 100 * 1024 * 1024 : 50 * 1024 * 1024
      fetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(chunkSize))
      })
    }

    const download = rangeRequestFetcher({
      url: 'https://example.com/large-file.zip',
      fileName: 'large-file.zip',
      token: 'auth-token',
      chunkSize,
      maxRetries: 3,
      onProgress,
      onStatus,
      headers: {
        'User-Agent': 'TestApp/1.0'
      }
    })

    // Test that control object is returned
    expect(download).toHaveProperty('promise')
    expect(download).toHaveProperty('pause')
    expect(download).toHaveProperty('resume')
    expect(download).toHaveProperty('abort')

    await download.promise

    expect(statusUpdates).toEqual([
      'preparing',
      'downloading',
      'downloading', 
      'downloading',
      'finalizing',
      'done'
    ])

    expect(progressUpdates).toContain(40)
    expect(progressUpdates).toContain(80)
    expect(progressUpdates).toContain(100)

    expect(fetch).toHaveBeenCalledTimes(4)
  })

  it('should handle mixed success/retry scenarios', async () => {
    const fileSize = 200 * 1024 * 1024
    const chunkSize = 100 * 1024 * 1024
    
    const statusUpdates = []
    const onStatus = (status) => statusUpdates.push(status)

    fetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: vi.fn().mockReturnValue(fileSize.toString()) }
    })

    fetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(chunkSize))
    })

    fetch.mockRejectedValueOnce(new Error('Temporary network error'))
    fetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(chunkSize))
    })

    const download = rangeRequestFetcher({
      url: 'https://example.com/test-file.zip',
      fileName: 'test-file.zip',
      chunkSize,
      maxRetries: 2,
      onStatus
    })

    await download.promise

    expect(statusUpdates).toContain('retrying 104857600-209715199, attempt 1')
    expect(statusUpdates).toContain('done')
  })

  it('should handle pause/resume during download workflow', async () => {
    const fileSize = 300 * 1024 * 1024
    const chunkSize = 100 * 1024 * 1024
    
    const statusUpdates = []
    const progressUpdates = []
    
    const onProgress = (percent) => progressUpdates.push(percent)
    const onStatus = (status) => statusUpdates.push(status)

    fetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: vi.fn().mockReturnValue(fileSize.toString()) }
    })

    // Mock chunks with delay to allow pause/resume testing
    for (let i = 0; i < 3; i++) {
      fetch.mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(chunkSize))
            })
          }, 50)
        })
      })
    }

    const download = rangeRequestFetcher({
      url: 'https://example.com/large-file.zip',
      fileName: 'large-file.zip',
      chunkSize,
      maxRetries: 3,
      onProgress,
      onStatus
    })

    // Pause after a short delay
    setTimeout(() => {
      download.pause()
      expect(download.isPaused()).toBe(true)
    }, 100)

    // Resume after pause
    setTimeout(() => {
      download.resume()
      expect(download.isPaused()).toBe(false)
    }, 200)

    await download.promise

    expect(statusUpdates).toContain('preparing')
    expect(statusUpdates).toContain('paused')
    expect(statusUpdates).toContain('downloading')
    expect(statusUpdates).toContain('done')
    expect(download.getProgress()).toBe(100)
  })

  it('should handle abort during download workflow', async () => {
    const fileSize = 300 * 1024 * 1024
    const chunkSize = 100 * 1024 * 1024
    
    const statusUpdates = []
    const onStatus = (status) => statusUpdates.push(status)

    fetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: vi.fn().mockReturnValue(fileSize.toString()) }
    })

    // Mock with delay to allow abort testing
    fetch.mockImplementation(() => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            ok: true,
            arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(chunkSize))
          })
        }, 100)
      })
    })

    const download = rangeRequestFetcher({
      url: 'https://example.com/large-file.zip',
      fileName: 'large-file.zip',
      chunkSize,
      maxRetries: 3,
      onStatus
    })

    // Abort after a short delay
    setTimeout(() => {
      download.abort()
      expect(download.isAborted()).toBe(true)
    }, 150)

    await expect(download.promise).rejects.toThrow('Download aborted')

    expect(statusUpdates).toContain('preparing')
    expect(statusUpdates).toContain('aborted')
    expect(download.isAborted()).toBe(true)
  })

  it('should handle pause during retry workflow', async () => {
    const fileSize = 200 * 1024 * 1024
    const chunkSize = 100 * 1024 * 1024
    
    const statusUpdates = []
    const onStatus = (status) => statusUpdates.push(status)

    fetch.mockResolvedValueOnce({
      ok: true,
      headers: { get: vi.fn().mockReturnValue(fileSize.toString()) }
    })

    // First chunk succeeds
    fetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(chunkSize))
    })

    // Second chunk fails first, then succeeds
    fetch.mockRejectedValueOnce(new Error('Network error'))
    fetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(chunkSize))
    })

    const download = rangeRequestFetcher({
      url: 'https://example.com/test-file.zip',
      fileName: 'test-file.zip',
      chunkSize,
      maxRetries: 3,
      onStatus
    })

    // Pause during retry
    setTimeout(() => {
      if (statusUpdates.some(status => status.includes('retrying'))) {
        download.pause()
      }
    }, 200)

    // Resume after pause
    setTimeout(() => {
      if (download.isPaused()) {
        download.resume()
      }
    }, 400)

    await download.promise

    expect(statusUpdates).toContain('done')
    expect(statusUpdates.some(status => status.includes('retrying'))).toBe(true)
  })
})
