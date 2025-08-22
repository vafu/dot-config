# ~/.config/nix-config/home.nix
{ config, lib, pkgs, nixGL, hyprland, ... }:

{
  # Set your home-manager state version
  home.stateVersion = "25.11";


  nixGL = {
    packages = nixGL.packages;
    defaultWrapper = "mesa";
  };

  programs.home-manager.enable = true;

  home.username = "vfuchedzhy";
  home.homeDirectory = "/home/vfuchedzhy/";
  home.packages = with pkgs; [
    alacritty
    wl-clipboard 

    # nwg-look # For setting GTK themes
    # (nerdfonts.override { fonts = [ "FiraCode" "JetBrainsMono" ]; })
  ];

  wayland.windowManager.hyprland.extraConfig = 
      builtins.readFile     /home/vfuchedzhy/.config/hypr/niximport.conf;
  wayland.windowManager.hyprland = {
    enable = true;
    package = config.lib.nixGL.wrap pkgs.hyprland;

  };
}
