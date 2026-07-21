import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScreenHeader, Avatar } from "@/components/ui-bits";
import { toast } from "sonner";
import { ArrowLeft, UserPlus, Trash2, Crown, Shield, User as UserIcon, LogOut, Mail } from "lucide-react";

type Role = "owner" | "admin" | "member";

export const Route = createFileRoute("/_authenticated/team/$id")({
  component: TeamDetail,
});

function TeamDetail() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState("");

  const { data: team, isLoading } = useQuery({
    queryKey: ["team", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id,name,created_by,created_at")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: members } = useQuery({
    queryKey: ["team-members", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("id,user_id,role,joined_at")
        .eq("team_id", id)
        .order("joined_at", { ascending: true });
      if (error) throw error;
      if (!data?.length) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,display_name,email,avatar_url")
        .in("id", data.map((m) => m.user_id));
      return data.map((m) => ({
        ...m,
        profile: profs?.find((p) => p.id === m.user_id) ?? null,
      }));
    },
  });

  const { data: invites } = useQuery({
    queryKey: ["team-invites", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_invites")
        .select("id,email,role,status,created_at")
        .eq("team_id", id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <div className="p-8 text-center text-ink/50 text-sm">Loading…</div>;
  }
  if (!team) {
    return (
      <div className="p-8 text-center">
        <p className="text-ink/60">Team not found.</p>
        <button onClick={() => navigate({ to: "/settings" })} className="mt-3 text-clay text-sm">
          Back to settings
        </button>
      </div>
    );
  }

  const myRole = (members?.find((m) => m.user_id === user.id)?.role ?? "member") as Role;
  const canAdmin = myRole === "owner" || myRole === "admin";
  const isOwner = myRole === "owner";

  async function invite() {
    const trimmed = inviteEmail.trim().toLowerCase();
    if (!trimmed) return;
    setInviting(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id,email")
        .ilike("email", trimmed)
        .maybeSingle();

      if (profile) {
        if (profile.id === user.id) {
          toast.info("You're already in this team");
        } else {
          const { error } = await supabase
            .from("team_members")
            .insert({ team_id: id, user_id: profile.id, role: "member" });
          if (error) {
            if (error.code === "23505") toast.info("They're already a member");
            else throw error;
          } else {
            toast.success("Added to team");
          }
        }
      } else {
        const { error } = await supabase
          .from("team_invites")
          .insert({ team_id: id, email: trimmed, role: "member", invited_by: user.id });
        if (error) {
          if (error.code === "23505") toast.info("Already invited");
          else throw error;
        } else {
          toast.success("Invite saved — they'll join on sign-up");
        }
      }
      setInviteEmail("");
      qc.invalidateQueries({ queryKey: ["team-members", id] });
      qc.invalidateQueries({ queryKey: ["team-invites", id] });
    } catch (err: any) {
      toast.error(err.message ?? "Invite failed");
    } finally {
      setInviting(false);
    }
  }

  async function removeMember(memberId: string, isMe: boolean) {
    if (!confirm(isMe ? "Leave this team?" : "Remove this member?")) return;
    const { error } = await supabase.from("team_members").delete().eq("id", memberId);
    if (error) return toast.error(error.message);
    toast.success(isMe ? "Left team" : "Removed");
    if (isMe) navigate({ to: "/settings" });
    else qc.invalidateQueries({ queryKey: ["team-members", id] });
  }

  async function changeRole(memberId: string, role: Role) {
    const { error } = await supabase.from("team_members").update({ role }).eq("id", memberId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["team-members", id] });
  }

  async function revokeInvite(inviteId: string) {
    const { error } = await supabase.from("team_invites").delete().eq("id", inviteId);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["team-invites", id] });
  }

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === team!.name) {
      setEditingName(false);
      return;
    }
    const { error } = await supabase.from("teams").update({ name: trimmed }).eq("id", id);
    if (error) return toast.error(error.message);
    setEditingName(false);
    qc.invalidateQueries({ queryKey: ["team", id] });
    qc.invalidateQueries({ queryKey: ["my-teams"] });
  }

  async function deleteTeam() {
    if (!confirm(`Delete "${team!.name}"? This can't be undone.`)) return;
    const { error } = await supabase.from("teams").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Team deleted");
    qc.invalidateQueries({ queryKey: ["my-teams"] });
    navigate({ to: "/settings" });
  }

  return (
    <div>
      <div className="pt-10 px-6 pb-2 flex items-center gap-3">
        <button
          onClick={() => navigate({ to: "/settings" })}
          className="size-9 rounded-full bg-creme grid place-items-center ring-1 ring-black/5"
          aria-label="Back"
        >
          <ArrowLeft size={16} strokeWidth={1.75} />
        </button>
      </div>

      <div className="px-6 mb-6">
        <p className="text-[10px] uppercase tracking-widest text-ink/50 mb-2">Team</p>
        {editingName ? (
          <div className="flex gap-2">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => e.key === "Enter" && saveName()}
              className="flex-1 font-serif text-3xl bg-transparent border-b border-ink/20 focus:outline-none focus:border-clay"
            />
          </div>
        ) : (
          <button
            onClick={() => {
              if (!isOwner) return;
              setName(team.name);
              setEditingName(true);
            }}
            className="text-left font-serif text-3xl leading-tight"
          >
            {team.name}
          </button>
        )}
        <p className="text-xs text-ink/50 mt-2">
          {members?.length ?? 0} member{(members?.length ?? 0) === 1 ? "" : "s"}
          {isOwner && " · Tap name to rename"}
        </p>
      </div>

      {canAdmin && (
        <div className="px-6 mb-6">
          <p className="text-[10px] uppercase tracking-widest text-ink/50 mb-3">Invite</p>
          <div className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && invite()}
              placeholder="friend@example.com"
              className="flex-1 rounded-full border border-ink/10 bg-card px-4 py-3 text-sm placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-clay/20"
            />
            <button
              onClick={invite}
              disabled={inviting || !inviteEmail.trim()}
              className="rounded-full bg-clay text-paper px-4 text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
            >
              <UserPlus size={14} strokeWidth={1.75} /> Invite
            </button>
          </div>
          <p className="text-[11px] text-ink/50 mt-2 px-1">
            Existing users join immediately. New emails become pending invites — they'll auto-join when they sign up.
          </p>
        </div>
      )}

      <div className="px-6 mb-6">
        <p className="text-[10px] uppercase tracking-widest text-ink/50 mb-3">Members</p>
        <div className="divide-y divide-ink/5 rounded-[18px] bg-card ring-1 ring-black/5 overflow-hidden">
          {members?.map((m) => {
            const isMe = m.user_id === user.id;
            const dn = m.profile?.display_name ?? m.profile?.email ?? "Cook";
            return (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={dn} className="size-10" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate leading-tight">
                    {dn} {isMe && <span className="text-ink/40 text-xs">(you)</span>}
                  </p>
                  <p className="text-[11px] text-ink/50 truncate">{m.profile?.email}</p>
                </div>
                <RoleBadge role={m.role as Role} />
                {canAdmin && m.role !== "owner" && !isMe && (
                  <div className="flex gap-1">
                    <button
                      onClick={() =>
                        changeRole(m.id, m.role === "admin" ? "member" : "admin")
                      }
                      className="text-[11px] text-clay font-medium"
                    >
                      {m.role === "admin" ? "Demote" : "Promote"}
                    </button>
                    <button
                      onClick={() => removeMember(m.id, false)}
                      className="size-7 rounded-full grid place-items-center text-ink/40 hover:text-ink"
                      aria-label="Remove"
                    >
                      <Trash2 size={13} strokeWidth={1.75} />
                    </button>
                  </div>
                )}
                {isMe && !isOwner && (
                  <button
                    onClick={() => removeMember(m.id, true)}
                    className="text-[11px] text-ink/50 flex items-center gap-1"
                  >
                    <LogOut size={12} /> Leave
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {canAdmin && invites && invites.length > 0 && (
        <div className="px-6 mb-6">
          <p className="text-[10px] uppercase tracking-widest text-ink/50 mb-3">
            Pending invites
          </p>
          <div className="divide-y divide-ink/5 rounded-[18px] bg-card ring-1 ring-black/5 overflow-hidden">
            {invites.map((iv) => (
              <div key={iv.id} className="flex items-center gap-3 px-4 py-3">
                <div className="size-9 rounded-full bg-creme grid place-items-center text-ink/60">
                  <Mail size={15} strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{iv.email}</p>
                  <p className="text-[11px] text-ink/50">Waiting for sign-up</p>
                </div>
                <button
                  onClick={() => revokeInvite(iv.id)}
                  className="text-[11px] text-ink/50"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {isOwner && (
        <div className="px-6 mb-10">
          <button
            onClick={deleteTeam}
            className="w-full flex items-center justify-center gap-2 rounded-full border border-red-200 py-3.5 text-sm font-medium text-red-500/90"
          >
            <Trash2 size={14} strokeWidth={1.75} /> Delete team
          </button>
        </div>
      )}
    </div>
  );
}

function RoleBadge({ role }: { role: Role }) {
  const map = {
    owner: { icon: <Crown size={11} />, label: "Owner", cls: "bg-clay/15 text-clay" },
    admin: { icon: <Shield size={11} />, label: "Admin", cls: "bg-moss/15 text-moss" },
    member: { icon: <UserIcon size={11} />, label: "Member", cls: "bg-ink/5 text-ink/60" },
  }[role];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${map.cls}`}>
      {map.icon}
      {map.label}
    </span>
  );
}
