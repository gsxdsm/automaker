import { createFileRoute } from '@tanstack/react-router';
import { GitView } from '@/components/views/git-view';

export const Route = createFileRoute('/git')({
  component: GitView,
});
