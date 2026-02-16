import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  GitBranch,
  AlertCircle,
  Sparkles,
  Bug,
  Flame,
  Settings,
  FileText,
  CheckCircle,
  Package,
  ChevronDown,
  Info,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { getElectronAPI } from '@/lib/electron';
import { toast } from 'sonner';
import { useCreateWorktree } from '@/hooks/mutations/use-worktree-mutations';
import { useBranches } from '@/hooks/queries/use-branches';

// Branch templates - matches BRANCH_TEMPLATES from @automaker/types
// NOTE: Keep in sync with libs/types/src/settings.ts
const BRANCH_TEMPLATES = [
  {
    id: 'feature',
    name: 'Feature',
    prefix: 'feature/',
    icon: Sparkles,
    description: 'New features',
  },
  { id: 'bugfix', name: 'Bug Fix', prefix: 'bugfix/', icon: Bug, description: 'Bug fixes' },
  {
    id: 'hotfix',
    name: 'Hot Fix',
    prefix: 'hotfix/',
    icon: Flame,
    description: 'Critical production fixes',
  },
  {
    id: 'refactor',
    name: 'Refactor',
    prefix: 'refactor/',
    icon: GitBranch,
    description: 'Code refactoring',
  },
  {
    id: 'chore',
    name: 'Chore',
    prefix: 'chore/',
    icon: Settings,
    description: 'Maintenance tasks',
  },
  {
    id: 'docs',
    name: 'Docs',
    prefix: 'docs/',
    icon: FileText,
    description: 'Documentation changes',
  },
  {
    id: 'test',
    name: 'Test',
    prefix: 'test/',
    icon: CheckCircle,
    description: 'Test improvements',
  },
  {
    id: 'release',
    name: 'Release',
    prefix: 'release/',
    icon: Package,
    description: 'Release preparation',
  },
] as const;

/**
 * Parse git/worktree error messages and return user-friendly versions
 */
function parseWorktreeError(error: string): { title: string; description?: string } {
  const errorLower = error.toLowerCase();

  if (errorLower.includes('already exists') && errorLower.includes('worktree')) {
    return {
      title: 'A worktree with this name already exists',
      description: 'Try a different branch name or delete the existing worktree first.',
    };
  }

  if (
    errorLower.includes('already checked out') ||
    errorLower.includes('is already used by worktree')
  ) {
    return {
      title: 'This branch is already in use',
      description: 'The branch is checked out in another worktree. Use a different branch name.',
    };
  }

  if (errorLower.includes('already exists') && errorLower.includes('branch')) {
    return {
      title: 'A branch with this name already exists',
      description: 'The worktree will use the existing branch, or try a different name.',
    };
  }

  if (errorLower.includes('not a git repository')) {
    return {
      title: 'Not a git repository',
      description: 'Initialize git in this project first with "git init".',
    };
  }

  if (errorLower.includes('.lock') || errorLower.includes('lock file')) {
    return {
      title: 'Another git operation is in progress',
      description: 'Wait for it to complete or remove stale lock files.',
    };
  }

  if (errorLower.includes('permission denied') || errorLower.includes('access denied')) {
    return {
      title: 'Permission denied',
      description: 'Check file permissions for the project directory.',
    };
  }

  return {
    title: error.replace(/^(fatal|error):\s*/i, '').split('\n')[0],
  };
}

interface CreatedWorktreeInfo {
  path: string;
  branch: string;
}

interface CreateWorktreeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectPath: string;
  onCreated: (worktree: CreatedWorktreeInfo) => void;
}

