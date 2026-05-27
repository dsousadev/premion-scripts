# Premion Scripts

Script catalog for the Premion Tools Chrome extension.

## Adding a script

1. Drop the `.user.js` file into `scripts/`
2. Add an entry to `catalog.json`:

```json
{
  "version": 1,
  "scripts": [
    {
      "id": "my-script",
      "name": "My Script",
      "version": "1.0.0",
      "description": "What it does",
      "file": "scripts/my-script.user.js",
      "matches": ["*://*.example.com/*"],
      "runAt": "document_idle",
      "enabled": true,
      "downloadUrl": "https://raw.githubusercontent.com/dsousadev/premion-scripts/main/scripts/my-script.user.js"
    }
  ]
}
```

3. Commit and push. The extension checks this catalog every 24 hours (or on-demand via the popup button).

## Disabling a script

Set `"disabled": true` on the entry. The extension will unregister it on next catalog check.

## Catalog URL

Point the extension at:

```
https://raw.githubusercontent.com/dsousadev/premion-scripts/main/catalog.json
```
