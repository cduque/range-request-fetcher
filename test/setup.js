import { vi } from 'vitest'

export const mockWriter = {
  write: vi.fn(),
  close: vi.fn()
}

export const mockFileHandle = {
  createWritable: vi.fn().mockResolvedValue(mockWriter)
}

global.window = {
  showSaveFilePicker: vi.fn().mockResolvedValue(mockFileHandle)
}

// Properly mock fetch with vi.fn() and default response
global.fetch = vi.fn().mockResolvedValue({
  ok: false,
  status: 500,
  statusText: 'Internal Server Error',
  headers: {
    get: () => null
  },
  text: vi.fn().mockResolvedValue(''),
  json: vi.fn().mockResolvedValue({}),
  arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0))
})

global.AbortController = class {
  constructor() {
    this.signal = { aborted: false }
  }
  
  abort() {
    this.signal.aborted = true
  }
}
