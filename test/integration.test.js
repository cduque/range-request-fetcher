import { describe, it, expect, vi } from 'vitest'
import { reliableDownload } from '../index.js'

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

    await reliableDownload({
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

    await reliableDownload({
      url: 'https://example.com/test-file.zip',
      fileName: 'test-file.zip',
      chunkSize,
      maxRetries: 2,
      onStatus
    })

    expect(statusUpdates).toContain('retrying 104857600-209715199, attempt 1')
    expect(statusUpdates).toContain('done')
  })
})
