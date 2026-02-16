import { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertTriangle,
  GitMerge,
  X,
  Check,
  FileText,
  ArrowLeft,
  ArrowRight,
  SkipForward,
  Save,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';

export interface ConflictFile {
  path: string;
  ours?: string;
  theirs?: string;
  base?: string;
  conflictMarkers?: string;
  resolved?: boolean;
}

interface ConflictResolutionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAbort: () => void;
  onContinue: () => void;
  onSkip?: () => void;
  conflictFiles: ConflictFile[];
  projectPath: string;
  operation: 'merge' | 'rebase';
  isLoading?: boolean;
}

type ConflictResolutionChoice = 'ours' | 'theirs' | 'manual';

export function ConflictResolutionDialogEnhanced({
  open,
  onOpenChange,
  onAbort,
  onContinue,
  onSkip,
  conflictFiles,
  projectPath,
  operation,
  isLoading = false,
}: ConflictResolutionDialogProps) {
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [resolutions, setResolutions] = useState<Record<string, ConflictResolutionChoice>>({});
  const [manualContent, setManualContent] = useState<Record<string, string>>({});
  const [showManualEditor, setShowManualEditor] = useState(false);

  const selectedFile = conflictFiles[selectedFileIndex];
  const currentResolution = resolutions[selectedFile?.path];
  const allResolved = conflictFiles.every(
    (f) => resolutions[f.path] && resolutions[f.path] !== 'manual'
  );
  const hasManualResolution = Object.values(resolutions).some((r) => r === 'manual');

  // Reset manual editor state when switching files
  useEffect(() => {
    if (selectedFile) {
      const currentManualContent = manualContent[selectedFile.path];
      if (currentResolution === 'manual' && !currentManualContent) {
        // Initialize with conflict markers if available
        setManualContent((prev) => ({
          ...prev,
          [selectedFile.path]: selectedFile.conflictMarkers || selectedFile.ours || '',
        }));
      }
    }
  }, [selectedFile, currentResolution, manualContent]);

  const handleResolutionChoice = useCallback(
    (choice: ConflictResolutionChoice) => {
      if (!selectedFile) return;
      setResolutions((prev) => ({ ...prev, [selectedFile.path]: choice }));
      if (choice === 'manual') {
        setShowManualEditor(true);
      } else {
        setShowManualEditor(false);
      }
    },
    [selectedFile]
  );

  const handleManualEdit = useCallback(
    (content: string) => {
      if (!selectedFile) return;
      setManualContent((prev) => ({ ...prev, [selectedFile.path]: content }));
    },
    [selectedFile]
  );

  const handleSaveManualResolution = useCallback(() => {
    if (!selectedFile) return;
    setResolutions((prev) => ({ ...prev, [selectedFile.path]: 'manual' }));
    setShowManualEditor(false);
  }, [selectedFile]);

  const handleCancelManualEdit = useCallback(() => {
    if (!selectedFile) return;
    // Revert to previous resolution or clear
    const prevResolution = resolutions[selectedFile.path];
    if (prevResolution !== 'manual') {
      setResolutions((prev) => ({ ...prev, [selectedFile.path]: prevResolution }));
    } else {
      const { [selectedFile.path]: _, ...rest } = resolutions;
      setResolutions(rest);
    }
    setShowManualEditor(false);
  }, [selectedFile, resolutions]);

  const goToNextFile = useCallback(() => {
    if (selectedFileIndex < conflictFiles.length - 1) {
      setSelectedFileIndex(selectedFileIndex + 1);
      setShowManualEditor(false);
    }
  }, [selectedFileIndex, conflictFiles.length]);

  const goToPrevFile = useCallback(() => {
    if (selectedFileIndex > 0) {
      setSelectedFileIndex(selectedFileIndex - 1);
      setShowManualEditor(false);
    }
  }, [selectedFileIndex]);

  const handleContinue = async () => {
    // Apply resolutions and continue
    await onContinue();
    setResolutions({});
    setManualContent({});
  };

  const handleAbort = () => {
    onAbort();
    setResolutions({});
    setManualContent({});
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {operation === 'merge' ? 'Merge' : 'Rebase'} Conflicts Detected
          </DialogTitle>
          <DialogDescription>
            {conflictFiles.length} file(s) have conflicts that need to be resolved before the{' '}
            {operation} can be completed.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex gap-4">
          {/* File list sidebar */}
          <div className="w-64 border-r border-border overflow-hidden flex flex-col">
            <div className="p-3 border-b border-border">
              <h3 className="text-sm font-medium">Conflicted Files</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {Object.values(resolutions).filter((r) => r).length} of {conflictFiles.length}{' '}
                resolved
              </p>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {conflictFiles.map((file, index) => {
                  const resolution = resolutions[file.path];
                  const isSelected = index === selectedFileIndex;
                  return (
                    <button
                      key={file.path}
                      onClick={() => setSelectedFileIndex(index)}
                      className={cn(
                        'w-full text-left p-2 rounded text-xs hover:bg-accent/50 transition-colors',
                        isSelected && 'bg-accent',
                        resolution && 'border-l-2 border-l-green-500'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-3 w-3 shrink-0" />
                        <span className="font-mono truncate flex-1">{file.path}</span>
                        {resolution && resolution !== 'manual' && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1">
                            {resolution === 'ours' ? 'Current' : 'Incoming'}
                          </Badge>
                        )}
                        {resolution === 'manual' && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1 bg-amber-500/20">
                            Manual
                          </Badge>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Conflict resolution area */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {selectedFile ? (
              <>
                {/* File header */}
                <div className="p-3 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-sm">{selectedFile.path}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={goToPrevFile}
                      disabled={selectedFileIndex === 0}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {selectedFileIndex + 1} / {conflictFiles.length}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={goToNextFile}
                      disabled={selectedFileIndex === conflictFiles.length - 1}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Resolution options */}
                <div className="p-4 border-b border-border bg-muted/30">
                  {!showManualEditor ? (
                    <>
                      <p className="text-sm font-medium mb-3">
                        How do you want to resolve this conflict?
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant={currentResolution === 'ours' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleResolutionChoice('ours')}
                        >
                          <Check className="h-4 w-4 mr-2" />
                          Keep Current ({operation === 'merge' ? 'OURS' : 'Local Changes'})
                        </Button>
                        <Button
                          variant={currentResolution === 'theirs' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleResolutionChoice('theirs')}
                        >
                          <Check className="h-4 w-4 mr-2" />
                          Use Incoming ({operation === 'merge' ? 'THEIRS' : 'Upstream'})
                        </Button>
                        <Button
                          variant={currentResolution === 'manual' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleResolutionChoice('manual')}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Edit Manually
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Manual Conflict Resolution</p>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={handleCancelManualEdit}>
                            Cancel
                          </Button>
                          <Button variant="default" size="sm" onClick={handleSaveManualResolution}>
                            <Save className="h-4 w-4 mr-2" />
                            Save Resolution
                          </Button>
                        </div>
                      </div>
                      <Textarea
                        value={
                          manualContent[selectedFile?.path] || selectedFile?.conflictMarkers || ''
                        }
                        onChange={(e) => handleManualEdit(e.target.value)}
                        placeholder="Edit the file content to resolve conflicts..."
                        className="font-mono text-xs min-h-[200px] max-h-[300px]"
                      />
                      <p className="text-xs text-muted-foreground">
                        Edit the content above to resolve merge conflicts. Remove conflict markers
                        (&lt;&lt;&lt;&lt;&lt;&lt;&lt;, =======, &gt;&gt;&gt;&gt;&gt;&gt;&gt;) as
                        needed.
                      </p>
                    </div>
                  )}
                </div>

                {/* 3-way merge view */}
                <div className="flex-1 overflow-hidden">
                  <Tabs defaultValue="three-way" className="h-full flex flex-col">
                    <TabsList className="grid w-full grid-cols-4">
                      <TabsTrigger value="three-way">3-Way View</TabsTrigger>
                      <TabsTrigger value="ours">Current</TabsTrigger>
                      <TabsTrigger value="theirs">Incoming</TabsTrigger>
                      <TabsTrigger value="base">Base</TabsTrigger>
                    </TabsList>

                    <TabsContent value="three-way" className="flex-1 overflow-hidden">
                      <div className="grid grid-cols-3 gap-0 h-full rounded-lg overflow-hidden border">
                        {/* Ours */}
                        <div className="flex flex-col border-r border-border">
                          <div className="p-2 bg-blue-500/10 border-b border-border text-xs font-medium text-blue-700">
                            Current ({operation === 'merge' ? 'OURS' : 'Local'})
                          </div>
                          <ScrollArea className="flex-1">
                            <pre className="p-3 text-xs font-mono whitespace-pre-wrap">
                              {selectedFile.ours || 'No content available'}
                            </pre>
                          </ScrollArea>
                        </div>

                        {/* Base */}
                        <div className="flex flex-col border-r border-border">
                          <div className="p-2 bg-gray-500/10 border-b border-border text-xs font-medium text-gray-700">
                            Base (Common Ancestor)
                          </div>
                          <ScrollArea className="flex-1">
                            <pre className="p-3 text-xs font-mono whitespace-pre-wrap">
                              {selectedFile.base || 'No content available'}
                            </pre>
                          </ScrollArea>
                        </div>

                        {/* Theirs */}
                        <div className="flex flex-col">
                          <div className="p-2 bg-green-500/10 border-b border-border text-xs font-medium text-green-700">
                            Incoming ({operation === 'merge' ? 'THEIRS' : 'Upstream'})
                          </div>
                          <ScrollArea className="flex-1">
                            <pre className="p-3 text-xs font-mono whitespace-pre-wrap">
                              {selectedFile.theirs || 'No content available'}
                            </pre>
                          </ScrollArea>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="ours" className="flex-1 overflow-hidden">
                      <ScrollArea className="h-full rounded-lg border bg-background">
                        <pre className="p-4 text-xs font-mono whitespace-pre-wrap">
                          {selectedFile.ours || 'No content available'}
                        </pre>
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="theirs" className="flex-1 overflow-hidden">
                      <ScrollArea className="h-full rounded-lg border bg-background">
                        <pre className="p-4 text-xs font-mono whitespace-pre-wrap">
                          {selectedFile.theirs || 'No content available'}
                        </pre>
                      </ScrollArea>
                    </TabsContent>

                    <TabsContent value="base" className="flex-1 overflow-hidden">
                      <ScrollArea className="h-full rounded-lg border bg-background">
                        <pre className="p-4 text-xs font-mono whitespace-pre-wrap">
                          {selectedFile.base || 'No content available'}
                        </pre>
                      </ScrollArea>
                    </TabsContent>
                  </Tabs>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                No file selected
              </div>
            )}
          </div>
        </div>

        {/* Footer with actions */}
        <DialogFooter className="flex-col sm:flex-row gap-2 border-t border-border pt-4">
          <div className="flex-1 flex gap-2">
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={handleAbort}
            >
              <X className="h-4 w-4 mr-2" />
              Abort {operation}
            </Button>
            {operation === 'rebase' && onSkip && (
              <Button variant="outline" onClick={onSkip}>
                <SkipForward className="h-4 w-4 mr-2" />
                Skip Commit
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button
              onClick={handleContinue}
              disabled={(!allResolved && !hasManualResolution) || isLoading}
            >
              {isLoading ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Applying...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Continue {operation}
                </>
              )}
            </Button>
          </div>
        </DialogFooter>

        {/* Mobile-friendly action buttons */}
        <div className="sm:hidden flex border-t border-border pt-4 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-destructive"
            onClick={handleAbort}
          >
            <X className="h-4 w-4 mr-1" />
            Abort
          </Button>
          {operation === 'rebase' && onSkip && (
            <Button variant="outline" size="sm" className="flex-1" onClick={onSkip}>
              <SkipForward className="h-4 w-4 mr-1" />
              Skip
            </Button>
          )}
          <Button
            size="sm"
            className="flex-1"
            onClick={handleContinue}
            disabled={(!allResolved && !hasManualResolution) || isLoading}
          >
            {isLoading ? (
              <Spinner size="sm" />
            ) : (
              <>
                <Check className="h-4 w-4 mr-1" />
                Continue
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
