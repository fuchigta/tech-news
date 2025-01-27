import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Clipboard, ClipboardCheck } from "lucide-react";

type CopyToClipboardButtonProps = {
  onClick: () => void;
  className?: string;
  title?: string;
};

export function CopyToClipboardButton({
  onClick,
  className,
  title,
}: CopyToClipboardButtonProps) {
  const [checked, setChecked] = useState(false);
  return (
    <Button
      type="button"
      className={className}
      title={title}
      onClick={() => {
        onClick();
        setChecked(true);
        setTimeout(() => {
          setChecked(false);
        }, 2000);
      }}
    >
      {checked ? <ClipboardCheck /> : <Clipboard />}
    </Button>
  );
}
