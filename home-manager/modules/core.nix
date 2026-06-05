{
  config,
  inputs,
  pkgs,
  username,
  ...
}:

{
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

      (config.lib.nixGL.wrap pkgs.ghostty)
      (config.lib.nixGL.wrap pkgs.scrcpy)

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
    };
  };

  programs.home-manager.enable = true;

  targets.genericLinux = {
    enable = true;

    nixGL = {
      packages = inputs.nixGL.packages;
      defaultWrapper = "mesa";
      installScripts = [ "mesa" ];
    };
  };
}
