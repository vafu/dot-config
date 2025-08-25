# ~/.config/nix-config/home.nix
{ config, lib, pkgs, nixGL, hyprland, ags, ... }:
{
    nixpkgs.overlays = [
    (final: prev: {
      libadwaita = prev.libadwaita.overrideAttrs (oldAttrs: {
        # The name of the new derivation (optional, but good practice)
        pname = "${oldAttrs.pname}-without-adwaita";
        doCheck = false;

        # Add the theming_patch.diff to the list of existing patches
        patches = (oldAttrs.patches or []) ++ [
          (final.fetchpatch {
            # Using the direct AUR cgit link you provided.
            url = "https://aur.archlinux.org/cgit/aur.git/plain/theming_patch.diff?h=libadwaita-without-adwaita-git";
            
            # The correct hash for the patch file from that URL.
            hash = "sha256-3fQ0coWIK00FEngdAp97Cnd0PvHmBoFCxr7gb+AKpgQ=";
          })
        ];
      });
    })
  ];

  # Set your home-manager state version
  home.stateVersion = "25.11";
  imports = [ 
    ags.homeManagerModules.default
  ];

  nixGL = {
    packages = nixGL.packages;
    defaultWrapper = "mesa";
    installScripts = [ "mesa" ];
  };

  programs.ags = {
    enable = true;
    extraPackages = with pkgs; [
      cachix
      libadwaita
      astal.astal4
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
    dart-sass
    nautilus
    libadwaita
    firefox
    glfw-wayland
    alacritty
    brightnessctl
    wl-clipboard 
    nwg-look
    nwg-displays
  ];

  wayland.windowManager.hyprland = 
  {
    enable = true;
    package = config.lib.nixGL.wrap pkgs.hyprland;
    extraConfig = builtins.readFile /home/vfuchedzhy/.config/hypr/niximport.conf;
    systemd.variables = ["--all"];
  };
}
