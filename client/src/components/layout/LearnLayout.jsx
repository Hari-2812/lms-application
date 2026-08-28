import { Outlet } from 'react-router-dom';

/**
 * The video-learning shell is deliberately full width and chrome-light: no
 * dashboard sidebar competing with the curriculum panel next to the player.
 */
export default function LearnLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-ink-950">
      <Outlet />
    </div>
  );
}
