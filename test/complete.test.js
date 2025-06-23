import { describe, it, expect, vi, beforeEach } from 'vitest'
import { rangeRequestFetcher } from '../index.js'
import { mockWriter, mockFileHandle } from './setup.js'

describe('Range Request Fetcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Set up default fetch mock to prevent actual network requests
    fetch.mockImplementation(() => Promise.resolve({
      ok: true,
      status: 200,
      headers: {
        get: (name) => {
          const lowerName = name.toLowerCase()
          if (lowerName === 'content-length') return '1024'
          return null
        }
      },
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
    }))
  })

  describe('Control Object API', () => {
    it('should return an object with all control methods', () => {
      const controller = rangeRequestFetcher({
        url: 'https://example.com/file.zip',
        fileName: 'test.zip'
      })

      expect(controller).toHaveProperty('promise')
      expect(controller).toHaveProperty('pause')
      expect(controller).toHaveProperty('resume') 
      expect(controller).toHaveProperty('abort')
      expect(controller).toHaveProperty('isPaused')
      expect(controller).toHaveProperty('isAborted')
      expect(controller).toHaveProperty('getProgress')

      expect(controller.promise).toBeInstanceOf(Promise)
      expect(typeof controller.pause).toBe('function')
      expect(typeof controller.resume).toBe('function')
      expect(typeof controller.abort).toBe('function')
      expect(typeof controller.isPaused).toBe('function')
      expect(typeof controller.isAborted).toBe('function')
      expect(typeof controller.getProgress).toBe('function')
    })

    it('should have initial state: not paused, not aborted, 0% progress', () => {
      const controller = rangeRequestFetcher({
        url: 'https://example.com/file.zip',
        fileName: 'test.zip'
      })

      expect(controller.isPaused()).toBe(false)
      expect(controller.isAborted()).toBe(false)
      expect(controller.getProgress()).toBe(0)
    })
  })

  describe('Pause and Resume Functionality', () => {
    it('should pause and resume correctly', () => {
      const onStatus = vi.fn()
      const controller = rangeRequestFetcher({
        url: 'https://example.com/file.zip',
        fileName: 'test.zip',
        onStatus
      })

      // Initially not paused
      expect(controller.isPaused()).toBe(false)

      // Pause
      controller.pause()
      expect(controller.isPaused()).toBe(true)
      expect(onStatus).toHaveBeenCalledWith('paused')

      // Resume
      controller.resume()
      expect(controller.isPaused()).toBe(false)
      expect(onStatus).toHaveBeenCalledWith('downloading')
    })

    it('should handle multiple pause/resume cycles', () => {
      const onStatus = vi.fn()
      const controller = rangeRequestFetcher({
        url: 'https://example.com/file.zip',
        fileName: 'test.zip',
        onStatus
      })

      // Pause and resume multiple times
      controller.pause()
      expect(controller.isPaused()).toBe(true)
      
      controller.resume()
      expect(controller.isPaused()).toBe(false)
      
      controller.pause()
      expect(controller.isPaused()).toBe(true)
      
      controller.resume()
      expect(controller.isPaused()).toBe(false)

      expect(onStatus).toHaveBeenCalledWith('paused')
      expect(onStatus).toHaveBeenCalledWith('downloading')
    })
  })

  describe('Abort Functionality', () => {
    it('should abort correctly', async () => {
      const onStatus = vi.fn()
      const controller = rangeRequestFetcher({
        url: 'https://example.com/file.zip',
        fileName: 'test.zip',
        onStatus
      })

      // Initially not aborted
      expect(controller.isAborted()).toBe(false)

      // Abort
      controller.abort()
      expect(controller.isAborted()).toBe(true)
      expect(onStatus).toHaveBeenCalledWith('aborted')
      
      // Wait for the promise to reject and catch the expected error
      await expect(controller.promise).rejects.toThrow('Download aborted')
    })

    it('should not allow resume after abort', async () => {
      const controller = rangeRequestFetcher({
        url: 'https://example.com/file.zip',
        fileName: 'test.zip'
      })

      controller.abort()
      expect(controller.isAborted()).toBe(true)

      // Try to resume - should remain aborted
      controller.resume()
      expect(controller.isAborted()).toBe(true)
      expect(controller.isPaused()).toBe(false)
      
      // Wait for the promise to reject and catch the expected error
      await expect(controller.promise).rejects.toThrow('Download aborted')
    })
  })

  describe('Basic Download Functionality', () => {
    it('should download a small file successfully', async () => {
      const fileSize = 1024
      const fileContent = new ArrayBuffer(fileSize)
      const onProgress = vi.fn()
      const onStatus = vi.fn()

      // Mock HEAD request
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue(fileSize.toString())
        }
      })

      // Mock file download
      fetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(fileContent)
      })

      const controller = rangeRequestFetcher({
        url: 'https://example.com/test.bin',
        fileName: 'test.bin',
        onProgress,
        onStatus
      })

      await controller.promise

      // Verify HEAD request
      expect(fetch).toHaveBeenCalledWith('https://example.com/test.bin', {
        method: 'HEAD',
        headers: {}
      })

      // Verify file picker was called
      expect(window.showSaveFilePicker).toHaveBeenCalledWith({
        suggestedName: 'test.bin'
      })

      // Verify status updates
      expect(onStatus).toHaveBeenCalledWith('preparing')
      expect(onStatus).toHaveBeenCalledWith('downloading')
      expect(onStatus).toHaveBeenCalledWith('finalizing')
      expect(onStatus).toHaveBeenCalledWith('done')

      // Verify progress update
      expect(onProgress).toHaveBeenCalledWith(100)
      expect(controller.getProgress()).toBe(100)

      // Verify file was written
      expect(mockWriter.write).toHaveBeenCalledWith(fileContent)
      expect(mockWriter.close).toHaveBeenCalled()
    })

    it('should use default filename when not provided', async () => {
      const fileSize = 512
      const fileContent = new ArrayBuffer(fileSize)

      fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: vi.fn().mockReturnValue(fileSize.toString()) }
      })

      fetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(fileContent)
      })

      const controller = rangeRequestFetcher({
        url: 'https://example.com/unnamed-file'
      })

      await controller.promise

      expect(window.showSaveFilePicker).toHaveBeenCalledWith({
        suggestedName: 'downloaded-file'
      })
    })
  })

  describe('Authentication and Headers', () => {
    it('should use Bearer token authentication', async () => {
      const token = 'test-token-123'
      const fileSize = 1024
      const fileContent = new ArrayBuffer(fileSize)

      fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: vi.fn().mockReturnValue(fileSize.toString()) }
      })

      fetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(fileContent)
      })

      const controller = rangeRequestFetcher({
        url: 'https://api.example.com/secure-file',
        fileName: 'secure.bin',
        token
      })

      await controller.promise

      expect(fetch).toHaveBeenCalledWith('https://api.example.com/secure-file', {
        method: 'HEAD',
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
    })

    it('should use custom headers', async () => {
      const customHeaders = {
        'X-API-Key': 'api-key-456',
        'User-Agent': 'MyApp/1.0'
      }
      const fileSize = 1024
      const fileContent = new ArrayBuffer(fileSize)

      fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: vi.fn().mockReturnValue(fileSize.toString()) }
      })

      fetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(fileContent)
      })

      const controller = rangeRequestFetcher({
        url: 'https://api.example.com/file-with-headers',
        fileName: 'file.bin',
        headers: customHeaders
      })

      await controller.promise

      expect(fetch).toHaveBeenCalledWith('https://api.example.com/file-with-headers', {
        method: 'HEAD',
        headers: customHeaders
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle HEAD request failures', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      })

      const controller = rangeRequestFetcher({
        url: 'https://example.com/missing-file.bin',
        fileName: 'missing.bin'
      })

      await expect(controller.promise).rejects.toThrow('Failed to get file info: 404')
    })

    it('should handle missing Content-Length header', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: vi.fn().mockReturnValue(null) }
      })

      const controller = rangeRequestFetcher({
        url: 'https://example.com/no-size.bin',
        fileName: 'no-size.bin'
      })

      await expect(controller.promise).rejects.toThrow('Could not determine file size')
    })

    it('should handle chunk download failures with retries', async () => {
      const fileSize = 1024
      const fileContent = new ArrayBuffer(fileSize)
      const onStatus = vi.fn()

      fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: vi.fn().mockReturnValue(fileSize.toString()) }
      })

      // First attempt fails
      fetch.mockRejectedValueOnce(new Error('Network error'))
      
      // Second attempt succeeds
      fetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(fileContent)
      })

      const controller = rangeRequestFetcher({
        url: 'https://example.com/flaky-file.bin',
        fileName: 'flaky.bin',
        maxRetries: 2,
        onStatus
      })

      await controller.promise

      expect(onStatus).toHaveBeenCalledWith('retrying 0-1023, attempt 1')
      expect(onStatus).toHaveBeenCalledWith('done')
    })

    it('should fail after max retries exceeded', async () => {
      const fileSize = 1024
      const onStatus = vi.fn()

      fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: vi.fn().mockReturnValue(fileSize.toString()) }
      })

      // All attempts fail
      fetch.mockRejectedValue(new Error('Persistent network error'))

      const controller = rangeRequestFetcher({
        url: 'https://example.com/broken-file.bin',
        fileName: 'broken.bin',
        maxRetries: 2,
        onStatus
      })

      await expect(controller.promise).rejects.toThrow('Chunk 0-1023 failed after 2 retries')
      expect(onStatus).toHaveBeenCalledWith('error')
    })
  })

  describe('Download Control Integration', () => {
    it('should abort download and reject promise', async () => {
      const fileSize = 1000000
      const onStatus = vi.fn()

      fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: vi.fn().mockReturnValue(fileSize.toString()) }
      })

      // Mock slow download
      fetch.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 1000))
      )

      const controller = rangeRequestFetcher({
        url: 'https://example.com/slow-file.bin',
        fileName: 'slow.bin',
        onStatus
      })

      // Abort after a short delay
      setTimeout(() => controller.abort(), 100)

      await expect(controller.promise).rejects.toThrow('Download aborted')
      expect(onStatus).toHaveBeenCalledWith('aborted')
      expect(mockWriter.close).toHaveBeenCalled()
    })
  })
})
