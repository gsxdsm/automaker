import { test, expect } from '@playwright/test';

/**
 * Temporary verification test for the Commit History Viewer feature.
 * This test verifies that the new commit history functionality works correctly.
 *
 * After successful verification, this test file should be removed.
 */

test.describe('Commit History Viewer - Feature Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Wait for the app to load
    await page.waitForLoadState('networkidle');
  });

  test('should display commit history components', async ({ page }) => {
    // Navigate to git view
    await page.click('[data-testid="git-nav-button"]');

    // Wait for git view to load
    await expect(page.locator('[data-testid="git-view"]')).toBeVisible();

    // Check that the main content area exists
    await expect(page.locator('[data-testid="git-main-panel"]')).toBeVisible();
  });

  test('should display commit filters', async ({ page }) => {
    // Navigate to git view
    await page.click('[data-testid="git-nav-button"]');

    // Wait for the commits tab to be active
    await expect(page.getByText('Commits')).toBeVisible();

    // Check that search input exists
    const searchInput = page.getByPlaceholder('Search commits');
    await expect(searchInput).toBeVisible();

    // Check that filter button exists
    const filterButton = page.getByRole('button', { name: /filter/i });
    await expect(filterButton).toBeVisible();
  });

  test('should toggle graph visualization', async ({ page }) => {
    // Navigate to git view
    await page.click('[data-testid="git-nav-button"]');

    // Find and click the graph toggle button
    const graphButton = page.getByTitle('Toggle graph visualization');
    await expect(graphButton).toBeVisible();

    // Toggle graph off
    await graphButton.click();

    // Toggle graph on
    await graphButton.click();
  });

  test('should display commit list with basic structure', async ({ page }) => {
    // Navigate to git view
    await page.click('[data-testid="git-nav-button"]');

    // The commits tab should be visible
    await expect(page.getByText('Commits')).toBeVisible();

    // The commit list container should exist
    const commitListContainer = page.locator('.commit-list');
    if ((await commitListContainer.count()) > 0) {
      await expect(commitListContainer).toBeVisible();
    }
  });

  test('should switch between tabs', async ({ page }) => {
    // Navigate to git view
    await page.click('[data-testid="git-nav-button"]');

    // Click on Diffs tab
    await page.click('button:has-text("Diffs")');
    await expect(page.getByText('Diff View')).toBeVisible();

    // Click on Pull Requests tab
    await page.click('button:has-text("Pull Requests")');
    await expect(page.getByText('Pull Requests')).toBeVisible();

    // Click back to Commits tab
    await page.click('button:has-text("Commits")');
  });

  test('should open filter popover', async ({ page }) => {
    // Navigate to git view
    await page.click('[data-testid="git-nav-button"]');

    // Click filter button
    const filterButton = page.getByRole('button', { name: /filter/i });
    await filterButton.click();

    // Check that popover content is visible
    await expect(page.getByText('Filters')).toBeVisible();
    await expect(page.getByText('Author')).toBeVisible();
    await expect(page.getByText('Date Range')).toBeVisible();

    // Close popover
    await page.keyboard.press('Escape');
  });

  test('should search commits', async ({ page }) => {
    // Navigate to git view
    await page.click('[data-testid="git-nav-button"]');

    // Type in search input
    const searchInput = page.getByPlaceholder('Search commits');
    await searchInput.fill('feat');

    // Wait a moment for debounced search
    await page.waitForTimeout(400);

    // Clear search
    await searchInput.fill('');
  });
});
