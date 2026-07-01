{
  config,
  inputs,
  pkgs,
  username,
  ...
}:

{
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
      codex
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
