# Firestore Book Migration

This project includes a one-time migration script to export old Firestore books and convert them into a structure that matches the Eleventy books page.

## What It Produces

The script writes two files:

- `migration-output/firestore-readingitems-raw.json`
- `migration-output/firestore-readingitems-normalized.json`

The normalized file includes:

- `items`: normalized book entries
- `groupedByYear`: grouped data by year
- `booksPageTemplate`: ready-to-paste array for `curatedBooksByYear` in `src/_data/booksPage.js`

## 1) Set Credentials

Use a Firebase service account key with Firestore read access.

PowerShell example:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\firebase-service-account.json"
$env:FIREBASE_PROJECT_ID = "your-firebase-project-id"
```

## 2) Run Migration

Default collection is `ReadingItems`.

```powershell
npm run import:firestore:books
```

Optional custom collection/output:

```powershell
node import_firestore_books.js --collection ReadingItems --raw-out migration-output\raw.json --normalized-out migration-output\normalized.json
```

## 3) Apply to Site Data

Open `migration-output/firestore-readingitems-normalized.json` and copy `booksPageTemplate` into:

- `src/_data/booksPage.js`

Replace or merge into `curatedBooksByYear` depending on whether you want a full replace or a partial import.

## 4) Refresh Covers/Metadata (Optional)

After merging into `booksPage.js`, run:

```powershell
npm run fetch:books
npm run build
```

## Notes

- `creationDate` is mapped to year when possible.
- Missing dates are grouped under `unknown` in normalized output.
- Missing `infoUrl` gets a Google search fallback.
- Service-account files and migration outputs are gitignored.
