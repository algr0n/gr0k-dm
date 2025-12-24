#!/usr/bin/env python3
"""
PDF to Text Conversion Script

This script downloads D&D PDF manuals from an upstream GitHub repository
(tyndivelspaz/DnD-Manuals by default) at runtime and converts them to plain text.

COPYRIGHT WARNING: The PDFs from the upstream repository may be copyrighted material.
This script is intended for personal use and educational purposes only. Users are
responsible for ensuring their use complies with applicable copyright laws.

The converted PDFs are NOT stored in this repository - they are downloaded at runtime
only and can be uploaded as artifacts or committed separately if desired.
"""

import os
import sys
import subprocess
from pathlib import Path
from typing import List, Dict, Optional
import requests

# Try to import tqdm for progress bars, fallback if not available
try:
    from tqdm import tqdm
    HAS_TQDM = True
except ImportError:
    HAS_TQDM = False

# Environment variables with defaults
UPSTREAM_OWNER = os.environ.get('UPSTREAM_OWNER', 'tyndivelspaz')
UPSTREAM_REPO = os.environ.get('UPSTREAM_REPO', 'DnD-Manuals')
UPSTREAM_BRANCH = os.environ.get('UPSTREAM_BRANCH', 'main')
COMMIT_OUTPUTS = os.environ.get('COMMIT_OUTPUTS', 'false').lower() == 'true'
GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN', '')

# Output directories
PDFS_DIR = Path('./pdfs')
TEXTS_DIR = Path('./texts')


def ensure_directories():
    """Create output directories if they don't exist."""
    PDFS_DIR.mkdir(exist_ok=True)
    TEXTS_DIR.mkdir(exist_ok=True)
    print(f"✓ Created/verified directories: {PDFS_DIR}, {TEXTS_DIR}")


def list_pdfs_from_repo() -> List[Dict[str, str]]:
    """
    List PDF files from the upstream GitHub repository.
    Returns a list of dictionaries with 'name' and 'url' keys.
    """
    api_url = f"https://api.github.com/repos/{UPSTREAM_OWNER}/{UPSTREAM_REPO}/git/trees/{UPSTREAM_BRANCH}?recursive=1"
    
    print(f"📋 Fetching PDF list from {UPSTREAM_OWNER}/{UPSTREAM_REPO} (branch: {UPSTREAM_BRANCH})...")
    
    # Prepare headers with authentication if token is available
    headers = {}
    if GITHUB_TOKEN:
        headers['Authorization'] = f'token {GITHUB_TOKEN}'
    
    try:
        response = requests.get(api_url, headers=headers, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        pdfs = []
        for item in data.get('tree', []):
            if item['type'] == 'blob' and item['path'].lower().endswith('.pdf'):
                pdf_name = Path(item['path']).name  # Get filename using Path
                raw_url = f"https://raw.githubusercontent.com/{UPSTREAM_OWNER}/{UPSTREAM_REPO}/{UPSTREAM_BRANCH}/{item['path']}"
                pdfs.append({
                    'name': pdf_name,
                    'url': raw_url,
                    'path': item['path']
                })
        
        print(f"✓ Found {len(pdfs)} PDF files")
        return pdfs
    
    except requests.RequestException as e:
        print(f"✗ Error fetching PDF list: {e}")
        return []


def download_pdf(pdf_info: Dict[str, str]) -> Optional[Path]:
    """Download a PDF file from the given URL."""
    pdf_name = pdf_info['name']
    pdf_url = pdf_info['url']
    output_path = PDFS_DIR / pdf_name
    
    # Skip if already downloaded
    if output_path.exists():
        print(f"  ⊙ {pdf_name} already exists, skipping download")
        return output_path
    
    try:
        print(f"  ⬇ Downloading {pdf_name}...")
        response = requests.get(pdf_url, stream=True, timeout=60)
        response.raise_for_status()
        
        # Parse content-length defensively
        try:
            total_size = int(response.headers.get('content-length', 0))
        except (ValueError, TypeError):
            total_size = 0
        
        with open(output_path, 'wb') as f:
            if total_size > 0 and HAS_TQDM:
                with tqdm(total=total_size, unit='B', unit_scale=True, desc=f"    {pdf_name}") as pbar:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)
                        pbar.update(len(chunk))
            else:
                # Fallback without progress bar
                bytes_downloaded = 0
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
                    bytes_downloaded += len(chunk)
                    if total_size > 0 and bytes_downloaded % (1024 * 1024) == 0:
                        # Print progress every MB if we know the total size
                        print(f"    {bytes_downloaded / (1024 * 1024):.1f} MB / {total_size / (1024 * 1024):.1f} MB", end='\r')
        
        print(f"  ✓ Downloaded {pdf_name}")
        return output_path
    
    except requests.RequestException as e:
        print(f"  ✗ Error downloading {pdf_name}: {e}")
        return None


def convert_pdf_with_pdftotext(pdf_path: Path) -> Optional[Path]:
    """Convert PDF to text using pdftotext (from poppler-utils)."""
    text_path = TEXTS_DIR / f"{pdf_path.stem}.txt"
    
    try:
        result = subprocess.run(
            ['pdftotext', '-layout', str(pdf_path), str(text_path)],
            capture_output=True,
            text=True,
            timeout=300
        )
        
        if result.returncode == 0 and text_path.exists() and text_path.stat().st_size > 0:
            return text_path
        else:
            return None
    
    except (subprocess.TimeoutExpired, FileNotFoundError, Exception) as e:
        print(f"  ⚠ pdftotext failed: {e}")
        return None


