import React, { useState, useRef } from 'react';
import { ImagePlus, X } from 'lucide-react';

export function ImageUpload({ onImageSelect, onImageRemove, disabled = false }) {
    const [preview, setPreview] = useState(null);
    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
            processImage(file);
        }
    };

    const processImage = (file) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result;
            setPreview(base64String);
            onImageSelect(base64String);
        };
        reader.readAsDataURL(file);
    };

    const handleRemove = (e) => {
        e.stopPropagation();
        setPreview(null);
        onImageRemove?.();
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleButtonClick = () => {
        if (!disabled) {
            fileInputRef.current?.click();
        }
    };

    return (
        <div className="flex items-center gap-2">
            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                disabled={disabled}
                className="hidden"
                aria-label="Upload image"
            />

            {/* Image upload button */}
            <button
                onClick={handleButtonClick}
                disabled={disabled}
                className="p-2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Attach image"
                type="button"
            >
                <ImagePlus size={18} />
            </button>

            {/* Preview thumbnail */}
            {preview && (
                <div className="relative inline-block">
                    <img
                        src={preview}
                        alt="Upload preview"
                        className="w-10 h-10 rounded-md border border-[var(--border)] object-cover"
                    />
                    <button
                        onClick={handleRemove}
                        className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 transition-colors"
                        aria-label="Remove image"
                        type="button"
                    >
                        <X size={12} />
                    </button>
                </div>
            )}
        </div>
    );
}
