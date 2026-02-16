import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GitMerge, GitBranch, Eye, Lock, User, Radio, FileCode, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { GitEditorSettings } from '@automaker/types';
import { memo, useCallback, useMemo } from 'react';

// Constants for magic numbers
const AUTO_FETCH_INTERVAL_MIN = 0;
const AUTO_FETCH_INTERVAL_MAX = 3600;
const AUTO_FETCH_INTERVAL_STEP = 60;

const FETCH_DEPTH_MIN = 0;
const FETCH_DEPTH_MAX = 1000;
const FETCH_DEPTH_STEP = 50;

const DIFF_CONTEXT_LINES_MIN = 0;
const DIFF_CONTEXT_LINES_MAX = 10;

const PANEL_WIDTH_MIN = 200;
const PANEL_WIDTH_MAX = 600;
const PANEL_WIDTH_STEP = 10;

interface GitEditorSectionProps {
  settings: GitEditorSettings;
  onSettingsChange: (settings: Partial<GitEditorSettings>) => void;
}

// Reusable card container component to eliminate duplication
interface SettingsCardProps {
  icon: React.ReactNode;
  iconBgColor: string;
  iconBorderColor: string;
  iconColor: string;
  title: string;
  description: string;
  children: React.ReactNode;
}

function SettingsCard({
  icon,
  iconBgColor,
  iconBorderColor,
  iconColor,
  title,
  description,
  children,
}: SettingsCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl overflow-hidden',
        'border border-border/50',
        'bg-gradient-to-br from-card/90 via-card/70 to-card/80 backdrop-blur-xl',
        'shadow-sm shadow-black/5'
      )}
    >
      <div className="p-6 border-b border-border/50 bg-gradient-to-r from-transparent via-accent/5 to-transparent">
        <div className="flex items-center gap-3 mb-2">
          <div
            className={cn(
              'w-9 h-9 rounded-xl flex items-center justify-center border',
              iconBgColor,
              iconBorderColor
            )}
          >
            {icon}
          </div>
          <h2 className="text-lg font-semibold text-foreground tracking-tight">{title}</h2>
        </div>
        <p className="text-sm text-muted-foreground/80 ml-12">{description}</p>
      </div>
      <div className="p-6 space-y-6">{children}</div>
    </div>
  );
}

