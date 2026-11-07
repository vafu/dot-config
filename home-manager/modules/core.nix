{
  config,
  inputs,
  pkgs,
  pkgsCodex,
  username,
  ...
}:
let
  gstPluginPath = pkgs.lib.makeSearchPath "lib/gstreamer-1.0" [
    pkgs.gst_all_1.gstreamer
    pkgs.gst_all_1.gst-plugins-base
    pkgs.gst_all_1.gst-plugins-good
    pkgs.gst_all_1.gst-plugins-bad
    pkgs.gst_all_1.gst-libav
  ];

  sone = pkgs.sone.overrideAttrs (old: {
    preFixup = (old.preFixup or "") + ''
      gappsWrapperArgs+=(--set GST_PLUGIN_PATH_1_0 "${gstPluginPath}")
    '';
  });
in
{
  imports = [ inputs.kcd.homeManagerModules.default ];

  fonts.fontconfig.enable = true;

  home = {
    inherit username;

    homeDirectory = "/home/${username}";
    stateVersion = "25.11";

    packages = with pkgs; [
      SDL2
      alsa-utils
      brightnessctl
      cage
      cmake
      code-cursor
      pkgsCodex.codex
      dart-sass
      delta
      endeavour
      evolution-data-server
      firefox
      librewolf
      foot
      glib
      gnome-pomodoro
      grim
      gsettings-desktop-schemas
      hypridle
      hyprlock
      ibus
      libadwaita
      libdecor
      loupe
      nautilus
      neovim
      nerd-fonts._0xproto
      nerd-fonts.fira-code
      ninja
      nodejs
      nwg-displays
      nwg-look
      pamtester-hyprlock
      pavucontrol
      playerctl
      powertop
      runapp
      sassc
      satty
      slack
sone
      slurp
      swaynotificationcenter
      awww
      tree-sitter
      tuigreet
      udiskie
      uwsm
      wf-recorder
      wl-clipboard
      xwayland-satellite
      zk
      ripgrep
      triggerhappy
      (config.lib.nixGL.wrap pkgs.ghostty)
      (config.lib.nixGL.wrap pkgs.scrcpy)
      pandoc
      openscad
      ncdu
      ghidra
      databricks-cli
      jadx
      iotop-c
      opencode
      tailscale
      high-tide

      (python312.withPackages (
        ps: with ps; [
          dbus-python
          pygobject3
        ]
      ))
    ];

    sessionVariables = {
      ELECTRON_OZONE_PLATFORM_HINT = "auto";
      NIXOS_OZONE_WL = "1";
      XCURSOR_PATH = "${config.home.homeDirectory}/.icons:${config.home.homeDirectory}/.local/share/icons:/usr/share/icons";
    };
  };

  services.kcd.enable = true;

  programs.home-manager.enable = true;

  systemd.user.startServices = "suggest";

  targets.genericLinux = {
    enable = true;

    nixGL = {
      packages = inputs.nixGL.packages;
      defaultWrapper = "mesa";
      installScripts = [ "mesa" ];
    };
  };
}
