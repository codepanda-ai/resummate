'use client'

import { Sun, Moon } from "lucide-react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle"
import { useTheme } from "@/components/theme-provider"

export function DarkModeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <div>
      <ToggleGroup
        type="single"
        value={theme}
        onValueChange={(value) => {
          if (value === 'dark' || value === 'light') {
            setTheme(value)
          }        
        }}
        variant="outline"
      >
        <ToggleGroupItem value="light" aria-label="Light mode" className="gap-2 px-4">
          <Sun className="h-4 w-4" />
          <span>Light</span>
        </ToggleGroupItem>
        <ToggleGroupItem value="dark" aria-label="Dark mode" className="gap-2 px-4">
          <Moon className="h-4 w-4" />
          <span>Dark</span>
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  )
}