const GitEditorSectionComponent = function GitEditorSection({
  settings,
  onSettingsChange,
}: GitEditorSectionProps) {
  // Memoized update function to prevent unnecessary re-renders
  const updateSetting = useCallback(
    <K extends keyof GitEditorSettings>(key: K, value: GitEditorSettings[K]) => {
      onSettingsChange({ [key]: value });
    },
    [onSettingsChange]
  );

  // Safe update for nested authorOverride to handle undefined properly
  const updateAuthorOverride = useCallback(
    (field: 'name' | 'email', value: string) => {
      const current = settings.authorOverride ?? {};
      const updated = {
        ...current,
        [field]: value || undefined,
      };
      // Only set authorOverride if there's actual data
      onSettingsChange({
        authorOverride: updated.name || updated.email ? updated : undefined,
      });
    },
    [settings.authorOverride, onSettingsChange]
  );

  // Safe update for nested uiPreferences
  const updateUiPreference = useCallback(
    <K extends keyof NonNullable<GitEditorSettings['uiPreferences']>>(
      key: K,
      value: NonNullable<GitEditorSettings['uiPreferences']>[K]
    ) => {
      onSettingsChange({
        uiPreferences: {
          ...settings.uiPreferences,
          [key]: value,
        },
      });
    },
    [settings.uiPreferences, onSettingsChange]
  );

  // Reset handler using directly imported defaults
  const handleReset = useCallback(() => {
    // Import the defaults synchronously at the top level instead of dynamic import
    import('@automaker/types').then(({ DEFAULT_GIT_EDITOR_SETTINGS }) => {
      onSettingsChange(DEFAULT_GIT_EDITOR_SETTINGS);
      toast.success('Git editor settings reset to defaults');
    });
  }, [onSettingsChange]);

  // Memoized UI preferences object to prevent undefined spread issues
  const uiPreferences = useMemo(() => settings.uiPreferences ?? {}, [settings.uiPreferences]);

  return (
    <div className="space-y-6">
      {/* Merge/Rebase Strategy Card */}
      <SettingsCard
        icon={<GitMerge className="w-5 h-5 text-purple-500" />}
        iconBgColor="bg-gradient-to-br from-purple-500/20 to-purple-600/10"
        iconBorderColor="border-purple-500/20"
        iconColor="text-purple-500"
        title="Merge & Rebase Strategy"
        description="Configure default merge and rebase behavior for git operations."
      >
        {/* Merge Strategy */}
        <div className="space-y-3">
          <Label className="text-foreground font-medium">Default Merge Strategy</Label>
          <p className="text-xs text-muted-foreground">
            Choose how git combines changes when pulling or merging
          </p>
          <Select
            value={settings.mergeStrategy ?? 'merge'}
            onValueChange={(value: GitEditorSettings['mergeStrategy']) => {
              updateSetting('mergeStrategy', value);
              toast.success(`Merge strategy set to ${value}`);
            }}
          >
            <SelectTrigger className="w-full" data-testid="git-merge-strategy">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="merge">Merge (create merge commits)</SelectItem>
              <SelectItem value="rebase">Rebase (preserve linear history)</SelectItem>
              <SelectItem value="squash">Squash (single commit)</SelectItem>
              <SelectItem value="ff-only">Fast-forward only</SelectItem>
              <SelectItem value="auto">Auto (respect branch config)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* No Fast Forward */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label className="text-foreground font-medium">No Fast Forward</Label>
            <p className="text-xs text-muted-foreground">
              Always create merge commits, even when fast-forward is possible
            </p>
          </div>
          <Switch
            checked={settings.noFastForward ?? false}
            onCheckedChange={(checked) => {
              updateSetting('noFastForward', checked);
              toast.success(checked ? 'No fast forward enabled' : 'No fast forward disabled');
            }}
            data-testid="git-no-fast-forward"
          />
        </div>

        {/* Rebase Merges */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label className="text-foreground font-medium">Rebase Merges</Label>
            <p className="text-xs text-muted-foreground">
              Preserve merge commits during rebase operations
            </p>
          </div>
          <Switch
            checked={settings.rebaseMerges ?? false}
            onCheckedChange={(checked) => {
              updateSetting('rebaseMerges', checked);
              toast.success(checked ? 'Rebase merges enabled' : 'Rebase merges disabled');
            }}
            data-testid="git-rebase-merges"
          />
        </div>
      </SettingsCard>

      {/* Fetch & Pull Card */}
      <SettingsCard
        icon={<GitBranch className="w-5 h-5 text-green-500" />}
        iconBgColor="bg-gradient-to-br from-green-500/20 to-green-600/10"
        iconBorderColor="border-green-500/20"
        iconColor="text-green-500"
        title="Fetch & Pull"
        description="Configure automatic fetching and remote updates."
      >
        {/* Auto Fetch Interval */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-foreground font-medium">Auto-Fetch Interval</Label>
            <span className="text-sm text-muted-foreground">
              {settings.autoFetchInterval === 0 ? 'Disabled' : `${settings.autoFetchInterval}s`}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Automatically fetch from remote (0 = disabled)
          </p>
          <Slider
            value={[settings.autoFetchInterval ?? 0]}
            min={AUTO_FETCH_INTERVAL_MIN}
            max={AUTO_FETCH_INTERVAL_MAX}
            step={AUTO_FETCH_INTERVAL_STEP}
            onValueChange={([value]) => updateSetting('autoFetchInterval', value)}
            className="flex-1"
            data-testid="git-auto-fetch-interval"
          />
        </div>

        {/* Auto Prune */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label className="text-foreground font-medium">Auto Prune</Label>
            <p className="text-xs text-muted-foreground">
              Remove deleted remote branches during fetch
            </p>
          </div>
          <Switch
            checked={settings.autoPrune ?? true}
            onCheckedChange={(checked) => {
              updateSetting('autoPrune', checked);
              toast.success(checked ? 'Auto prune enabled' : 'Auto prune disabled');
            }}
            data-testid="git-auto-prune"
          />
        </div>

        {/* Fetch Depth */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-foreground font-medium">Fetch Depth</Label>
            <span className="text-sm text-muted-foreground">
              {settings.fetchDepth === 0 ? 'Full history' : `${settings.fetchDepth} commits`}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Shallow clone depth (0 = full history)</p>
          <Slider
            value={[settings.fetchDepth ?? 0]}
            min={FETCH_DEPTH_MIN}
            max={FETCH_DEPTH_MAX}
            step={FETCH_DEPTH_STEP}
            onValueChange={([value]) => updateSetting('fetchDepth', value)}
            className="flex-1"
            data-testid="git-fetch-depth"
          />
        </div>

        {/* Fetch Tags */}
        <div className="space-y-3">
          <Label className="text-foreground font-medium">Fetch Tags</Label>
          <p className="text-xs text-muted-foreground">Control tag fetching behavior</p>
          <Select
            value={settings.fetchTags ?? ''}
            onValueChange={(value) => {
              updateSetting('fetchTags', value);
              toast.success(`Fetch tags set to ${value || 'default'}`);
            }}
          >
            <SelectTrigger className="w-full" data-testid="git-fetch-tags">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Default (respect remote config)</SelectItem>
              <SelectItem value="--tags">--tags (fetch all tags)</SelectItem>
              <SelectItem value="--no-tags">--no-tags (don't fetch tags)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </SettingsCard>

      {/* Diff View Card */}
      <SettingsCard
        icon={<Eye className="w-5 h-5 text-blue-500" />}
        iconBgColor="bg-gradient-to-br from-blue-500/20 to-blue-600/10"
        iconBorderColor="border-blue-500/20"
        iconColor="text-blue-500"
        title="Diff View"
        description="Configure how code changes are displayed."
      >
        {/* Diff View Mode */}
        <div className="space-y-3">
          <Label className="text-foreground font-medium">Diff View Mode</Label>
          <p className="text-xs text-muted-foreground">
            Choose how to display side-by-side or unified diffs
          </p>
          <Select
            value={settings.diffViewMode ?? 'side-by-side'}
            onValueChange={(value: GitEditorSettings['diffViewMode']) => {
              updateSetting('diffViewMode', value);
              toast.success(`Diff view mode set to ${value}`);
            }}
          >
            <SelectTrigger className="w-full" data-testid="git-diff-view-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="side-by-side">Side by Side</SelectItem>
              <SelectItem value="unified">Unified</SelectItem>
              <SelectItem value="split">Split View</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Diff Context Lines */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-foreground font-medium">Diff Context Lines</Label>
            <span className="text-sm text-muted-foreground">
              {settings.diffContextLines ?? 3} lines
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Number of context lines to show around changes
          </p>
          <Slider
            value={[settings.diffContextLines ?? 3]}
            min={DIFF_CONTEXT_LINES_MIN}
            max={DIFF_CONTEXT_LINES_MAX}
            step={1}
            onValueChange={([value]) => updateSetting('diffContextLines', value)}
            className="flex-1"
            data-testid="git-diff-context-lines"
          />
        </div>

        {/* Ignore Whitespace */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label className="text-foreground font-medium">Ignore Whitespace</Label>
            <p className="text-xs text-muted-foreground">Hide whitespace-only changes in diffs</p>
          </div>
          <Switch
            checked={settings.diffIgnoreWhitespace ?? false}
            onCheckedChange={(checked) => {
              updateSetting('diffIgnoreWhitespace', checked);
              toast.success(
                checked ? 'Ignoring whitespace in diffs' : 'Showing whitespace changes'
              );
            }}
            data-testid="git-diff-ignore-whitespace"
          />
        </div>
      </SettingsCard>

      {/* Commit Configuration Card */}
      <SettingsCard
        icon={<FileCode className="w-5 h-5 text-orange-500" />}
        iconBgColor="bg-gradient-to-br from-orange-500/20 to-orange-600/10"
        iconBorderColor="border-orange-500/20"
        iconColor="text-orange-500"
        title="Commit Settings"
        description="Configure commit message templates and validation."
      >
        {/* Commit Message Template */}
        <div className="space-y-3">
          <Label className="text-foreground font-medium">Commit Message Template</Label>
          <p className="text-xs text-muted-foreground">Default template for new commit messages</p>
          <Textarea
            value={settings.commitMessageTemplate ?? ''}
            onChange={(e) => updateSetting('commitMessageTemplate', e.target.value)}
            placeholder="<type>(<scope>): <subject>

<body>

<footer>"
            className="min-h-[100px] font-mono text-sm"
            data-testid="git-commit-message-template"
          />
        </div>

        {/* Verbose Commits */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label className="text-foreground font-medium">Verbose Commits</Label>
            <p className="text-xs text-muted-foreground">
              Include diff stats in commit messages by default
            </p>
          </div>
          <Switch
            checked={settings.verboseCommits ?? false}
            onCheckedChange={(checked) => {
              updateSetting('verboseCommits', checked);
              toast.success(checked ? 'Verbose commits enabled' : 'Verbose commits disabled');
            }}
            data-testid="git-verbose-commits"
          />
        </div>
      </SettingsCard>

      {/* GPG Signing Card */}
      <SettingsCard
        icon={<Lock className="w-5 h-5 text-red-500" />}
        iconBgColor="bg-gradient-to-br from-red-500/20 to-red-600/10"
        iconBorderColor="border-red-500/20"
        iconColor="text-red-500"
        title="GPG Signing"
        description="Configure GPG signing for commits and tags."
      >
        {/* GPG Sign Mode */}
        <div className="space-y-3">
          <Label className="text-foreground font-medium">GPG Sign Mode</Label>
          <p className="text-xs text-muted-foreground">When to sign commits with GPG</p>
          <Select
            value={settings.gpgSignMode ?? 'never'}
            onValueChange={(value: GitEditorSettings['gpgSignMode']) => {
              updateSetting('gpgSignMode', value);
              toast.success(`GPG signing set to ${value}`);
            }}
          >
            <SelectTrigger className="w-full" data-testid="git-gpg-sign-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="never">Never</SelectItem>
              <SelectItem value="always">Always</SelectItem>
              <SelectItem value="prompt">Prompt</SelectItem>
              <SelectItem value="when-key-available">When key available</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* GPG Key ID */}
        <div className="space-y-3">
          <Label className="text-foreground font-medium">GPG Key ID</Label>
          <p className="text-xs text-muted-foreground">
            Specific GPG key to use (empty = use default)
          </p>
          <Input
            value={settings.gpgSignKeyId ?? ''}
            onChange={(e) => updateSetting('gpgSignKeyId', e.target.value || null)}
            placeholder="Leave empty to use default key"
            className="font-mono"
            data-testid="git-gpg-key-id"
          />
        </div>

        {/* Commit GPG Sign */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label className="text-foreground font-medium">Sign Commits</Label>
            <p className="text-xs text-muted-foreground">GPG sign commits by default</p>
          </div>
          <Switch
            checked={settings.commitGpgSign ?? false}
            onCheckedChange={(checked) => {
              updateSetting('commitGpgSign', checked);
              toast.success(checked ? 'Commit GPG signing enabled' : 'Commit GPG signing disabled');
            }}
            data-testid="git-commit-gpg-sign"
          />
        </div>

        {/* Tag GPG Sign */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label className="text-foreground font-medium">Sign Tags</Label>
            <p className="text-xs text-muted-foreground">GPG sign tags by default</p>
          </div>
          <Switch
            checked={settings.tagGpgSign ?? false}
            onCheckedChange={(checked) => {
              updateSetting('tagGpgSign', checked);
              toast.success(checked ? 'Tag GPG signing enabled' : 'Tag GPG signing disabled');
            }}
            data-testid="git-tag-gpg-sign"
          />
        </div>
      </SettingsCard>

      {/* Author Identity Card */}
      <SettingsCard
        icon={<User className="w-5 h-5 text-cyan-500" />}
        iconBgColor="bg-gradient-to-br from-cyan-500/20 to-cyan-600/10"
        iconBorderColor="border-cyan-500/20"
        iconColor="text-cyan-500"
        title="Author Identity"
        description="Override git author name and email."
      >
        {/* Author Name */}
        <div className="space-y-3">
          <Label className="text-foreground font-medium">Author Name</Label>
          <p className="text-xs text-muted-foreground">
            Override git author name (empty = use git config)
          </p>
          <Input
            value={settings.authorOverride?.name ?? ''}
            onChange={(e) => updateAuthorOverride('name', e.target.value)}
            placeholder="Your Name"
            data-testid="git-author-name"
          />
        </div>

        {/* Author Email */}
        <div className="space-y-3">
          <Label className="text-foreground font-medium">Author Email</Label>
          <p className="text-xs text-muted-foreground">
            Override git author email (empty = use git config)
          </p>
          <Input
            type="email"
            value={settings.authorOverride?.email ?? ''}
            onChange={(e) => updateAuthorOverride('email', e.target.value)}
            placeholder="you@example.com"
            data-testid="git-author-email"
          />
        </div>

        {/* Distinct Committer */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label className="text-foreground font-medium">Distinct Committer</Label>
            <p className="text-xs text-muted-foreground">
              Use different committer and author identities
            </p>
          </div>
          <Switch
            checked={settings.distinctCommitter ?? false}
            onCheckedChange={(checked) => {
              updateSetting('distinctCommitter', checked);
              toast.success(checked ? 'Distinct committer enabled' : 'Distinct committer disabled');
            }}
            data-testid="git-distinct-committer"
          />
        </div>
      </SettingsCard>

      {/* Remote Configuration Card */}
      <SettingsCard
        icon={<Radio className="w-5 h-5 text-pink-500" />}
        iconBgColor="bg-gradient-to-br from-pink-500/20 to-pink-600/10"
        iconBorderColor="border-pink-500/20"
        iconColor="text-pink-500"
        title="Remote Configuration"
        description="Configure default remotes for push and pull operations."
      >
        {/* Push Remote */}
        <div className="space-y-3">
          <Label className="text-foreground font-medium">Default Push Remote</Label>
          <p className="text-xs text-muted-foreground">Default remote for push operations</p>
          <Input
            value={settings.pushRemote ?? 'origin'}
            onChange={(e) => updateSetting('pushRemote', e.target.value)}
            placeholder="origin"
            data-testid="git-push-remote"
          />
        </div>

        {/* Pull Remote */}
        <div className="space-y-3">
          <Label className="text-foreground font-medium">Default Pull Remote</Label>
          <p className="text-xs text-muted-foreground">Default remote for pull/fetch operations</p>
          <Input
            value={settings.pullRemote ?? 'origin'}
            onChange={(e) => updateSetting('pullRemote', e.target.value)}
            placeholder="origin"
            data-testid="git-pull-remote"
          />
        </div>

        {/* Push Set Upstream */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label className="text-foreground font-medium">Set Upstream on Push</Label>
            <p className="text-xs text-muted-foreground">
              Automatically set upstream branch when pushing
            </p>
          </div>
          <Switch
            checked={settings.pushSetUpstream ?? true}
            onCheckedChange={(checked) => {
              updateSetting('pushSetUpstream', checked);
              toast.success(checked ? 'Upstream tracking enabled' : 'Upstream tracking disabled');
            }}
            data-testid="git-push-set-upstream"
          />
        </div>
      </SettingsCard>

      {/* UI Preferences Card */}
      <SettingsCard
        icon={<Settings className="w-5 h-5 text-yellow-500" />}
        iconBgColor="bg-gradient-to-br from-yellow-500/20 to-yellow-600/10"
        iconBorderColor="border-yellow-500/20"
        iconColor="text-yellow-500"
        title="UI Preferences"
        description="Configure the git editor interface layout and behavior."
      >
        {/* Default Panel Width */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-foreground font-medium">Panel Width</Label>
            <span className="text-sm text-muted-foreground">
              {uiPreferences.defaultPanelWidth ?? 300}px
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Default panel width in pixels</p>
          <Slider
            value={[uiPreferences.defaultPanelWidth ?? 300]}
            min={PANEL_WIDTH_MIN}
            max={PANEL_WIDTH_MAX}
            step={PANEL_WIDTH_STEP}
            onValueChange={([value]) => updateUiPreference('defaultPanelWidth', value)}
            className="flex-1"
            data-testid="git-panel-width"
          />
        </div>

        {/* Show Line Numbers */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label className="text-foreground font-medium">Show Line Numbers</Label>
            <p className="text-xs text-muted-foreground">Display line numbers in diff views</p>
          </div>
          <Switch
            checked={uiPreferences.showLineNumbers ?? true}
            onCheckedChange={(checked) => updateUiPreference('showLineNumbers', checked)}
            data-testid="git-show-line-numbers"
          />
        </div>

        {/* Diff Word Wrap */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label className="text-foreground font-medium">Word Wrap in Diff</Label>
            <p className="text-xs text-muted-foreground">Wrap long lines in diff view</p>
          </div>
          <Switch
            checked={uiPreferences.diffWordWrap ?? false}
            onCheckedChange={(checked) => updateUiPreference('diffWordWrap', checked)}
            data-testid="git-diff-word-wrap"
          />
        </div>
      </SettingsCard>

      {/* Reset Button */}
      <div className="flex justify-end">
        <button
          onClick={handleReset}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1 rounded hover:bg-accent/50"
          data-testid="git-reset-to-defaults"
        >
          Reset to defaults
        </button>
      </div>
    </div>
  );
};

// Memoize component to prevent unnecessary re-renders when parent updates
export const GitEditorSection = memo(GitEditorSectionComponent);
