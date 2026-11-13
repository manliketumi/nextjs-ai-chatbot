'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { UserRound } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

const AccountContext = createContext<string | null>(null);

export function AccountProvider({
  email,
  children,
}: { email: string | null; children: React.ReactNode }) {
  return (
    <AccountContext.Provider value={email}>{children}</AccountContext.Provider>
  );
}

export function SignOutButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div>
      <Button
        variant="outline"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(false);
          try {
            await signOut({ redirectTo: '/login' });
          } catch {
            setPending(false);
            setError(true);
          }
        }}
      >
        {pending ? 'Signing out…' : 'Sign out'}
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          Could not sign out. Please try again.
        </p>
      )}
    </div>
  );
}

export function AccountMenu() {
  const email = useContext(AccountContext);
  if (!email)
    return (
      <Button asChild variant="outline" className="ml-auto order-last">
        <Link href="/login">Sign in</Link>
      </Button>
    );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="ml-auto order-last gap-2"
          aria-label="Account menu"
        >
          <UserRound size={16} />
          <span>Account</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-w-[calc(100vw-2rem)] w-64"
      >
        <p className="p-2 text-sm truncate" title={email}>
          {email}
        </p>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">Profile &amp; settings</Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            void signOut({ redirectTo: '/login' }).catch(() =>
              toast.error('Could not sign out. Please try again.'),
            );
          }}
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <div className="space-y-2">
      <label htmlFor="appearance" className="text-sm font-medium">
        Theme
      </label>
      <Select
        value={mounted ? theme : 'system'}
        onValueChange={setTheme}
        disabled={!mounted}
      >
        <SelectTrigger id="appearance" className="max-w-xs">
          <SelectValue placeholder="Choose a theme" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="system">Use device setting</SelectItem>
          <SelectItem value="light">Light</SelectItem>
          <SelectItem value="dark">Dark</SelectItem>
        </SelectContent>
      </Select>
      <p className="text-sm text-muted-foreground">
        Your choice is saved in this browser.
      </p>
    </div>
  );
}
