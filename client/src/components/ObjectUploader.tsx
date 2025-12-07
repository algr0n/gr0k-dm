import { useState, useRef } from "react";
import type { ReactNode, ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface ObjectUploaderProps {
  maxFileSize?: number;
  allowedFileTypes?: string[];
  onGetUploadParameters: () => Promise<{
    method: "PUT";
    url: string;
  }>;
  onComplete?: (uploadURL: string) => void;
  onError?: (error: Error) => void;
  buttonClassName?: string;
  children: ReactNode;
  disabled?: boolean;
}

export function ObjectUploader({
  maxFileSize = 10485760,
  allowedFileTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"],
  onGetUploadParameters,
  onComplete,
  onError,
  buttonClassName,
  children,
  disabled,
}: ObjectUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!allowedFileTypes.includes(file.type)) {
      onError?.(new Error(`File type ${file.type} is not allowed`));
      return;
    }

    if (file.size > maxFileSize) {
      onError?.(new Error(`File size exceeds ${maxFileSize / 1024 / 1024}MB limit`));
      return;
    }

    setIsUploading(true);
    try {
      const { url } = await onGetUploadParameters();
      
      const response = await fetch(url, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      onComplete?.(url.split("?")[0]);
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error("Upload failed"));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept={allowedFileTypes.join(",")}
        onChange={handleFileChange}
        className="hidden"
        data-testid="input-file-upload"
      />
      <Button 
        type="button"
        onClick={() => fileInputRef.current?.click()} 
        className={buttonClassName}
        variant="outline"
        disabled={disabled || isUploading}
        data-testid="button-upload-file"
      >
        {isUploading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Uploading...
          </>
        ) : (
          children
        )}
      </Button>
    </div>
  );
}
