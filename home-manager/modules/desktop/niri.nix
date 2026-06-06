{
  config,
  inputs,
  pkgs,
  ...
}:

let
  cursorPath = "${config.home.homeDirectory}/.icons:${config.home.homeDirectory}/.local/share/icons:/usr/share/icons";

  uwsmSystemdFiles = [
    "app-graphical.slice"
    "background-graphical.slice"
    "fumon.service"
    "session-graphical.slice"
    "wayland-session-bindpid@.service"
    "wayland-session-envelope@.target"
    "wayland-session-pre@.target"
    "wayland-session-shutdown.target"
    "wayland-session-waitenv.service"
    "wayland-session-xdg-autostart@.target"
    "wayland-session@.target"
    "wayland-wm-app-daemon.service"
    "wayland-wm-env@.service"
    "wayland-wm@.service"
  ];

  uwsmSystemdLinks = builtins.listToAttrs (
    map (file: {
      name = "systemd/user/${file}";
      value.source = "${pkgs.uwsm}/share/systemd/user/${file}";
    }) uwsmSystemdFiles
  );
in
{
  imports = [ inputs.niri.homeModules.niri ];

  programs.niri = {
    enable = true;
    package = config.lib.nixGL.wrap pkgs.niri;
  };

  xdg.configFile = {
    "systemd/user/niri.service".source =
      "${config.programs.niri.package}/share/systemd/user/niri.service";
    "systemd/user/niri.service.d/cursor.conf".text = ''
      [Service]
      Environment=XCURSOR_PATH=${cursorPath}
    '';
    "systemd/user/wayland-wm@.service.d/cursor.conf".text = ''
      [Service]
      Environment=XCURSOR_PATH=${cursorPath}
    '';
    "systemd/user/niri-shutdown.target".source =
      "${config.programs.niri.package}/share/systemd/user/niri-shutdown.target";
  }
  // uwsmSystemdLinks;

  xdg.dataFile."wayland-sessions/uwsm-niri.desktop".text = ''
    [Desktop Entry]
    Name=Niri (UWSM)
    Comment=Niri session managed by UWSM
    Exec=${pkgs.uwsm}/bin/uwsm start -F -- niri --session
    Type=Application
    DesktopNames=Niri
  '';
}
