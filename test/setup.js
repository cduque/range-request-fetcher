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

global.fetch = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
})
