#!/usr/bin/env bash

# 1. Fetch the latest changes from the origin master branch
git fetch origin master

# 2. Get the latest tag
LATEST_TAG=$(git describe --tags --abbrev=0)

# 3. Get the commits between the latest tag and the latest commit
COMMITS=$(git log "$LATEST_TAG"..HEAD --oneline)

# 4. If there are more than one commit, check the commit messages
if [ $(echo "$COMMITS" | wc -l) -gt 1 ]; then
    NEXT_TAG_TARGET="patch" # Default is patch
    while IFS= read -r commit; do
        COMMIT_MESSAGE=$(echo "$commit" | cut -d ' ' -f2-)
        # 5. If any commit message starts with "feat", set next version to minor
        if [[ "$COMMIT_MESSAGE" == feat* ]]; then
            NEXT_TAG_TARGET="minor"
            break
        fi
    done <<<"$COMMITS"

    # 6. Increase the version based on the next version (minor or patch)
    # Get the current version from the latest tag
    LATEST_VERSION=$(echo "$LATEST_TAG" | sed 's/^v//') # Remove "v" if present
    IFS='.' read -r MAJOR MINOR PATCH <<<"$LATEST_VERSION"

    if [ "$NEXT_TAG_TARGET" == "minor" ]; then
        MINOR=$((MINOR + 1))
        PATCH=0 # Reset patch version for minor updates
    else
        PATCH=$((PATCH + 1))
    fi

    # 7. Create the new version tag
    NEW_TAG="$MAJOR.$MINOR.$PATCH"
    export NEXT_TAG="$NEW_TAG" # Export the version for use in the next script
    echo "Next tag: $NEXT_TAG"
else
    echo "No commits found between the latest tag and HEAD."
fi
