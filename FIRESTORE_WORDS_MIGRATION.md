# Firestore Words Migration

This migration imports Wordfeed entries from the Firestore `words` collection and converts them into markdown files that match this site's `src/word-curations/*.md` format.

## Key Workaround

If Firebase says the service account has too many keys, do not fight the old account.

Use one of these options:

1. Delete unused keys from the existing service account in Google Cloud Console.
2. Create a new service account for the old Wordfeed project and generate a key for that new account.

For read-only migration access, grant the new service account one of these roles:

- `Cloud Datastore Viewer`
- `Cloud Datastore User`

`Cloud Datastore Viewer` is enough if you only need to read the collection.

## Create a New Service Account

In Google Cloud Console for the old Wordfeed project:

1. Open `IAM & Admin`.
2. Open `Service Accounts`.
3. Click `Create Service Account`.
4. Give it a name like `wordfeed-migration-reader`.
5. Grant `Cloud Datastore Viewer`.
6. Open the new service account.
7. Go to `Keys`.
8. Click `Add Key` > `Create new key` > `JSON`.

## Run the Migration

PowerShell example:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\wordfeed-service-account.json"
$env:FIREBASE_PROJECT_ID = "your-wordfeed-project-id"
npm run import:firestore:words
```

Optional arguments:

```powershell
node import_firestore_words.js --collection words --source-label "My old website" --limit 10 --sample-limit 5
```

## What It Produces

The script writes:

- `migration-output/wordfeed-words-raw.json`
- `migration-output/wordfeed-words-normalized.json`
- `migration-output/wordfeed-word-curations/YYYY-MM-DD.md`

The generated markdown files follow this shape:

```yaml
---
date: 2019-05-26
words:
  - word: "gumption"
    definition: "shrewd or spirited initiative or resourcefulness."
    source: "WordFeed"
---
```

## What The Script Assumes

Based on the old Wordfeed structure, the script reads fields like:

- `word`
- `definition`
- `dateCreated`
- `type`
- `pronunciation`
- `pronunciationUrl`
- `createdBy.displayName`

The current site output uses a fixed source label by default:

- `WordFeed`

## Recommended Workflow

1. Run the migration once.
2. Inspect `sampleItems` in `migration-output/wordfeed-words-normalized.json`.
3. Review generated markdown in `migration-output/wordfeed-word-curations/`.
4. Copy selected files into `src/word-curations/` when satisfied.
