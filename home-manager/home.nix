# ~/.config/nix-config/home.nix
{ config, lib, pkgs, nixGL, hyprland, ags, ... }:

{
  # Set your home-manager state version
  home.stateVersion = "25.11";
  imports = [ ags.homeManagerModules.default ];


  nixGL = {
    packages = nixGL.packages;
    defaultWrapper = "mesa";
  };

  programs.ags = {
    enable = true;
    extraPackages = with pkgs; [
      libadwaita
      astal.hyprland
      astal.network
      astal.battery
      astal.powerprofiles
      astal.wireplumber
      astal.tray
      astal.bluetooth
      networkmanager
    ];
  };
  programs.home-manager.enable = true;

  home.username = "vfuchedzhy";
  home.homeDirectory = "/home/vfuchedzhy/";
  home.packages = with pkgs; [
    (config.lib.nixGL.wrap alacritty)
    brightnessctl
    wl-clipboard 
    nwg-look
    nwg-displays
  ];

  wayland.windowManager.hyprland.extraConfig = 
      builtins.readFile     /home/vfuchedzhy/.config/hypr/niximport.conf;
  wayland.windowManager.hyprland = {
    enable = true;
    package = config.lib.nixGL.wrap pkgs.hyprland;

  };
}
