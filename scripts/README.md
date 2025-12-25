# Scripts Directory

This directory contains utility scripts for the Grok DM project.

## Database Migration

### `run-all-migrations.js`

The unified migration runner that handles all database migrations idempotently.

**Usage:**

```bash
# Run all migrations from the beginning
node scripts/run-all-migrations.js

# Run migrations starting from a specific migration (e.g., 005)
node scripts/run-all-migrations.js 005
```

**Features:**

- **Idempotent**: Safe to run multiple times - skips already-applied changes
- **Smart Execution**: Automatically detects and uses JS migrations when available (in `migrations-js/`)
- **Fallback Handling**: Falls back to statement-by-statement execution if batch fails
- **Error Handling**: Gracefully handles duplicate column/table/index errors
- **Transaction Support**: Handles `BEGIN TRANSACTION` blocks properly

**Environment Variables:**

- `TURSO_DATABASE_URL`: Database connection URL
- `TURSO_AUTH_TOKEN`: Database authentication token

**Migration Structure:**

```
migrations/          # SQL migration files
migrations-js/       # JS migration files (idempotent versions)
run-all-migrations.js  # Main migration runner
```

## PDF Conversion Script

### `convert_pdfs_to_text.py`

This script downloads D&D PDF manuals from an external GitHub repository ([tyndivelspaz/DnD-Manuals](https://github.com/tyndivelspaz/DnD-Manuals)) at runtime and converts them to plain text format.

#### Features

- **Runtime Download**: PDFs are downloaded from the upstream repository during execution, not stored in this repository
- **Text Conversion**: Converts PDFs to text using `pdftotext` (from poppler-utils)
- **OCR Fallback**: Automatically falls back to OCR (using pytesseract and pdf2image) if pdftotext fails
- **Configurable**: Uses environment variables to configure upstream repository and behavior
- **Optional Commit**: Can optionally commit converted texts when run in CI/CD

#### Usage

**Local Execution:**

```bash
# Install required system dependencies (Ubuntu/Debian)
sudo apt-get install poppler-utils tesseract-ocr

# Install Python dependencies
pip install pdf2image pytesseract pillow requests tqdm

# Run the script
python scripts/convert_pdfs_to_text.py
```

**Environment Variables:**

- `UPSTREAM_OWNER`: GitHub repository owner (default: `tyndivelspaz`)
- `UPSTREAM_REPO`: GitHub repository name (default: `DnD-Manuals`)
- `UPSTREAM_BRANCH`: Git branch to use (default: `main`)
- `COMMIT_OUTPUTS`: Set to `true` to commit converted texts (default: `false`)
- `GITHUB_TOKEN`: GitHub token for authentication (required for commit)

**GitHub Actions Workflow:**

The workflow is located at `.github/workflows/convert.yml` and can be triggered manually via the Actions tab:

1. Go to the repository's Actions tab
2. Select "Convert DnD PDFs to plain text" workflow
3. Click "Run workflow"
4. Choose whether to commit the converted texts to the repository
5. The converted texts will be uploaded as artifacts regardless of the commit option

#### Output

- **PDFs**: Downloaded to `./pdfs/` directory (not committed to repository)
- **Texts**: Converted texts saved to `./texts/` directory

#### Copyright Notice

⚠️ **Important**: The PDFs downloaded from the upstream repository may be copyrighted material owned by Wizards of the Coast or other publishers. This script is intended for **personal use and educational purposes only**. Users are responsible for ensuring their use complies with applicable copyright laws and license agreements.

**This repository does NOT store PDF files**. They are downloaded at runtime from the upstream repository and are not included in version control.

#### How It Works

1. **List PDFs**: Queries the GitHub API to list all PDF files in the upstream repository
2. **Download**: Downloads each PDF from the raw GitHub content URL
3. **Convert**: 
   - First attempts conversion using `pdftotext` (fast, best for text-based PDFs)
   - Falls back to OCR using `pytesseract` if pdftotext fails (slower, for image-based/scanned PDFs)
4. **Save**: Stores converted text files in the `texts/` directory
5. **Optional Commit**: If enabled, commits the text files back to the repository

#### Notes

- PDFs are intentionally excluded from this repository via `.gitignore`
- The script includes progress bars for download and conversion operations
- Failed conversions are logged and reported in the summary
- The script exits with a non-zero status if any conversions fail