def convert_pdf_with_ocr(pdf_path: Path) -> Optional[Path]:
    """Convert PDF to text using OCR (pdf2image + pytesseract) as fallback."""
    try:
        from pdf2image import convert_from_path
        import pytesseract
        from PIL import Image
    except ImportError as e:
        print(f"  ✗ OCR libraries not available: {e}")
        return None
    
    text_path = TEXTS_DIR / f"{pdf_path.stem}.txt"
    
    try:
        print(f"  🔍 Using OCR for {pdf_path.name}...")
        
        # Convert PDF to images
        images = convert_from_path(str(pdf_path), dpi=300)
        
        # Extract text from each page
        full_text = []
        for i, image in enumerate(images, 1):
            print(f"    Processing page {i}/{len(images)}...")
            text = pytesseract.image_to_string(image)
            full_text.append(f"--- Page {i} ---\n{text}\n")
        
        # Save combined text
        with open(text_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(full_text))
        
        if text_path.exists() and text_path.stat().st_size > 0:
            return text_path
        else:
            return None
    
    except Exception as e:
        print(f"  ✗ OCR conversion failed: {e}")
        return None


def convert_pdf_to_text(pdf_path: Path) -> Optional[Path]:
    """
    Convert PDF to text, trying pdftotext first, then falling back to OCR.
    """
    text_path = TEXTS_DIR / f"{pdf_path.stem}.txt"
    
    # Skip if text already exists
    if text_path.exists():
        print(f"  ⊙ {text_path.name} already exists, skipping conversion")
        return text_path
    
    print(f"  📄 Converting {pdf_path.name} to text...")
    
    # Try pdftotext first
    result = convert_pdf_with_pdftotext(pdf_path)
    if result:
        print(f"  ✓ Converted with pdftotext: {result.name}")
        return result
    
    # Fall back to OCR
    print(f"  ⚠ pdftotext failed, trying OCR...")
    result = convert_pdf_with_ocr(pdf_path)
    if result:
        print(f"  ✓ Converted with OCR: {result.name}")
        return result
    
    print(f"  ✗ All conversion methods failed for {pdf_path.name}")
    return None


def commit_texts_if_requested():
    """
    Commit the converted text files if COMMIT_OUTPUTS is true and GITHUB_TOKEN is available.
    """
    if not COMMIT_OUTPUTS:
        print("\n⊙ COMMIT_OUTPUTS not enabled, skipping commit")
        return
    
    if not GITHUB_TOKEN:
        print("\n⚠ COMMIT_OUTPUTS enabled but GITHUB_TOKEN not found, skipping commit")
        return
    
    print("\n📝 Committing converted texts...")
    
    try:
        # Configure git
        subprocess.run(['git', 'config', 'user.name', 'github-actions[bot]'], check=True)
        subprocess.run(['git', 'config', 'user.email', 'github-actions[bot]@users.noreply.github.com'], check=True)
        
        # Add text files
        subprocess.run(['git', 'add', 'texts/'], check=True)
        
        # Check if there are changes to commit
        result = subprocess.run(
            ['git', 'diff', '--cached', '--quiet'],
            capture_output=True
        )
        
        if result.returncode == 0:
            print("  ⊙ No changes to commit")
            return
        
        # Commit
        subprocess.run(
            ['git', 'commit', '-m', 'Add converted PDF texts [automated]'],
            check=True
        )
        
        # Push
        subprocess.run(['git', 'push'], check=True)
        
        print("  ✓ Committed and pushed text files")
    
    except subprocess.CalledProcessError as e:
        print(f"  ✗ Git operation failed: {e}")


def main():
    """Main execution function."""
    print("=" * 70)
    print("PDF to Text Conversion Script")
    print("=" * 70)
    print(f"\nUpstream Repository: {UPSTREAM_OWNER}/{UPSTREAM_REPO}")
    print(f"Branch: {UPSTREAM_BRANCH}")
    print(f"Commit outputs: {COMMIT_OUTPUTS}")
    print()
    
    # Ensure output directories exist
    ensure_directories()
    
    # List PDFs from upstream repository
    pdfs = list_pdfs_from_repo()
    
    if not pdfs:
        print("\n✗ No PDFs found or error occurred")
        sys.exit(1)
    
    # Download and convert each PDF
    print(f"\n📥 Processing {len(pdfs)} PDFs...")
    print("-" * 70)
    
    successful_conversions = 0
    failed_conversions = 0
    
    for i, pdf_info in enumerate(pdfs, 1):
        print(f"\n[{i}/{len(pdfs)}] {pdf_info['name']}")
        
        # Download PDF
        pdf_path = download_pdf(pdf_info)
        if not pdf_path:
            failed_conversions += 1
            continue
        
        # Convert to text
        text_path = convert_pdf_to_text(pdf_path)
        if text_path:
            successful_conversions += 1
        else:
            failed_conversions += 1
    
    # Summary
    print("\n" + "=" * 70)
    print("Conversion Summary")
    print("=" * 70)
    print(f"✓ Successful: {successful_conversions}")
    print(f"✗ Failed: {failed_conversions}")
    print(f"Total: {len(pdfs)}")
    
    # Commit if requested
    if successful_conversions > 0:
        commit_texts_if_requested()
    
    print("\n✓ Done!")
    
    # Exit with error if any conversions failed
    if failed_conversions > 0:
        sys.exit(1)


if __name__ == '__main__':
    main()
