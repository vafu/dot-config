_final: prev:

let
  patchedPam = prev.linux-pam.overrideAttrs (_old: {
    # Replace upstream patch, this is fragile and may break in the future.
    # https://github.com/nix-community/home-manager/issues/7027
    postPatch = ''
      substituteInPlace modules/module-meson.build \
        --replace-fail "sbindir / 'unix_chkpwd'" "'/usr/sbin/unix_chkpwd'"
    '';
  });
in
{
  # Only hyprlock and its test helper use the patched PAM.
  hyprlock = prev.hyprlock.override { pam = patchedPam; };
  pamtester-hyprlock = prev.pamtester.override { pam = patchedPam; };
}
