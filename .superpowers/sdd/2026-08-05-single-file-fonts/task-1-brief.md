# Task 1: Remove ZIP-Based Folder Structure

**Files:**
- Delete: `public/media/fonts/` (directory and .gitkeep)

**Interfaces:**
- Consumes: (none — cleanup task)
- Produces: (none — only removes existing structure)

- [ ] **Step 1: Delete public/media/fonts/ directory**

```bash
rm -rf public/media/fonts/
```

- [ ] **Step 2: Verify directory is removed**

```bash
ls -la public/media/fonts 2>&1 | grep "cannot access"
# Expected: error message confirming folder doesn't exist
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove public/media/fonts/ (ZIP-based uploads)"
```
