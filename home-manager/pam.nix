{
  config,
  pkgs,
  lib,
  ...
}: let
  cfg = config.home.pam;
in {
  options.home.pam = {
    chkpwdPath = lib.mkOption {
      type = lib.types.nullOr lib.types.str;
      default = null;
      description = ''
        System path for the `unix_chkpwd` SUID binary.

        This option is required to be changed on non-NixOS systems:
        PAM depends on a working SUID binary in an hard-coded path
        which is not populated in non-NixOS systems.

        In ubuntu this is `/usr/sbin/unix_chkpwd`.
      '';
    };

    overridePackages = lib.mkOption {
      type = lib.types.listOf lib.types.str;
      default = ["i3lock" "i3lock-color" "xsecurelock"];
      description = ''
        Nixpkgs to override with the patched PAM.

        This option will setup an overlay providing the patched
        {pkgs}`linux-pam` to each specified package.
      '';
    };
  };

  config = lib.mkIf (cfg.chkpwdPath != null) (
    let
      overlay = self: super: let
        patch = pkgs.writeText "suid-wrapper-path.patch" ''
          It needs the SUID version during runtime, and that can't be in /nix/store/**
          --- a/modules/pam_unix/Makefile.am
          +++ b/modules/pam_unix/Makefile.am
          @@ -21 +21 @@
          -	-DCHKPWD_HELPER=\"$(sbindir)/unix_chkpwd\" \
          +	-DCHKPWD_HELPER=\"${cfg.chkpwdPath}\" \
        '';

        pam = super.linux-pam.overrideAttrs (old: {patches = [patch];});
      in
        lib.mergeAttrsList (lib.map (
            pkg: {"${pkg}" = super."${pkg}".override {inherit pam;};}
          )
          cfg.overridePackages);
    in {
      nixpkgs.overlays = [overlay];
    }
  );
}
