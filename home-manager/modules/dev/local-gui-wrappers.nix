{
  config,
  lib,
  pkgs,
  ...
}:

let
  gtkRuntimeLibraries = with pkgs; [
    appstream
    cairo
    fribidi
    gdk-pixbuf
    glib
    glibc
    graphene
    gtk4
    gtk4-layer-shell
    harfbuzz
    libadwaita
    libepoxy
    libglvnd
    libxkbcommon
    pango
    vulkan-loader
    wayland
  ];

  mkDebugWrapper =
    {
      target,
      runtimeLibraries ? [ pkgs.glibc ],
      extraPath ? [ ],
      extraEnv ? "",
    }:
    {
      executable = true;
      text = ''
        #!${pkgs.runtimeShell}
        ${extraEnv}
        ${lib.optionalString (extraPath != [ ]) ''
          export PATH="${lib.makeBinPath extraPath}:''${PATH:-/usr/local/bin:/usr/bin:/bin}"
        ''}

        exec "${pkgs.glibc}/lib/ld-linux-x86-64.so.2" \
          --library-path "${pkgs.lib.makeLibraryPath runtimeLibraries}" \
          "${target}" "$@"
      '';
    };

  mkDebugGtkWrapper =
    {
      target,
      extraLibraries ? [ ],
      extraPath ? [ ],
      extraEnv ? "",
    }:
    mkDebugWrapper {
      inherit target extraPath;
      runtimeLibraries = gtkRuntimeLibraries ++ extraLibraries;
      extraEnv = ''
        export GIO_EXTRA_MODULES="${pkgs.dconf.lib}/lib/gio/modules:''${GIO_EXTRA_MODULES:-}"
        export XDG_DATA_DIRS="${pkgs.gsettings-desktop-schemas}/share/gsettings-schemas/${pkgs.gsettings-desktop-schemas.name}:${pkgs.gtk4}/share/gsettings-schemas/${pkgs.gtk4.name}:''${XDG_DATA_DIRS:-/usr/local/share:/usr/share}"
        ${extraEnv}
      '';
    };
