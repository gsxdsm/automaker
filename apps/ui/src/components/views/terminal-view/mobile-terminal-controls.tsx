import React, { useState } from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Keyboard, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MobileTerminalControlsProps {
  onInput: (data: string) => void;
  className?: string;
}

export function MobileTerminalControls({ onInput, className }: MobileTerminalControlsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [ctrlActive, setCtrlActive] = useState(false);
  const [altActive, setAltActive] = useState(false);

  const handleKeyClick = (key: string, code?: string) => {
    let data = code || key;

    // Apply modifiers if needed (simplified logic)
    if (ctrlActive) {
      if (key.length === 1 && /[a-z]/i.test(key)) {
        const charCode = key.toUpperCase().charCodeAt(0);
        data = String.fromCharCode(charCode - 64);
      } else if (key === 'ArrowUp') {
        data = '\x1b[1;5A';
      } else if (key === 'ArrowDown') {
        data = '\x1b[1;5B';
      } else if (key === 'ArrowRight') {
        data = '\x1b[1;5C';
      } else if (key === 'ArrowLeft') {
        data = '\x1b[1;5D';
      }
      setCtrlActive(false); // Auto-release
    } else if (altActive) {
      data = '\x1b' + data;
      setAltActive(false); // Auto-release
    }

    onInput(data);
  };

  const keys = [
    { label: 'Esc', code: '\x1b' },
    { label: 'Tab', code: '	' },
    { label: 'Home', code: '\x1b[H' },
    { label: 'End', code: '\x1b[F' },
    { label: 'PgUp', code: '\x1b[5~' },
    { label: 'PgDn', code: '\x1b[6~' },
  ];

  if (!isExpanded) {
    return (
      <Button
        variant="secondary"
        size="sm"
        className={cn(
          'absolute left-1/2 -translate-x-1/2 shadow-lg opacity-80 hover:opacity-100 transition-opacity z-10 h-8 px-3 rounded-full gap-2',
          className
        )}
        style={{ top: '36px' }}
        onClick={() => setIsExpanded(true)}
      >
        <Keyboard className="h-4 w-4" />
        <span className="text-xs">Keys</span>
      </Button>
    );
  }

  return (
    <div
      className={cn(
        'absolute left-0 right-0 bg-background/95 backdrop-blur border-b border-border p-2 z-10 flex gap-2 shadow-xl overflow-x-auto scrollbar-hide items-center',
        className
      )}
      style={{ top: '28px' }}
    >
      {/* Close Button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={() => setIsExpanded(false)}
      >
        <ChevronUp className="h-4 w-4" />
      </Button>

      <div className="w-px h-6 bg-border shrink-0" />

      {/* Modifiers */}
      <Button
        variant={ctrlActive ? 'default' : 'outline'}
        size="sm"
        className="h-8 px-2 text-xs font-mono shrink-0"
        onClick={() => setCtrlActive(!ctrlActive)}
      >
        Ctrl
      </Button>
      <Button
        variant={altActive ? 'default' : 'outline'}
        size="sm"
        className="h-8 px-2 text-xs font-mono shrink-0"
        onClick={() => setAltActive(!altActive)}
      >
        Alt
      </Button>

      <div className="w-px h-6 bg-border shrink-0" />

      {/* Arrows - Collapsed into row */}
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={() => handleKeyClick('ArrowLeft', '\x1b[D')}
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={() => handleKeyClick('ArrowDown', '\x1b[B')}
      >
        <ArrowDown className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={() => handleKeyClick('ArrowUp', '\x1b[A')}
      >
        <ArrowUp className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={() => handleKeyClick('ArrowRight', '\x1b[C')}
      >
        <ArrowRight className="h-4 w-4" />
      </Button>

      <div className="w-px h-6 bg-border shrink-0" />

      {/* Special Keys */}
      {keys.map((k) => (
        <Button
          key={k.label}
          variant="secondary"
          size="sm"
          className="h-8 px-2 text-xs font-mono shrink-0"
          onClick={() => handleKeyClick(k.label, k.code)}
        >
          {k.label}
        </Button>
      ))}

      <div className="w-px h-6 bg-border shrink-0" />

      {/* Common symbols */}
      {['-', '/', '|', '~'].map((char) => (
        <Button
          key={char}
          variant="secondary"
          size="sm"
          className="h-8 w-8 p-0 text-xs font-mono shrink-0"
          onClick={() => handleKeyClick(char)}
        >
          {char}
        </Button>
      ))}

      <div className="w-px h-6 bg-border shrink-0" />

      {/* Quick Actions */}
      <Button
        variant="destructive"
        size="sm"
        className="h-8 px-3 text-xs shrink-0"
        onClick={() => {
          onInput('\x03');
          setCtrlActive(false);
        }}
      >
        ^C
      </Button>
    </div>
  );
}
