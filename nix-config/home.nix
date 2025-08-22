# ~/.config/nix-config/home.nix
{ config, pkgs, ... }:

{
  # Set your home-manager state version
  home.stateVersion = "23.11";

  # Let home-manager manage itself
  programs.home-manager.enable = true;

  home.packages = with pkgs; [
    nixgl.nixGLIntel
    alacritty
    swaync
    swaylock # Screen locker
    wlogout  # Logout menu
    wl-clipboard # Wayland clipboard utilities

    nwg-look # For setting GTK themes
    noto-fonts
    noto-fonts-cjk
    noto-fonts-emoji
    (nerdfonts.override { fonts = [ "FiraCode" "JetBrainsMono" ]; })
  ];

  wayland.windowManager.hyprland = {
    enable = true;
    # Use this to install plugins if you need them
    # plugins = [ ];
    # Use this for extra packages available only to Hyprland
    # extraConfig = ''
    #  # some extra config
    # '';
  };

  # Link your existing configuration files
  # This is the declarative "Nix way" to manage your dotfiles
  xdg.configFile = {
    "hypr".source = "${config.home.homeDirectory}/.config/hypr";
    "ags".source = "${config.home.homeDirectory}/.config/ags";
  };

  # Set needed environment variables
  home.sessionVariables = {
    NIXOS_OZONE_WL = "1"; # For electron apps to use Wayland
  };
}
