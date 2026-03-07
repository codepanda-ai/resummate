'use client'

import { useTestMode } from "@/hooks/use-test-mode"

export function TestModeToggle() {
  const { isTestMode, setIsTestMode, hasMounted } = useTestMode()

  if (!hasMounted) return null

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-foreground">Test Mode</span>
        <button
          type="button"
          role="switch"
          aria-checked={isTestMode}
          aria-label="Toggle test mode"
          onClick={() => setIsTestMode(!isTestMode)}
          className={`
            relative inline-flex h-9 w-20 shrink-0 cursor-pointer items-center
            rounded-full border-2 transition-colors duration-300 ease-in-out
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
            ${isTestMode
              ? 'bg-green-500 border-green-500'
              : 'bg-muted border-border'
            }
          `}
        >
          <span
            className={`
              absolute text-xs font-semibold transition-opacity duration-200
              ${isTestMode
                ? 'left-2.5 opacity-100 text-green-950'
                : 'left-2.5 opacity-0'
              }
            `}
          >
            ON
          </span>
          <span
            className={`
              absolute text-xs font-semibold transition-opacity duration-200
              ${isTestMode
                ? 'right-2 opacity-0'
                : 'right-2 opacity-100 text-muted-foreground'
              }
            `}
          >
            OFF
          </span>
          <span
            className={`
              pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow-lg
              ring-0 transition-transform duration-300 ease-in-out
              ${isTestMode ? 'translate-x-10' : 'translate-x-1'}
            `}
          />
        </button>
    </div>
  )
}
