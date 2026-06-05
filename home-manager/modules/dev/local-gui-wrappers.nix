{ lib, pkgs, ... }:

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

  mkDebugGtkWrapper =
    {
      target,
      extraLibraries ? [ ],
    }:
    {
      executable = true;
      text = ''
        #!${pkgs.runtimeShell}
        export GIO_EXTRA_MODULES="${pkgs.dconf.lib}/lib/gio/modules:''${GIO_EXTRA_MODULES:-}"
        export XDG_DATA_DIRS="${pkgs.gsettings-desktop-schemas}/share/gsettings-schemas/${pkgs.gsettings-desktop-schemas.name}:${pkgs.gtk4}/share/gsettings-schemas/${pkgs.gtk4.name}:''${XDG_DATA_DIRS:-/usr/local/share:/usr/share}"

        exec "${pkgs.glibc}/lib/ld-linux-x86-64.so.2" \
          --library-path "${pkgs.lib.makeLibraryPath (gtkRuntimeLibraries ++ extraLibraries)}" \
          "${target}" "$@"
      '';
    };
in
{
  home.file = {
    ".local/bin/remarked-ui" = mkDebugGtkWrapper {
      target = "$HOME/proj/remarked/target/debug/remarked-ui";
      extraLibraries = with pkgs; [ vte-gtk4 ];
    };

    ".local/bin/rsynapse-ui" = mkDebugGtkWrapper {
      target = "$HOME/proj/rsynapse/target/debug/rsynapse-ui";
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
}
