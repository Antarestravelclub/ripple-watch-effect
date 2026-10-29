<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Admin pages share AdminEntry; privileged admin functions require requireAdminAccess and direct admin table policies require has_admin_access so bypassing the entry screen cannot bypass the code. Unlocks are bound to the authenticated session, expire after 30 minutes, and PIN checks use database bcrypt with a five-attempt/15-minute lockout.