in
{
  xdg.configFile."gtk-4.0/gtk.css" = {
    force = true;
    text = ''
      @import "accent-color.css";
      @import "gtk4.css";
    '';
  };

  xdg.configFile."gtk-4.0/gtk-dark.css" = {
    force = true;
    text = ''
      @import "accent-color.css";
      @import "gtk4.css";
    '';
  };

  home.file = {
    ".local/bin/remarked-ui" = mkDebugGtkWrapper {
      target = "$HOME/proj/remarked/target/debug/remarked-ui";
      extraLibraries = with pkgs; [ vte-gtk4 ];
    };

    ".local/bin/rsynapse-ui" = mkDebugGtkWrapper {
      target = "$HOME/proj/rsynapse/target/debug/rsynapse-ui";
    };

    ".local/bin/locusfs" = mkDebugWrapper {
      target = "$HOME/proj/locusfs/target/release/locusfs";
      runtimeLibraries = with pkgs; [
        fuse3
        glibc
        stdenv.cc.cc.lib
      ];
      extraPath = with pkgs; [
        pulseaudio
      ];
    };

    ".local/bin/rsynapse-shell" = mkDebugGtkWrapper {
      target = "$HOME/proj/locus-shell/target/release/rsynapse-shell";
      extraPath = with pkgs; [ dart-sass ];
      extraEnv = ''
        export LOCUS_SHELL_SASS="${pkgs.dart-sass}/bin/sass"
      '';
    };
  };

  xdg.configFile."locusfs/config.toml".source =
    "${config.home.homeDirectory}/proj/locus-shell/rsynapse-shell/config/locusfs/config.toml";

  xdg.configFile."gtk-4.0/gtk4.css".source =
    "${config.home.homeDirectory}/proj/adw-gtk3/build/src/theme-dark/gtk4.css";

  xdg.configFile."gtk-4.0/accent-color.css".text = ''
    @define-color accent_bg_color #98BB6C;
  '';

  xdg.configFile."gtk-4.0/libadwaita.css".source =
    "${config.home.homeDirectory}/.local/share/themes/kanso-dark/gtk-4.0/libadwaita.css";

  xdg.configFile."gtk-4.0/libadwaita-tweaks.css".source =
    "${config.home.homeDirectory}/.local/share/themes/kanso-dark/gtk-4.0/libadwaita-tweaks.css";

  xdg.dataFile."themes/kanso-dark/gtk-4.0/gtk.css" = {
    force = true;
    text = ''
      @import "accent-color.css";
      @import "gtk4.css";
    '';
  };

  xdg.dataFile."themes/kanso-dark/gtk-4.0/gtk-dark.css" = {
    force = true;
    text = ''
      @import "accent-color.css";
      @import "gtk4.css";
    '';
  };

  xdg.dataFile."themes/kanso-dark/gtk-4.0/accent-color.css" = {
    force = true;
    text = ''
      @define-color accent_bg_color #98BB6C;
    '';
  };

  systemd.user.services = {
    locusfs = {
      Unit = {
        Description = "LocusFS graph filesystem";
        After = [ "graphical-session.target" ];
      };

      Service = {
        Type = "simple";
        ExecStartPre = "${pkgs.coreutils}/bin/mkdir -p %t/locusfs";
        ExecStart = "%h/.local/bin/locusfs --config %h/.config/locusfs/config.toml %t/locusfs";
        ExecStopPost = "-/usr/bin/fusermount3 -u -z %t/locusfs";
        Restart = "on-failure";
        RestartSec = 2;
      };

      Install.WantedBy = [ "default.target" ];
    };

    rsynapse-shell = {
      Unit = {
        Description = "Rsynapse Shell";
        After = [
          "graphical-session.target"
          "locusfs.service"
        ];
        Wants = [ "locusfs.service" ];
      };

      Service = {
        Type = "simple";
        Environment = [ "LOCUS_ROOT=%t/locusfs" ];
        ExecStartPre = "${pkgs.runtimeShell} -c 'for _ in $(${pkgs.coreutils}/bin/seq 1 100); do ${pkgs.util-linux}/bin/mountpoint -q %t/locusfs && exit 0; ${pkgs.coreutils}/bin/sleep 0.1; done; exit 1'";
        ExecStart = "%h/.local/bin/rsynapse-shell";
        Restart = "on-failure";
        RestartSec = 2;
      };

      Install.WantedBy = [ "default.target" ];
    };
  };

  home.activation.rsynapseLocalPlugins = lib.hm.dag.entryAfter [ "writeBoundary" ] ''
    plugin_dir="$HOME/.local/lib/rsynapse/plugins"
    source_dir="$HOME/proj/rsynapse/target/release"

    $DRY_RUN_CMD mkdir -p "$plugin_dir"

    for plugin in \
      librsynapse_plugin_calc.so \
      librsynapse_plugin_commands.so \
      librsynapse_plugin_launcher.so \
      librsynapse_plugin_shell.so
    do
      if [ -e "$source_dir/$plugin" ]; then
        $DRY_RUN_CMD ln -sfn "$source_dir/$plugin" "$plugin_dir/$plugin"
      fi
    done
  '';

  home.activation.locusFsLocalPlugins = lib.hm.dag.entryAfter [ "writeBoundary" ] ''
    plugin_dir="$HOME/.local/lib/locusfs/plugins"
    source_dir="$HOME/proj/locusfs/target/release"

    $DRY_RUN_CMD mkdir -p "$plugin_dir"

    for plugin in \
      liblocusfs_plugin_dbus.so \
      liblocusfs_plugin_dbusmenu.so \
      liblocusfs_plugin_mpris.so \
      liblocusfs_plugin_niri.so \
      liblocusfs_plugin_pipewire.so \
      liblocusfs_plugin_project.so \
      liblocusfs_plugin_statusnotifier.so
    do
      if [ -e "$source_dir/$plugin" ]; then
        $DRY_RUN_CMD ln -sfn "$source_dir/$plugin" "$plugin_dir/$plugin"
      fi
    done
  '';
}
