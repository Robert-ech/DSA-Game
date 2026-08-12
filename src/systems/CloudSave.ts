import {
  createClient,
  type Session,
  type SupabaseClient,
} from '@supabase/supabase-js';
import { EVT_SAVE_CHANGED, EVT_TOAST, GameEvents } from './events';
import { SaveManager, type SaveData } from './SaveManager';

export const EVT_AUTH_CHANGED = 'auth-changed';

const SYNC_DEBOUNCE_MS = 2000;
const TABLE = 'saves';

/**
 * Optional cloud sync on top of the localStorage save. Configured via
 * VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY; without them the game runs
 * exactly as before (local-only). Players sign in with an email magic link;
 * their save is upserted (debounced) to a `saves` row guarded by RLS, and on
 * sign-in the cloud and local saves are merged by "most progress wins".
 */
class CloudSaveImpl {
  private client: SupabaseClient | null = null;
  private session: Session | null = null;
  private syncTimer?: number;

  get isConfigured(): boolean {
    return this.client !== null;
  }

  get isSignedIn(): boolean {
    return this.session !== null;
  }

  get userEmail(): string | null {
    return this.session?.user.email ?? null;
  }

  init(): void {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) {
      console.info(
        '[CloudSave] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set — cloud save disabled, using localStorage only.',
      );
      return;
    }
    this.client = createClient(url, key);

    // Fires immediately with the restored session (also right after the
    // magic-link redirect lands), then on every sign-in/out.
    this.client.auth.onAuthStateChange((_event, session) => {
      const wasSignedIn = this.session !== null;
      this.session = session;
      GameEvents.emit(EVT_AUTH_CHANGED);
      if (session && !wasSignedIn) {
        void this.pullAndMerge();
      }
    });

    GameEvents.on(EVT_SAVE_CHANGED, () => this.scheduleSync());
  }

  /** Sends the magic link. Returns an error message, or null on success. */
  async signInWithEmail(email: string): Promise<string | null> {
    if (!this.client) return 'Cloud save is not configured.';
    const { error } = await this.client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    return error ? error.message : null;
  }

  /** Redirects to GitHub; the session lands when the browser returns. */
  async signInWithGitHub(): Promise<string | null> {
    if (!this.client) return 'Cloud save is not configured.';
    const { error } = await this.client.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: window.location.origin },
    });
    return error ? error.message : null;
  }

  async signOut(): Promise<void> {
    await this.client?.auth.signOut();
  }

  /**
   * On sign-in: fetch the cloud save and keep whichever side shows more
   * progress, then push the winner so both sides agree.
   */
  private async pullAndMerge(): Promise<void> {
    if (!this.client || !this.session) return;
    const { data: row, error } = await this.client
      .from(TABLE)
      .select('data')
      .eq('user_id', this.session.user.id)
      .maybeSingle();
    if (error) {
      console.warn('[CloudSave] pull failed:', error.message);
      return;
    }
    const cloud = row?.data as SaveData | undefined;
    if (cloud && progressScore(cloud) > progressScore(SaveManager.data)) {
      SaveManager.replaceData(cloud);
      GameEvents.emit(EVT_TOAST, 'Cloud save loaded — welcome back!');
    } else {
      GameEvents.emit(EVT_TOAST, 'Signed in — progress now saves online.');
      this.scheduleSync();
    }
  }

  private scheduleSync(): void {
    if (!this.client || !this.session) return;
    window.clearTimeout(this.syncTimer);
    this.syncTimer = window.setTimeout(() => void this.push(), SYNC_DEBOUNCE_MS);
  }

  private async push(): Promise<void> {
    if (!this.client || !this.session) return;
    const { error } = await this.client.from(TABLE).upsert({
      user_id: this.session.user.id,
      data: SaveManager.data,
      updated_at: new Date().toISOString(),
    });
    if (error) console.warn('[CloudSave] push failed:', error.message);
  }
}

/** Rough "how far along is this save" — higher wins the sign-in merge. */
function progressScore(d: SaveData): number {
  const nodes = Object.values(d.castleProgress ?? {})
    .flat()
    .filter(Boolean).length;
  return (
    d.enchantedSwords.length * 1000 +
    d.infinitySwords.length * 500 +
    nodes * 100 +
    d.ownedSkins.length * 50 +
    d.coins
  );
}

export const CloudSave = new CloudSaveImpl();
