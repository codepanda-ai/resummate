'use client'

import { createContext, useCallback, useContext, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'test-mode'

interface TestModeContextType {
  isTestMode: boolean
  setIsTestMode: (value: boolean) => void
  hasMounted: boolean
}

const TestModeContext = createContext<TestModeContextType | undefined>(undefined)

export { TestModeContext }

let listeners: Array<() => void> = []

function subscribe(listener: () => void) {
  listeners = [...listeners, listener]
  return () => {
    listeners = listeners.filter((l) => l !== listener)
  }
}

function getSnapshot() {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored !== null ? stored === 'true' : true
}

function getServerSnapshot() {
  return true
}

export function TestModeProvider({ children }: { children: React.ReactNode }) {
  const isTestMode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const hasMounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )

  const setIsTestMode = useCallback((value: boolean) => {
    localStorage.setItem(STORAGE_KEY, String(value))
    for (const listener of listeners) {
      listener()
    }
  }, [])

  return (
    <TestModeContext.Provider value={{ isTestMode, setIsTestMode, hasMounted }}>
      {children}
    </TestModeContext.Provider>
  )
}

export function useTestMode() {
  const context = useContext(TestModeContext)
  if (context === undefined) {
    throw new Error('useTestMode must be used within a TestModeProvider')
  }
  return context
}
