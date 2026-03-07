import { GitIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { memo } from "react";

function PureSourceCodeButton() {
  return (
    <div>
      <Link href="https://github.com/danthaman44/resummate/">
        <Button variant="outline">
          <GitIcon /> View Source Code
        </Button>
      </Link>
    </div>
  )
}

export const ViewSourceCodeButton = memo(PureSourceCodeButton)