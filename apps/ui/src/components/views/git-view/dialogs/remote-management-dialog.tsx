import { useState, useCallback, useMemo } from 'react';
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
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Cloud, Plus, Trash2, Edit2, Loader2, Globe, AlertCircle } from 'lucide-react';
import {
  useRemotes,
  useAddRemote,
  useRemoveRemote,
  useUpdateRemote,
  useFetchFromRemote,
} from '@/hooks/queries';
import { toast } from 'sonner';
import { isValidGitUrl, sanitizeRemoteName, GIT_TOAST_MESSAGES } from './git-utils';

type RemoteAction = 'add' | 'edit' | 'delete' | 'fetch';

interface RemoteManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectPath: string;
}

interface Remote {
  name: string;
  fetchUrl?: string;
  pushUrl?: string;
}

/**
 * Dialog for managing git remotes.
 * Supports adding, editing, removing, and fetching from remotes.
 */
export function RemoteManagementDialog({
  open,
  onOpenChange,
  projectPath,
}: RemoteManagementDialogProps) {
  const [action, setAction] = useState<RemoteAction | null>(null);
  const [selectedRemote, setSelectedRemote] = useState<Remote | null>(null);
  const [remoteName, setRemoteName] = useState('');
  const [remoteUrl, setRemoteUrl] = useState('');
  const [urlError, setUrlError] = useState<string>('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Queries and mutations
  const { data: remotes = [], isLoading } = useRemotes(projectPath, open);
  const addRemoteMutation = useAddRemote();
  const removeRemoteMutation = useRemoveRemote();
  const updateRemoteMutation = useUpdateRemote();
  const fetchMutation = useFetchFromRemote();

  // Memoize pending state
  const isPending = useMemo(
    () =>
      addRemoteMutation.isPending ||
      removeRemoteMutation.isPending ||
      updateRemoteMutation.isPending ||
      fetchMutation.isPending,
    [
      addRemoteMutation.isPending,
      removeRemoteMutation.isPending,
      updateRemoteMutation.isPending,
      fetchMutation.isPending,
    ]
  );

  /**
   * Open the add remote dialog
   */
  const openAddDialog = useCallback(() => {
    setAction('add');
    setRemoteName('');
    setRemoteUrl('');
    setUrlError('');
  }, []);

  /**
   * Open the edit remote dialog
   */
  const openEditDialog = useCallback((remote: Remote) => {
    setAction('edit');
    setSelectedRemote(remote);
    setRemoteName(remote.name);
    setRemoteUrl(remote.fetchUrl || remote.pushUrl || '');
    setUrlError('');
  }, []);

  /**
   * Open the delete confirmation dialog
   */
  const openDeleteDialog = useCallback((remote: Remote) => {
    setAction('delete');
    setSelectedRemote(remote);
    setShowDeleteConfirm(true);
  }, []);

  /**
   * Fetch updates from a remote
   */
  const handleFetch = useCallback(
    async (remoteName: string) => {
      try {
        await fetchMutation.mutateAsync({
          projectPath,
          remote: remoteName,
        });

        const successMsg = GIT_TOAST_MESSAGES.FETCH_SUCCESS(remoteName);
        toast.success(successMsg.title, {
          description: successMsg.description,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        const failureMsg = GIT_TOAST_MESSAGES.FETCH_FAILED(errorMsg);
        toast.error(failureMsg.title, {
          description: failureMsg.description,
        });
      }
    },
    [fetchMutation, projectPath]
  );

  /**
   * Validate URL input
   */
  const validateUrl = useCallback((url: string): boolean => {
    if (!url.trim()) {
      setUrlError('URL is required');
      return false;
    }

    if (!isValidGitUrl(url)) {
      setUrlError(GIT_TOAST_MESSAGES.VALIDATION_ERROR_INVALID_URL);
      return false;
    }

    setUrlError('');
    return true;
  }, []);

  /**
   * Handle URL input change with validation
   */
  const handleUrlChange = useCallback(
    (value: string) => {
      setRemoteUrl(value);
      // Clear error when user starts typing
      if (urlError) {
        setUrlError('');
      }
    },
    [urlError]
  );

  /**
   * Handle URL blur for validation
   */
  const handleUrlBlur = useCallback(() => {
    if (remoteUrl) {
      validateUrl(remoteUrl);
    }
  }, [remoteUrl, validateUrl]);

  /**
   * Save remote (add or update)
   */
  const handleSave = useCallback(async () => {
    if (!remoteName.trim() || !remoteUrl.trim()) {
      toast.error(GIT_TOAST_MESSAGES.VALIDATION_ERROR_REQUIRED);
      return;
    }

    // Validate URL
    if (!validateUrl(remoteUrl)) {
      return;
    }

    const sanitizedName = sanitizeRemoteName(remoteName);

    try {
      if (action === 'add') {
        // Check if remote already exists
        if (remotes.some((r) => r.name === sanitizedName)) {
          const errorMsg = GIT_TOAST_MESSAGES.REMOTE_EXISTS(sanitizedName);
          toast.error(errorMsg.title, {
            description: errorMsg.description,
          });
          return;
        }

        await addRemoteMutation.mutateAsync({
          projectPath,
          name: sanitizedName,
          url: remoteUrl.trim(),
        });

        const successMsg = GIT_TOAST_MESSAGES.REMOTE_ADDED(sanitizedName);
        toast.success(successMsg.title, {
          description: successMsg.description,
        });
      } else if (action === 'edit' && selectedRemote) {
        await updateRemoteMutation.mutateAsync({
          projectPath,
          name: selectedRemote.name,
          url: remoteUrl.trim(),
        });

        const successMsg = GIT_TOAST_MESSAGES.REMOTE_UPDATED(sanitizedName);
        toast.success(successMsg.title, {
          description: successMsg.description,
        });
      }

      // Reset state
      setAction(null);
      setSelectedRemote(null);
      setRemoteName('');
      setRemoteUrl('');
      setUrlError('');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      const failureMsg = GIT_TOAST_MESSAGES.REMOTE_SAVE_FAILED(errorMsg);
      toast.error(failureMsg.title, {
        description: failureMsg.description,
      });
    }
  }, [
    remoteName,
    remoteUrl,
    action,
    selectedRemote,
    remotes,
    projectPath,
    addRemoteMutation,
    updateRemoteMutation,
    validateUrl,
  ]);

  /**
   * Delete a remote
   */
  const handleDelete = useCallback(async () => {
    if (!selectedRemote) return;

    try {
      await removeRemoteMutation.mutateAsync({
        projectPath,
        name: selectedRemote.name,
      });

      const successMsg = GIT_TOAST_MESSAGES.REMOTE_REMOVED(selectedRemote.name);
      toast.success(successMsg.title, {
        description: successMsg.description,
      });

      // Reset state
      setShowDeleteConfirm(false);
      setAction(null);
      setSelectedRemote(null);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      const failureMsg = GIT_TOAST_MESSAGES.REMOTE_REMOVE_FAILED(errorMsg);
      toast.error(failureMsg.title, {
        description: failureMsg.description,
      });
    }
  }, [selectedRemote, projectPath, removeRemoteMutation]);

  /**
   * Cancel current action
   */
  const handleCancelAction = useCallback(() => {
    setAction(null);
    setSelectedRemote(null);
    setRemoteName('');
    setRemoteUrl('');
    setUrlError('');
  }, []);

  return (
    <>
      <Dialog open={open && !action} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Remote Management
            </DialogTitle>
            <DialogDescription>Manage git remotes for this repository</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : remotes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Globe className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No remotes configured</p>
                <p className="text-xs mt-1">Add a remote to push and pull changes</p>
              </div>
            ) : (
              <div className="space-y-2">
                {remotes.map((remote) => (
                  <div
                    key={remote.name}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 group"
                  >
                    <Cloud className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{remote.name}</div>
                      <div className="text-xs text-muted-foreground truncate font-mono">
                        {remote.fetchUrl || remote.pushUrl}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        title="Fetch from remote"
                        onClick={() => handleFetch(remote.name)}
                        disabled={isPending}
                      >
                        {fetchMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Cloud className="h-3 w-3" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        title="Edit remote"
                        onClick={() => openEditDialog(remote)}
                        disabled={isPending}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        title="Remove remote"
                        onClick={() => openDeleteDialog(remote)}
                        disabled={isPending}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Close
            </Button>
            <Button onClick={openAddDialog} disabled={isPending}>
              <Plus className="h-4 w-4 mr-2" />
              Add Remote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Remote Dialog */}
      {(action === 'add' || action === 'edit') && (
        <Dialog open={!!action} onOpenChange={handleCancelAction}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{action === 'add' ? 'Add Remote' : 'Edit Remote'}</DialogTitle>
              <DialogDescription>
                {action === 'add'
                  ? 'Add a new git remote to this repository'
                  : `Update the URL for remote "${selectedRemote?.name}"`}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="remote-name">Remote Name</Label>
                <Input
                  id="remote-name"
                  placeholder="origin"
                  value={remoteName}
                  onChange={(e) => setRemoteName(e.target.value)}
                  disabled={action === 'edit' || isPending}
                  autoFocus
                />
                <p className="text-[10px] text-muted-foreground">
                  Common names: origin, upstream, fork
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="remote-url">Remote URL</Label>
                <Input
                  id="remote-url"
                  placeholder="https://github.com/username/repo.git"
                  value={remoteUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  onBlur={handleUrlBlur}
                  disabled={isPending}
                  className={urlError ? 'border-destructive' : ''}
                />
                {urlError && (
                  <p className="text-[10px] text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {urlError}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground">
                  HTTPS or SSH URL (e.g., git@github.com:username/repo.git)
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleCancelAction} disabled={isPending}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isPending || !!urlError}>
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        onConfirm={handleDelete}
        title="Remove Remote?"
        description={`Are you sure you want to remove the remote "${selectedRemote?.name}"? This action cannot be undone.`}
        confirmText="Remove"
        confirmVariant="destructive"
      >
        {isPending && (
          <div className="flex items-center justify-center py-2">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Removing...
          </div>
        )}
      </ConfirmDialog>
    </>
  );
}
