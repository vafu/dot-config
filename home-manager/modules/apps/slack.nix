{
  xdg.desktopEntries.slack = {
    name = "Slack";
    comment = "Slack Desktop";
    genericName = "Slack Client for Linux";
    exec = "slack --enable-features=UseOzonePlatform --ozone-platform=wayland %U";
    icon = "slack";
    type = "Application";
    startupNotify = true;
    categories = [
      "Network"
      "InstantMessaging"
    ];
    mimeType = [ "x-scheme-handler/slack" ];
  };

  xdg.mimeApps.defaultApplications."x-scheme-handler/slack" = "slack.desktop";
}
