{ config, pkgs, inputs, ... }:
let
  # 1. Create the wrapper script that sets up the environment
  niri-wrapper = pkgs.writeShellApplication {
    name = "niri-wm-wrapper";
    runtimeInputs = [
      inputs.nixGL.packages.${pkgs.system}.nixGLDefault
    ];
    text = ''
      # Set GBM path for mesa
      export GBM_BACKENDS_PATH="${pkgs.mesa}/lib/gbm"

      # Run the real niri-session binary, but using the nixGL wrapper
      nixGL ${config.programs.niri.package}/bin/niri-session
    '';
  };
in
{
    imports = [
      inputs.ags.homeManagerModules.default
      inputs.niri.homeModules.niri
    ];
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
  nixGL = {
    packages = inputs.nixGL.packages;
    defaultWrapper = "mesa";
    installScripts = [ "mesa" ];
  };
  programs.ags = {
    enable = true;
    extraPackages = with pkgs; [
      glib-networking
      libadwaita
      astal.astal4
      astal.hyprland
      astal.network
      astal.battery
      astal.powerprofiles
      astal.wireplumber
      astal.tray
      astal.bluetooth
      astal.mpris
      astal.apps
      inputs.astal.packages.${pkgs.system}.niri
      networkmanager
    ];
  };
  programs.home-manager.enable = true;
  home.username = "vfuchedzhy";
  home.homeDirectory = "/home/vfuchedzhy/";
  home.packages = with pkgs; [
    ibus
    gsettings-desktop-schemas
    glib
    udiskie
    hyprlock
    libadwaita
    alsa-utils
    grim
    slurp
    satty
    loupe
    pavucontrol
    playerctl
    dart-sass
    gnome-pomodoro
    swaynotificationcenter
    nautilus
    firefox
    alacritty
    brightnessctl
    wl-clipboard 
    nwg-look
    nwg-displays
    hyprpaper
    endeavour
    evolution-data-server
    hypridle
    nodejs
    neovim
    ghostty
    mako
    xwayland-satellite 
    swww
    slack
  ];

  home.sessionVariables = {
    NIXOS_OZONE_WL = "1";
    ELECTRON_OZONE_PLATFORM_HINT = "auto";
  };

  xdg.desktopEntries."slack" = {
    # This must match the original .desktop file name
    name = "Slack";
    comment = "Slack Desktop";
    genericName = "Slack Client for Linux";
    
    exec = "slack --enable-features=UseOzonePlatform --ozone-platform=wayland %U";
    
    icon = "slack";
    type = "Application";
    startupNotify = true;
    categories = [ "Network" "InstantMessaging" ];
    mimeType = [ "x-scheme-handler/slack" ];
  };

  xdg.mimeApps.defaultApplications = {
    "x-scheme-handler/slack" = "slack.desktop";
  };

  programs.niri = {
    enable = true;
    package = config.lib.nixGL.wrap pkgs.niri;
  };

  
  wayland.windowManager.hyprland = 
  {
      enable = true;
      package = config.lib.nixGL.wrap inputs.hyprland.packages.${pkgs.stdenv.hostPlatform.system}.hyprland;
      extraConfig = builtins.readFile /home/vfuchedzhy/.config/hypr/niximport.conf;
      systemd.variables = ["--all"];
      plugins = with inputs; [ 
        hyprland-plugins.packages.${pkgs.system}.hyprscrolling 
        hypr-dynamic-cursors.packages.${pkgs.system}.hypr-dynamic-cursors 
        hyprWorkspaceLayouts.packages.${pkgs.system}.default 
      ];
  };
}
