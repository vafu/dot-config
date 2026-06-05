{
  imports = [
    ./modules/apps/slack.nix
    ./modules/core.nix
    ./modules/desktop/ags.nix
    ./modules/desktop/niri.nix
    ./modules/desktop/portals.nix
    ./modules/dev/local-gui-wrappers.nix
    ./modules/services/swaync.nix
  ];
}
