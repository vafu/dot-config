_final: prev:

let
  patchedPam = prev.linux-pam.overrideAttrs (_old: {
    # Replace upstream patch, this is fragile and may break in the future.
    # https://github.com/nix-community/home-manager/issues/7027
    postPatch = ''
      substituteInPlace modules/module-meson.build         --replace-fail "sbindir / 'unix_chkpwd'" "'/usr/sbin/unix_chkpwd'"
    '';
  });
in
{
  # Only hyprlock uses the patched PAM; the rest of pkgs remain unchanged.
  hyprlock = prev.hyprlock.override { pam = patchedPam; };
}
