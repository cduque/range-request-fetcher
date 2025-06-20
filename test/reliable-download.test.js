import { describe, it, expect, vi, beforeEach } from 'vitest'
import { rangeRequestFetcher } from '../index.js'
import { mockWriter, mockFileHandle } from './setup.js'

describe('rangeRequestFetcher', () => {
  const mockUrl = 'https://ftp.rediris.es/mirror/ubuntu-releases/24.04.2/ubuntu-24.04.2-live-server-amd64.iso'
  const mockFileName = 'ubuntu-24.04.2-live-server-amd64.iso'
  
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic functionality', () => {
    it('should download a small file successfully', async () => {
      const mockFileContent = new ArrayBuffer(1024)
      const onProgress = vi.fn()
      const onStatus = vi.fn()

      fetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue('1024')
        }
      })

      fetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(mockFileContent)
      })

      await rangeRequestFetcher({
        url: mockUrl,
        fileName: mockFileName,
        onProgress,
        onStatus
      })

      expect(fetch).toHaveBeenCalledWith(mockUrl, {
        method: 'HEAD',
        headers: {}
      })

      expect(window.showSaveFilePicker).toHaveBeenCalledWith({
        suggestedName: mockFileName
      })

      expect(onStatus).toHaveBeenCalledWith('preparing')
      expect(onStatus).toHaveBeenCalledWith('downloading')
      expect(onStatus).toHaveBeenCalledWith('finalizing')
      expect(onStatus).toHaveBeenCalledWith('done')
      expect(onProgress).toHaveBeenCalledWith(100)
    })

    it('should handle authentication with Bearer token', async () => {
      const mockToken = 'test-token-123'
      const mockFileContent = new ArrayBuffer(1024)

      fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: vi.fn().mockReturnValue('1024') }
      })

      fetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(mockFileContent)
      })

      await rangeRequestFetcher({
        url: mockUrl,
        fileName: mockFileName,
        token: mockToken
      })

      expect(fetch).toHaveBeenCalledWith(mockUrl, {
        method: 'HEAD',
        headers: {
          Authorization: `Bearer ${mockToken}`
        }
      })
    })

    it('should handle custom headers', async () => {
      const customHeaders = {
        'X-API-Key': 'api-key-123',
        'User-Agent': 'MyApp/1.0'
      }
      const mockFileContent = new ArrayBuffer(1024)

      fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: vi.fn().mockReturnValue('1024') }
      })

      fetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(mockFileContent)
      })

      await rangeRequestFetcher({
        url: mockUrl,
        fileName: mockFileName,
        headers: customHeaders
      })

      expect(fetch).toHaveBeenCalledWith(mockUrl, {
        method: 'HEAD',
        headers: customHeaders
      })
    })
  })

  describe('Chunked downloads', () => {
    it('should download large files in chunks', async () => {
      const fileSize = 300 * 1024 * 1024
      const chunkSize = 100 * 1024 * 1024
      const chunk1 = new ArrayBuffer(chunkSize)
      const chunk2 = new ArrayBuffer(chunkSize)
      const chunk3 = new ArrayBuffer(fileSize - 2 * chunkSize)

      const onProgress = vi.fn()

      fetch.mockResolvedValueOnce({
        ok: true,
        headers: {
          get: vi.fn().mockReturnValue(fileSize.toString())
        }
      })

      fetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(chunk1)
      })
      fetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(chunk2)
      })
      fetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(chunk3)
      })

      await rangeRequestFetcher({
        url: mockUrl,
        fileName: mockFileName,
        chunkSize,
        onProgress
      })

      expect(fetch).toHaveBeenCalledTimes(4)

      expect(fetch).toHaveBeenCalledWith(mockUrl, {
        method: 'GET',
        headers: {
          Range: 'bytes=0-104857599',
          'Cache-Control': 'no-cache'
        },
        cache: 'no-store'
      })

      expect(fetch).toHaveBeenCalledWith(mockUrl, {
        method: 'GET',
        headers: {
          Range: 'bytes=104857600-209715199',
          'Cache-Control': 'no-cache'
        },
        cache: 'no-store'
      })

      expect(onProgress).toHaveBeenCalledWith(33)
      expect(onProgress).toHaveBeenCalledWith(66)
      expect(onProgress).toHaveBeenCalledWith(100)
    })
  })

  describe('Error handling and retries', () => {
    it('should retry failed chunks', async () => {
      const mockFileContent = new ArrayBuffer(1024)
      const onStatus = vi.fn()

      fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: vi.fn().mockReturnValue('1024') }
      })

      fetch.mockRejectedValueOnce(new Error('Network error'))
      
      fetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(mockFileContent)
      })

      await rangeRequestFetcher({
        url: mockUrl,
        fileName: mockFileName,
        maxRetries: 2,
        onStatus
      })

      expect(onStatus).toHaveBeenCalledWith('retrying 0-1023, attempt 1')
      expect(onStatus).toHaveBeenCalledWith('done')
    })

    it('should fail after max retries exceeded', async () => {
      const onStatus = vi.fn()

      fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: vi.fn().mockReturnValue('1024') }
      })

      fetch.mockRejectedValue(new Error('Persistent network error'))

      await expect(rangeRequestFetcher({
        url: mockUrl,
        fileName: mockFileName,
        maxRetries: 2,
        onStatus
      })).rejects.toThrow('Chunk 0-1023 failed after 2 retries')

      expect(onStatus).toHaveBeenCalledWith('error')
    })

    it('should handle HEAD request failure', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      })

      await expect(rangeRequestFetcher({
        url: mockUrl,
        fileName: mockFileName
      })).rejects.toThrow('Failed to get file info: 404')
    })

    it('should handle missing Content-Length header', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: vi.fn().mockReturnValue(null) }
      })

      await expect(rangeRequestFetcher({
        url: mockUrl,
        fileName: mockFileName
      })).rejects.toThrow('Could not determine file size')
    })

    it('should handle chunk request failure', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: vi.fn().mockReturnValue('1024') }
      })

      fetch.mockResolvedValueOnce({
        ok: false,
        status: 416
      })

      await expect(rangeRequestFetcher({
        url: mockUrl,
        fileName: mockFileName,
        maxRetries: 1
      })).rejects.toThrow('Chunk fetch failed: 416')
    })
  })

  describe('Edge cases', () => {
    it('should handle empty file', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: vi.fn().mockReturnValue('0') }
      })

      await expect(rangeRequestFetcher({
        url: mockUrl,
        fileName: mockFileName
      })).rejects.toThrow('Could not determine file size')
    })

    it('should use default fileName when not provided', async () => {
      const mockFileContent = new ArrayBuffer(1024)

      fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: vi.fn().mockReturnValue('1024') }
      })

      fetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(mockFileContent)
      })

      await rangeRequestFetcher({
        url: mockUrl
      })

      expect(window.showSaveFilePicker).toHaveBeenCalledWith({
        suggestedName: 'downloaded-file'
      })
    })

    it('should handle very small chunks', async () => {
      const mockFileContent = new ArrayBuffer(100)

      fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: vi.fn().mockReturnValue('100') }
      })

      fetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(mockFileContent)
      })

      await rangeRequestFetcher({
        url: mockUrl,
        fileName: mockFileName,
        chunkSize: 1000
      })

      expect(fetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('File System Access API integration', () => {
    it('should properly write chunks to file', async () => {
      const chunk1 = new ArrayBuffer(512)
      const chunk2 = new ArrayBuffer(512)

      fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: vi.fn().mockReturnValue('1024') }
      })

      fetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(chunk1)
      })

      fetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(chunk2)
      })

      await rangeRequestFetcher({
        url: mockUrl,
        fileName: mockFileName,
        chunkSize: 512
      })

      expect(mockWriter.write).toHaveBeenCalledWith(chunk1)
      expect(mockWriter.write).toHaveBeenCalledWith(chunk2)
      expect(mockWriter.close).toHaveBeenCalled()
    })

    it('should close writer on error', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: vi.fn().mockReturnValue('1024') }
      })

      fetch.mockRejectedValue(new Error('Write error'))

      try {
        await rangeRequestFetcher({
          url: mockUrl,
          fileName: mockFileName,
          maxRetries: 1
        })
      } catch (error) {
      }

      expect(mockWriter.close).toHaveBeenCalled()
    })
  })
})
