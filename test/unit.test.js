import { describe, it, expect, vi, beforeEach } from 'vitest'
import { rangeRequestFetcher } from '../index.js'

describe('Unit Tests', () => {
  beforeEach(() => {
    // Reset fetch mock before each test
    fetch.mockClear()
    
    // Provide a basic mock that prevents actual network requests
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

  it('should return control object with correct methods', () => {
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

  it('should have correct initial state', () => {
    const controller = rangeRequestFetcher({
      url: 'https://example.com/file.zip',
      fileName: 'test.zip'
    })

    expect(controller.isPaused()).toBe(false)
    expect(controller.isAborted()).toBe(false)
    expect(controller.getProgress()).toBe(0)
  })

  it('should pause and resume correctly', () => {
    const onStatus = vi.fn()
    const controller = rangeRequestFetcher({
      url: 'https://example.com/file.zip',
      fileName: 'test.zip',
      onStatus
    })

    // Pause
    controller.pause()
    expect(controller.isPaused()).toBe(true)
    expect(onStatus).toHaveBeenCalledWith('paused')

    // Resume
    controller.resume()
    expect(controller.isPaused()).toBe(false)
    expect(onStatus).toHaveBeenCalledWith('downloading')
  })

  it('should abort correctly', async () => {
    const onStatus = vi.fn()
    const controller = rangeRequestFetcher({
      url: 'https://example.com/file.zip',
      fileName: 'test.zip',
      onStatus
    })

    controller.abort()
    expect(controller.isAborted()).toBe(true)
    expect(onStatus).toHaveBeenCalledWith('aborted')
    
    // Wait for the promise to reject and catch the expected error
    await expect(controller.promise).rejects.toThrow('Download aborted')
  })
})
