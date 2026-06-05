{ config, pkgs, inputs, lib, ... }:

{
    imports = [
      inputs.ags.homeManagerModules.default
      inputs.niri.homeModules.niri
    ];
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
      gtksourceview5
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
    libadwaita
    alsa-utils
    grim
    slurp
    satty
    loupe
    pavucontrol
    playerctl
    dart-sass
    sassc
    gnome-pomodoro
    swaynotificationcenter
    nautilus
    firefox
    # alacritty
    foot
    brightnessctl
    wl-clipboard 
    nwg-look
    nwg-displays
    endeavour
    evolution-data-server
    hypridle
    nodejs
    neovim
    xwayland-satellite 
    swww
    slack
    code-cursor
    cmake
    ninja
    powertop
    delta
    uwsm
    runapp
    hyprlock 
    nerd-fonts.fira-code
    SDL2
    libdecor
    (config.lib.nixGL.wrap pkgs.ghostty)
    (config.lib.nixGL.wrap pkgs.scrcpy)
    (pkgs.python312.withPackages (ps: with ps; [
      dbus-python
      pygobject3
    ]))
    zk
    tuigreet
    tree-sitter
    wf-recorder
    codex
  ];

  targets.genericLinux.enable = true;

  home.sessionVariables = {
    NIXOS_OZONE_WL = "1";
    ELECTRON_OZONE_PLATFORM_HINT = "auto";
  };


  home.file.".local/bin/rsynapse-ui" = {
    executable = true;
    text = ''
      #!${pkgs.runtimeShell}
      export GIO_EXTRA_MODULES="${pkgs.dconf.lib}/lib/gio/modules:''${GIO_EXTRA_MODULES:-}"
      export XDG_DATA_DIRS="${pkgs.gsettings-desktop-schemas}/share/gsettings-schemas/${pkgs.gsettings-desktop-schemas.name}:${pkgs.gtk4}/share/gsettings-schemas/${pkgs.gtk4.name}:''${XDG_DATA_DIRS:-/usr/local/share:/usr/share}"
      exec "${pkgs.glibc}/lib/ld-linux-x86-64.so.2" \
        --library-path "${pkgs.lib.makeLibraryPath (with pkgs; [
          libadwaita
          gtk4
          gtk4-layer-shell
          glib
          pango
          gdk-pixbuf
          cairo
          graphene
          harfbuzz
          fribidi
          appstream
          libepoxy
          wayland
          libxkbcommon
          vulkan-loader
          libglvnd
          glibc
        ])}" \
        "$HOME/proj/rsynapse/target/debug/rsynapse-ui" "$@"
    '';
  };


  home.activation.rsynapseLocalPlugins = lib.hm.dag.entryAfter [ "writeBoundary" ] ''
    plugin_dir="$HOME/.local/lib/rsynapse/plugins"
    source_dir="$HOME/proj/rsynapse/target/release"
    $DRY_RUN_CMD mkdir -p "$plugin_dir"
    for plugin in       librsynapse_plugin_calc.so       librsynapse_plugin_commands.so       librsynapse_plugin_launcher.so       librsynapse_plugin_shell.so
    do
      if [ -e "$source_dir/$plugin" ]; then
        $DRY_RUN_CMD ln -sfn "$source_dir/$plugin" "$plugin_dir/$plugin"
      fi
    done
  '';

  home.file.".local/bin/remarked-ui" = {
    executable = true;
    text = ''
      #!${pkgs.runtimeShell}
      export GIO_EXTRA_MODULES="${pkgs.dconf.lib}/lib/gio/modules:''${GIO_EXTRA_MODULES:-}"
      export XDG_DATA_DIRS="${pkgs.gsettings-desktop-schemas}/share/gsettings-schemas/${pkgs.gsettings-desktop-schemas.name}:${pkgs.gtk4}/share/gsettings-schemas/${pkgs.gtk4.name}:''${XDG_DATA_DIRS:-/usr/local/share:/usr/share}"
      exec "${pkgs.glibc}/lib/ld-linux-x86-64.so.2" \
        --library-path "${pkgs.lib.makeLibraryPath (with pkgs; [
          libadwaita
          gtk4
          gtk4-layer-shell
          vte-gtk4
          glib
          pango
          gdk-pixbuf
          cairo
          graphene
          harfbuzz
          fribidi
          appstream
          libepoxy
          wayland
          libxkbcommon
          vulkan-loader
          libglvnd
          glibc
        ])}" \
        "$HOME/proj/remarked/target/debug/remarked-ui" "$@"
    '';
  };
  
xdg.portal = {
  enable = true;
  extraPortals = with pkgs; [
    xdg-desktop-portal-gnome
    xdg-desktop-portal-gtk
    # Add any other portal you need, like xdg-desktop-portal-wlr
  ];
  config = {
    # Set the fallback portal order specifically for your Niri environment
    niri = {
      default = [ "gtk" "gnome" ];
    };
  };
};

  systemd.user.services.swaync = {
    Unit = {
      Description = "Swaync notification daemon";
      Documentation = [ "https://github.com/ErikReider/SwayNotificationCenter" ];
      PartOf = [ "graphical-session.target" ];
      After = [ "graphical-session.target" ];
      ConditionEnvironment = "WAYLAND_DISPLAY";
    };

    Service = {
      Type = "dbus";
      BusName = "org.freedesktop.Notifications";
      ExecStart = "${pkgs.swaynotificationcenter}/bin/swaync";
      ExecReload = "${pkgs.swaynotificationcenter}/bin/swaync-client --reload-config ; ${pkgs.swaynotificationcenter}/bin/swaync-client --reload-css";
      Restart = "on-failure";
    };

    Install.WantedBy = [ "graphical-session.target" ];
  };

  xdg.configFile = {
    "systemd/user/niri.service".source =
      "${config.programs.niri.package}/share/systemd/user/niri.service";
    "systemd/user/niri-shutdown.target".source =
      "${config.programs.niri.package}/share/systemd/user/niri-shutdown.target";
  };

  xdg.dataFile."wayland-sessions/uwsm-niri.desktop".text = ''
        [Desktop Entry]
        Name=Niri (UWSM)
        Comment=Niri session managed by UWSM
        Exec=${pkgs.uwsm}/bin/uwsm start -F -- niri --session
        Type=Application
        DesktopNames=Niri
  '';

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
}
