## Teams feature — design

### Data model (new tables)

- **teams** — `id`, `name`, `created_by`, timestamps.
- **team_members** — `team_id`, `user_id`, `role` (`owner` | `admin` | `member`), `joined_at`. Unique on (team_id, user_id).
- **team_invites** — `team_id`, `email` (lowercased), `role`, `invited_by`, `token`, `status` (`pending` | `accepted` | `revoked`), `created_at`. Used for inviting people who aren't signed up yet, and also for in-app "invite existing user" (we resolve email → user on accept).
- **recipe_team_shares** — `recipe_id`, `team_id`, `shared_by`, `created_at`. Parallel to existing `recipe_shares` (which stays for person-to-person).
- **recipe_comments** — `id`, `recipe_id`, `author_id`, `body`, `created_at`. Members can comment on any recipe they can see.

Enum `team_role` with values `owner`, `admin`, `member`.

### Permissions (RLS summary)

- Membership check via a `SECURITY DEFINER` helper `is_team_member(_team, _user)` / `team_role_of(_team, _user)` to avoid recursive RLS.
- **teams**: readable if you're a member; created by anyone (creator becomes owner via trigger); update/delete owner-only.
- **team_members**: readable by team members; insert/delete by owners/admins; a member can delete their own row (leave).
- **team_invites**: readable by team owners/admins and by anyone matching the invited email; insert owners/admins; accept updates status.
- **recipe_team_shares**: recipe owner can insert/delete; team members can read.
- **recipes SELECT**: extend policy so team members of any team the recipe is shared to can read.
- **recipe_comments**: readable and insertable by anyone who can read the recipe; delete own or by recipe owner.

Editing team recipes: recipe UPDATE policy extended so team `owner`/`admin` of a team the recipe is shared to can also update it. Regular members stay read-only but can comment.

### Invite flow

- **Existing user**: in the invite UI, type email → if a profile exists, add directly to `team_members`. If not, fall through to email invite.
- **New user**: create a `team_invites` row. On sign-up (or first sign-in), a server function looks up pending invites by email and either auto-joins them or shows a "Join {team}" prompt on Home.
- Actual invite email delivery is out of scope for v1 — the invite is redeemable in-app the moment they sign up. We can wire auth-scaffolded emails later.

### Screens

1. **Settings → Teams card** with the "Create your first team" empty state, then a list of teams you belong to.
2. **/teams/$id** (new route under `_authenticated/`): team name (editable by owner), member list with roles, invite input, pending invites list, "Leave team" / "Delete team".
3. **Recipe share modal** (existing on `recipe.$id`): add a **Teams tab** next to People. Lists your teams with a share toggle per team.
4. **Recipe detail**: add a **Comments** section (list + add form) visible whenever you can see the recipe.
5. **Home / Recipes → Shared with me**: query updated to union person-shares and team-shares. Add a small badge showing which team a shared recipe came from.

### Implementation order

1. Migration: enum, tables, GRANTs, helper functions, RLS, `handle_new_team` trigger (creator → owner member), `accept_pending_invites` on sign-up.
2. Server functions: `createTeam`, `inviteToTeam` (resolves email → user or creates invite), `acceptInvite`, `removeMember`, `updateMemberRole`, `leaveTeam`, `deleteTeam`, `shareRecipeToTeam`, `unshareRecipeFromTeam`, `addComment`.
3. Routes: `/settings` gets a Teams section; new `/teams` (list) and `/teams/$id` (detail).
4. Update Share modal on `recipe.$id` with Teams tab.
5. Update "Shared with me" queries on Home + Recipes to include team shares.
6. Add Comments block on recipe detail.

### Tech notes

- All list queries use RLS-safe joins; no client-side privilege checks.
- Reuse the "Kitchen table" design tokens; team detail follows the same editorial header + card list pattern as Settings.
- Comments are plain text (no attachments) to keep v1 tight.
