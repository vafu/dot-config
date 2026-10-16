{
  config,
  inputs,
  pkgs,
  ...
}:

let
  system = pkgs.stdenv.hostPlatform.system;
  umbriel = config.programs.umbriel.package;
in
{
  imports = [ inputs.umbriel.homeModules.default ];

  programs.umbriel = {
    enable = true;
    package = config.lib.nixGL.wrap inputs.umbriel.packages.${system}.default;
    # Leave settings unset: ~/.config/umbriel/config.toml is edited directly.
  };

  # Home Manager's upstream module only installs the package. Expose the native
  # session's units so start-umbriel can manage the compositor on generic Linux.
  xdg.configFile = {
    "systemd/user/umbriel.service".source = "${umbriel}/share/systemd/user/umbriel.service";
    "systemd/user/umbriel-session.target".source =
      "${umbriel}/share/systemd/user/umbriel-session.target";
    "systemd/user/umbriel-shutdown.target".source =
      "${umbriel}/share/systemd/user/umbriel-shutdown.target";

    "systemd/user/umbriel.service.d/cursor.conf".text = ''
      [Service]
      Environment=XCURSOR_PATH=${config.home.sessionVariables.XCURSOR_PATH}
    '';
  };

  xdg.dataFile."wayland-sessions/umbriel.desktop".text = ''
    [Desktop Entry]
    Name=Umbriel
    Comment=Umbriel Wayland compositor
    Exec=${umbriel}/bin/start-umbriel
    Type=Application
    DesktopNames=Umbriel
  '';

  xdg.portal = {
    extraPortals = [ inputs.umbriel.packages.${system}.xdg-desktop-portal-umbriel ];
    config.umbriel.default = [
      "umbriel"
      "gtk"
    ];
  };
}
