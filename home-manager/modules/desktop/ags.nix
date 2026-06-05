{ inputs, pkgs, ... }:

{
  imports = [ inputs.ags.homeManagerModules.default ];

  programs.ags = {
    enable = true;

    extraPackages = with pkgs; [
      astal.apps
      astal.astal4
      astal.battery
      astal.bluetooth
      astal.hyprland
      astal.mpris
      astal.network
      astal.powerprofiles
      astal.tray
      astal.wireplumber
      glib-networking
      gtksourceview5
      inputs.astal.packages.${pkgs.stdenv.hostPlatform.system}.niri
      libadwaita
      networkmanager
    ];
  };
}
