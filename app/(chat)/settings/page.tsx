import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/app/(auth)/auth';
import {
  AppearanceSettings,
  SignOutButton,
} from '@/components/account-controls';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=%2Fsettings');
  return (
    <section aria-labelledby="settings-title" className="w-full max-w-2xl mx-auto p-4 md:p-8 space-y-6">
      <Button asChild variant="ghost">
        <Link href="/">← Back to chats</Link>
      </Button>
      <div>
        <h1 id="settings-title" className="text-2xl font-semibold">Profile &amp; settings</h1>
        <p className="mt-2 text-muted-foreground">
          Manage your account and make the app feel like yours.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your signed-in account.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl>
            <dt className="text-sm text-muted-foreground">Email address</dt>
            <dd className="mt-1 break-all font-medium">{session.user.email}</dd>
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Choose how the app looks.</CardDescription>
        </CardHeader>
        <CardContent>
          <AppearanceSettings />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Session</CardTitle>
          <CardDescription>
            Your saved conversations will be here when you sign back in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignOutButton />
        </CardContent>
      </Card>
    </section>
  );
}