export function CreateWorktreeDialog({
  open,
  onOpenChange,
  projectPath,
  onCreated,
}: CreateWorktreeDialogProps) {
  const createMutation = useCreateWorktree(projectPath);
  const { data: branchesData, isLoading: isLoadingBranches } = useBranches(projectPath, true);

  const [selectedTemplate, setSelectedTemplate] = useState<string>('feature');
  const [branchName, setBranchName] = useState('');
  const [issueNumber, setIssueNumber] = useState('');
  const [baseBranch, setBaseBranch] = useState<string>('HEAD');
  const [customPath, setCustomPath] = useState('');
  const [copyEnvFile, setCopyEnvFile] = useState(true);
  const [installDependencies, setInstallDependencies] = useState(false);
  const [runSetupScript, setRunSetupScript] = useState(true);
  const [error, setError] = useState<{ title: string; description?: string } | null>(null);

  // Calculate preview of the final branch name (matches backend formatBranchName logic)
  const branchNamePreview = useMemo(() => {
    const template = BRANCH_TEMPLATES.find((t) => t.id === selectedTemplate);
    const prefix = template?.prefix || '';
    const sanitized = branchName.trim().replace(/\s+/g, '-');
    if (!sanitized) return `${prefix}<branch-name>`;
    if (issueNumber.trim()) {
      return `${prefix}${issueNumber.trim()}-${sanitized}`;
    }
    return `${prefix}${sanitized}`;
  }, [selectedTemplate, branchName, issueNumber]);

  const selectedTemplateData = BRANCH_TEMPLATES.find((t) => t.id === selectedTemplate);
  const TemplateIcon = selectedTemplateData?.icon || GitBranch;

  const handleCreate = async () => {
    if (!branchName.trim()) {
      setError({ title: 'Branch name is required' });
      return;
    }

    // Validate branch name (git-compatible)
    const validBranchRegex = /^[a-zA-Z0-9._/-]+$/;
    if (!validBranchRegex.test(branchName)) {
      setError({
        title: 'Invalid branch name',
        description: 'Use only letters, numbers, dots, underscores, hyphens, and slashes.',
      });
      return;
    }

    // Validate custom path if provided
    if (customPath.trim()) {
      // Prevent path traversal attempts
      const trimmedPath = customPath.trim();
      if (trimmedPath.includes('..') || trimmedPath.includes('~') || /^\//.test(trimmedPath)) {
        setError({
          title: 'Invalid custom path',
          description: 'Path must be a relative directory name without .., ~, or leading slashes.',
        });
        return;
      }
      // Only allow safe characters
      const validPathRegex = /^[a-zA-Z0-9_-]+$/;
      if (!validPathRegex.test(trimmedPath)) {
        setError({
          title: 'Invalid custom path',
          description: 'Use only letters, numbers, hyphens, and underscores.',
        });
        return;
      }
    }

    setError(null);

    try {
      await createMutation.mutateAsync({
        branchName: branchName.trim(),
        baseBranch: baseBranch !== 'HEAD' ? baseBranch : undefined,
        branchTemplate: selectedTemplateData?.prefix,
        issueNumber: issueNumber.trim() || undefined,
        customPath: customPath.trim() || undefined,
        fileCopySettings: {
          copyEnvFile,
          customFiles: [],
        },
        postCreationActions: {
          installDependencies,
          runSetupScript,
        },
      });

      // Note: toast.success is already shown by useCreateWorktree mutation
      onCreated({
        path: '', // Will be filled by mutation result
        branch: branchNamePreview,
      });
      onOpenChange(false);
      resetForm();
    } catch (err) {
      // Set error state for UI feedback
      // Note: toast.error is already shown by useCreateWorktree mutation
      setError({
        title: 'Failed to create worktree',
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };

  const resetForm = () => {
    setBranchName('');
    setIssueNumber('');
    setBaseBranch('HEAD');
    setCustomPath('');
    setCopyEnvFile(true);
    setInstallDependencies(false);
    setRunSetupScript(true);
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !createMutation.isPending && branchName.trim()) {
      handleCreate();
    }
  };

  const branches = branchesData || [];
  const localBranches = branches.filter((b) => !b.isRemote);
  const remoteBranches = branches.filter((b) => b.isRemote);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="w-5 h-5" />
            Create New Worktree
          </DialogTitle>
          <DialogDescription>
            Create a new git worktree with its own branch. This allows you to work on multiple
            features in parallel.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="basic">Basic</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 py-4">
            {/* Branch Template */}
            <div className="grid gap-2">
              <Label>Branch Template</Label>
              <div className="grid grid-cols-4 gap-2">
                {BRANCH_TEMPLATES.map((template) => {
                  const Icon = template.icon;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => setSelectedTemplate(template.id)}
                      className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all ${
                        selectedTemplate === template.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-xs font-medium">{template.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Branch Name */}
            <div className="grid gap-2">
              <Label htmlFor="branch-name">
                Branch Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="branch-name"
                placeholder="my-new-feature"
                value={branchName}
                onChange={(e) => {
                  setBranchName(e.target.value);
                  setError(null);
                }}
                onKeyDown={handleKeyDown}
                className="font-mono text-sm"
                autoFocus
              />
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Preview:</span>
                <code className="bg-muted px-2 py-0.5 rounded text-xs font-mono">
                  {branchNamePreview}
                </code>
              </div>
            </div>

            {/* Issue Number */}
            <div className="grid gap-2">
              <Label htmlFor="issue-number" className="flex items-center gap-2">
                Issue/PR Number
                <span className="text-xs text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="issue-number"
                placeholder="123"
                value={issueNumber}
                onChange={(e) => {
                  setIssueNumber(e.target.value.replace(/[^0-9]/g, ''));
                  setError(null);
                }}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Will be prefixed to branch name: {selectedTemplateData?.prefix}
                {issueNumber ? `<issue-number>-` : ''}&lt;branch-name&gt;
              </p>
            </div>

            {/* Base Branch */}
            <div className="grid gap-2">
              <Label htmlFor="base-branch">Base Branch</Label>
              <Select value={baseBranch} onValueChange={setBaseBranch} disabled={isLoadingBranches}>
                <SelectTrigger id="base-branch">
                  <SelectValue placeholder="Select base branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HEAD">HEAD (current position)</SelectItem>
                  {localBranches.map((branch) => (
                    <SelectItem key={branch.name} value={branch.name}>
                      <span className="flex items-center gap-2">
                        <GitBranch className="w-3 h-3" />
                        {branch.name}
                      </span>
                    </SelectItem>
                  ))}
                  {remoteBranches.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        Remote Branches
                      </div>
                      {remoteBranches.map((branch) => (
                        <SelectItem key={branch.name} value={branch.name}>
                          <span className="flex items-center gap-2">
                            <ChevronDown className="w-3 h-3" />
                            {branch.name}
                          </span>
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Error Display */}
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
                <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-destructive">{error.title}</p>
                  {error.description && (
                    <p className="text-xs text-destructive/80">{error.description}</p>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4 py-4">
            {/* Custom Path */}
            <div className="grid gap-2">
              <Label htmlFor="custom-path" className="flex items-center gap-2">
                Custom Worktree Path
                <span className="text-xs text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="custom-path"
                placeholder="custom-directory-name"
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Relative path inside .worktrees/ directory. Defaults to sanitized branch name.
              </p>
            </div>

            {/* File Copy Settings */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Info className="w-4 h-4" />
                Files to Copy
              </Label>
              <div className="space-y-2">
                <div className="flex items-start gap-3 p-3 rounded-lg border">
                  <Checkbox id="copy-env" checked={copyEnvFile} onCheckedChange={setCopyEnvFile} />
                  <div className="grid gap-1.5 leading-none">
                    <Label
                      htmlFor="copy-env"
                      className="text-sm font-medium cursor-pointer flex items-center gap-2"
                    >
                      Copy .env file
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Copy environment variables from main project to worktree
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Post-Creation Actions */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Info className="w-4 h-4" />
                Post-Creation Actions
              </Label>
              <div className="space-y-2">
                <div className="flex items-start gap-3 p-3 rounded-lg border">
                  <Checkbox
                    id="install-deps"
                    checked={installDependencies}
                    onCheckedChange={setInstallDependencies}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <Label
                      htmlFor="install-deps"
                      className="text-sm font-medium cursor-pointer flex items-center gap-2"
                    >
                      Install Dependencies
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Auto-run npm/pnpm/yarn install in the new worktree
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg border">
                  <Checkbox
                    id="run-setup"
                    checked={runSetupScript}
                    onCheckedChange={setRunSetupScript}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <Label
                      htmlFor="run-setup"
                      className="text-sm font-medium cursor-pointer flex items-center gap-2"
                    >
                      Run Setup Script
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Execute the project's init script if defined
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={createMutation.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={createMutation.isPending || !branchName.trim()}>
            {createMutation.isPending ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Creating...
              </>
            ) : (
              <>
                <TemplateIcon className="w-4 h-4 mr-2" />
                Create Worktree
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
